/**
 * Award season ranking points from frozen division results (FIP-style).
 * Called by: app/api/admin/events/[id]/finalize/route.ts
 * No prior finalize.ts (Glob empty under lib/rankings).
 * Writes ranking_points: season_id, event_id, category_id, member_id, round_type,
 *   placement, base_points, multiplier, points, event_date (YYYY-MM-DD).
 * User: create a branch… plan & build a ranking with point system league leaderboards…
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PointsRoundType, PointsTableRow } from './types'

const ROUND_DEPTH: Record<string, number> = {
  exhibition: 0,
  other: 0,
  wildcard: 1,
  qualifier: 2,
  semi_final: 3,
  final: 4,
}

function lookupBasePoints(
  rows: PointsTableRow[],
  roundType: PointsRoundType,
  placement: number
): number {
  const match = rows.find(
    (r) =>
      r.round_type === roundType &&
      placement >= r.placement_from &&
      placement <= r.placement_to
  )
  return match ? Number(match.points) : 0
}

export interface FinalizeBlocker {
  code: string
  message: string
}

export interface FinalizeResult {
  ok: boolean
  blockers?: FinalizeBlocker[]
  awardsWritten?: number
}

export async function getFinalizeBlockers(
  supabase: SupabaseClient,
  eventId: string
): Promise<FinalizeBlocker[]> {
  const blockers: FinalizeBlocker[] = []

  const { data: event } = await supabase
    .from('events')
    .select('id, season_id, tier_id, status')
    .eq('id', eventId)
    .single()

  if (!event) {
    return [{ code: 'not_found', message: 'Event not found' }]
  }
  if (!event.season_id) {
    blockers.push({ code: 'no_season', message: 'Assign a season before finalizing' })
  }
  if (!event.tier_id) {
    blockers.push({ code: 'no_tier', message: 'Assign an event tier before finalizing' })
  }

  const { data: divisions } = await supabase
    .from('divisions')
    .select('id, name, category_id, scoring_locked, round_type')
    .eq('event_id', eventId)

  const rankedDivisions = (divisions ?? []).filter((d) => d.category_id)
  if (!rankedDivisions.length) {
    blockers.push({
      code: 'no_categories',
      message: 'No divisions have a play category (1A–5A). Set category on divisions first.',
    })
  }

  for (const d of rankedDivisions) {
    if (!d.scoring_locked) {
      blockers.push({
        code: 'unlocked',
        message: `Division "${d.name}" is not scoring-locked`,
      })
    }
  }

  const eligible = rankedDivisions.filter((d) =>
    ['wildcard', 'qualifier', 'semi_final', 'final'].includes(d.round_type ?? '')
  )
  if (!eligible.length) {
    blockers.push({
      code: 'no_eligible_rounds',
      message:
        'No categorized divisions have a point-eligible round type (wildcard/qualifier/semi/final)',
    })
  } else {
    const { count } = await supabase
      .from('division_results')
      .select('*', { count: 'exact', head: true })
      .in(
        'division_id',
        eligible.map((d) => d.id)
      )
    if (!count) {
      blockers.push({
        code: 'no_results',
        message:
          'No frozen division results found. Lock scoring on each division to snapshot standings first.',
      })
    }
  }

  return blockers
}

export async function finalizeEventPoints(
  supabase: SupabaseClient,
  eventId: string
): Promise<FinalizeResult> {
  const blockers = await getFinalizeBlockers(supabase, eventId)
  if (blockers.length) return { ok: false, blockers }

  const { data: event } = await supabase
    .from('events')
    .select('id, season_id, tier_id, event_date')
    .eq('id', eventId)
    .single()

  if (!event?.season_id || !event.tier_id) {
    return { ok: false, blockers: [{ code: 'incomplete', message: 'Missing season or tier' }] }
  }

  const { data: season } = await supabase
    .from('seasons')
    .select('id, points_table_id')
    .eq('id', event.season_id)
    .single()

  if (!season?.points_table_id) {
    return {
      ok: false,
      blockers: [{ code: 'no_points_table', message: 'Season has no points table' }],
    }
  }

  const { data: tier } = await supabase
    .from('event_tiers')
    .select('multiplier')
    .eq('id', event.tier_id)
    .single()

  const multiplier = Number(tier?.multiplier ?? 1)

  const { data: tableRows } = await supabase
    .from('points_table_rows')
    .select('*')
    .eq('points_table_id', season.points_table_id)

  const pointsRows = (tableRows ?? []) as PointsTableRow[]

  const { data: divisions } = await supabase
    .from('divisions')
    .select('id, category_id, round_type, eligibility, field_scope')
    .eq('event_id', eventId)
    .not('category_id', 'is', null)

  if (!divisions?.length) {
    return { ok: false, blockers: [{ code: 'no_divisions', message: 'No categorized divisions' }] }
  }

  const divisionIds = divisions.map((d) => d.id)
  const { data: results } = await supabase
    .from('division_results')
    .select('division_id, member_id, placement, score_count')
    .in('division_id', divisionIds)

  const memberIds = [...new Set((results ?? []).map((r) => r.member_id))]
  const { data: members } = memberIds.length
    ? await supabase.from('members').select('id, home_geo_id').in('id', memberIds)
    : { data: [] as { id: string; home_geo_id: string | null }[] }

  const geoByMember = new Map(
    (members ?? []).map((m) => [m.id, m.home_geo_id as string | null])
  )

  type Agg = {
    categoryId: string
    memberId: string
    divisionId: string
    roundType: PointsRoundType
    placement: number
    fieldSize: number
    eligibility: string
    fieldScope: string
  }

  const bestByKey = new Map<string, Agg>()

  for (const div of divisions) {
    if (!div.category_id) continue
    const depth = ROUND_DEPTH[div.round_type ?? ''] ?? 0
    if (depth < 1) continue
    const roundType = div.round_type as PointsRoundType

    const divResults = (results ?? []).filter(
      (r) => r.division_id === div.id && r.placement != null && r.score_count > 0
    )
    const fieldSize = divResults.length

    for (const r of divResults) {
      const key = `${div.category_id}:${r.member_id}`
      const existing = bestByKey.get(key)
      const candidate: Agg = {
        categoryId: div.category_id,
        memberId: r.member_id,
        divisionId: div.id,
        roundType,
        placement: r.placement as number,
        fieldSize,
        eligibility: div.eligibility || 'open',
        fieldScope: (div as { field_scope?: string }).field_scope || 'championship',
      }
      if (
        !existing ||
        (ROUND_DEPTH[candidate.roundType] ?? 0) > (ROUND_DEPTH[existing.roundType] ?? 0)
      ) {
        bestByKey.set(key, candidate)
      }
    }
  }

  const awards = [...bestByKey.values()].map((a) => {
    const base = lookupBasePoints(pointsRows, a.roundType, a.placement)
    const points = Math.round((base + 0) * multiplier * 100) / 100
    return {
      season_id: event.season_id!,
      event_id: eventId,
      category_id: a.categoryId,
      member_id: a.memberId,
      division_id: a.divisionId,
      round_type: a.roundType,
      placement: a.placement,
      field_size: a.fieldSize,
      base_points: base,
      bonus_points: 0,
      multiplier,
      points,
      representing_geo_id: geoByMember.get(a.memberId) ?? null,
      event_date: event.event_date,
      eligibility: a.eligibility,
      field_scope: a.fieldScope,
    }
  })

  await supabase.from('ranking_points').delete().eq('event_id', eventId)

  if (awards.length) {
    const { error } = await supabase.from('ranking_points').insert(awards)
    if (error) throw new Error(error.message)
  }

  await supabase.from('events').update({ status: 'completed' }).eq('id', eventId)

  return { ok: true, awardsWritten: awards.length }
}

export async function unfinalizeEventPoints(
  supabase: SupabaseClient,
  eventId: string
): Promise<void> {
  const { error } = await supabase.from('ranking_points').delete().eq('event_id', eventId)
  if (error) throw new Error(error.message)
}
