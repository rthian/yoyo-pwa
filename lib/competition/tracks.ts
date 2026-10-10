/**
 * Competition tracks helpers — stages are divisions; no auto-advance.
 * Prompt 18: explicit apply seats competitors into to_division via division_members.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type CompetitionTrack = {
  id: string
  event_id: string
  name: string
  description: string | null
  category_id: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AdvancementDecisionType =
  | 'advanced'
  | 'not_advanced'
  | 'seeded'
  | 'wildcard'
  | 'override'

export type AdvancementDecision = {
  id: string
  track_id: string
  rule_id: string | null
  competitor_id: string
  from_division_id: string
  to_division_id: string
  decision: AdvancementDecisionType
  reason: string | null
  actor_account_id: string | null
  applied: boolean
  created_at: string
}

export type DivisionCapacityInfo = {
  divisionId: string
  capacity: number | null
  current: number
  remaining: number | null
  overCapacity: boolean
  wouldExceed: boolean
}

const SEAT_DECISIONS: AdvancementDecisionType[] = [
  'advanced',
  'seeded',
  'wildcard',
  'override',
]

export async function listTracksForEvent(
  supabase: SupabaseClient,
  eventId: string
): Promise<CompetitionTrack[]> {
  const { data, error } = await supabase
    .from('competition_tracks')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as CompetitionTrack[]
}

export async function createTrack(
  supabase: SupabaseClient,
  input: {
    event_id: string
    name: string
    description?: string | null
    category_id?: string | null
    sort_order?: number
  }
): Promise<CompetitionTrack> {
  const { data, error } = await supabase
    .from('competition_tracks')
    .insert({
      event_id: input.event_id,
      name: input.name,
      description: input.description ?? null,
      category_id: input.category_id ?? null,
      sort_order: input.sort_order ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as CompetitionTrack
}

/** First stage by stage_order (for track registration materialization). */
export async function getFirstStageDivision(
  supabase: SupabaseClient,
  trackId: string
): Promise<{ id: string; name: string; allow_direct_entry: boolean } | null> {
  const { data } = await supabase
    .from('divisions')
    .select('id, name, allow_direct_entry, stage_order')
    .eq('track_id', trackId)
    .eq('is_active', true)
    .order('stage_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data
}

export async function listAdvancementDecisions(
  supabase: SupabaseClient,
  trackIds: string[],
  limit = 50
): Promise<AdvancementDecision[]> {
  if (!trackIds.length) return []
  const { data, error } = await supabase
    .from('advancement_decisions')
    .select('*')
    .in('track_id', trackIds)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as AdvancementDecision[]
}

export async function getDivisionCapacityInfo(
  supabase: SupabaseClient,
  divisionId: string,
  additionalSeats = 0
): Promise<DivisionCapacityInfo> {
  const { data: div } = await supabase
    .from('divisions')
    .select('id, capacity')
    .eq('id', divisionId)
    .maybeSingle()

  const { count } = await supabase
    .from('division_members')
    .select('*', { count: 'exact', head: true })
    .eq('division_id', divisionId)
    .neq('status', 'withdrawn')

  const capacity =
    div?.capacity == null ? null : Number(div.capacity)
  const current = count ?? 0
  const remaining =
    capacity == null ? null : Math.max(0, capacity - current)
  const projected = current + additionalSeats
  const wouldExceed =
    capacity != null ? projected > capacity : false

  return {
    divisionId,
    capacity,
    current,
    remaining,
    overCapacity: capacity != null ? current > capacity : false,
    wouldExceed,
  }
}

async function seatCompetitorInDivision(
  supabase: SupabaseClient,
  divisionId: string,
  competitorId: string
): Promise<{ seated: boolean; alreadyPresent: boolean }> {
  const { data: existing } = await supabase
    .from('division_members')
    .select('id, status')
    .eq('division_id', divisionId)
    .eq('competitor_id', competitorId)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'withdrawn') {
      await supabase
        .from('division_members')
        .update({ status: 'registered' })
        .eq('id', existing.id)
      return { seated: true, alreadyPresent: false }
    }
    return { seated: false, alreadyPresent: true }
  }

  const { error } = await supabase.from('division_members').insert({
    division_id: divisionId,
    competitor_id: competitorId,
    status: 'registered',
  })
  if (error) throw new Error(error.message)
  return { seated: true, alreadyPresent: false }
}

export async function recordAdvancementDecision(
  supabase: SupabaseClient,
  input: {
    trackId: string
    ruleId?: string | null
    competitorId: string
    fromDivisionId: string
    toDivisionId: string
    decision: AdvancementDecisionType
    reason?: string | null
    actorAccountId: string
    apply?: boolean
  }
): Promise<{
  decision: AdvancementDecision
  capacity: DivisionCapacityInfo | null
  seat: { seated: boolean; alreadyPresent: boolean } | null
}> {
  if (input.fromDivisionId === input.toDivisionId) {
    const err = new Error('from_division and to_division must differ')
    ;(err as Error & { status: number }).status = 400
    throw err
  }

  // Ensure competitor is (or was) in the from stage
  const { data: fromMember } = await supabase
    .from('division_members')
    .select('id')
    .eq('division_id', input.fromDivisionId)
    .eq('competitor_id', input.competitorId)
    .maybeSingle()

  if (!fromMember) {
    const err = new Error(
      'Competitor is not enrolled in the from-stage division'
    )
    ;(err as Error & { status: number }).status = 400
    throw err
  }

  const { data, error } = await supabase
    .from('advancement_decisions')
    .insert({
      track_id: input.trackId,
      rule_id: input.ruleId ?? null,
      competitor_id: input.competitorId,
      from_division_id: input.fromDivisionId,
      to_division_id: input.toDivisionId,
      decision: input.decision,
      reason: input.reason ?? null,
      actor_account_id: input.actorAccountId,
      applied: false,
    })
    .select('*')
    .single()
  if (error) throw error

  let seat: { seated: boolean; alreadyPresent: boolean } | null = null
  let capacity: DivisionCapacityInfo | null = null
  let applied = false

  // Explicit apply only — never automatic
  if (input.apply) {
    if (SEAT_DECISIONS.includes(input.decision)) {
      capacity = await getDivisionCapacityInfo(
        supabase,
        input.toDivisionId,
        1
      )
      seat = await seatCompetitorInDivision(
        supabase,
        input.toDivisionId,
        input.competitorId
      )
    }

    const { data: updated, error: applyErr } = await supabase
      .from('advancement_decisions')
      .update({ applied: true })
      .eq('id', data.id)
      .select('*')
      .single()
    if (applyErr) throw applyErr
    applied = true
    return {
      decision: updated as AdvancementDecision,
      capacity,
      seat,
    }
  }

  capacity = SEAT_DECISIONS.includes(input.decision)
    ? await getDivisionCapacityInfo(supabase, input.toDivisionId, 1)
    : null

  return {
    decision: { ...(data as AdvancementDecision), applied },
    capacity,
    seat,
  }
}

export async function applyPendingDecision(
  supabase: SupabaseClient,
  decisionId: string
): Promise<{
  decision: AdvancementDecision
  capacity: DivisionCapacityInfo | null
  seat: { seated: boolean; alreadyPresent: boolean } | null
}> {
  const { data: row, error } = await supabase
    .from('advancement_decisions')
    .select('*')
    .eq('id', decisionId)
    .maybeSingle()
  if (error) throw error
  if (!row) {
    const err = new Error('Decision not found')
    ;(err as Error & { status: number }).status = 404
    throw err
  }
  if (row.applied) {
    return {
      decision: row as AdvancementDecision,
      capacity: await getDivisionCapacityInfo(
        supabase,
        row.to_division_id as string,
        0
      ),
      seat: { seated: false, alreadyPresent: true },
    }
  }

  let seat: { seated: boolean; alreadyPresent: boolean } | null = null
  let capacity: DivisionCapacityInfo | null = null
  const decision = row.decision as AdvancementDecisionType

  if (SEAT_DECISIONS.includes(decision)) {
    capacity = await getDivisionCapacityInfo(
      supabase,
      row.to_division_id as string,
      1
    )
    seat = await seatCompetitorInDivision(
      supabase,
      row.to_division_id as string,
      row.competitor_id as string
    )
  }

  const { data: updated, error: applyErr } = await supabase
    .from('advancement_decisions')
    .update({ applied: true })
    .eq('id', decisionId)
    .select('*')
    .single()
  if (applyErr) throw applyErr

  return {
    decision: updated as AdvancementDecision,
    capacity,
    seat,
  }
}

export function groupDivisionsByTrack<
  T extends { track_id?: string | null; id: string },
>(
  tracks: CompetitionTrack[],
  divisions: T[]
): Array<{ track: CompetitionTrack | null; divisions: T[] }> {
  const byTrack = new Map<string, T[]>()
  const unassigned: T[] = []
  for (const d of divisions) {
    if (d.track_id) {
      const list = byTrack.get(d.track_id) ?? []
      list.push(d)
      byTrack.set(d.track_id, list)
    } else {
      unassigned.push(d)
    }
  }
  const groups: Array<{ track: CompetitionTrack | null; divisions: T[] }> =
    tracks.map((track) => ({
      track,
      divisions: byTrack.get(track.id) ?? [],
    }))
  if (unassigned.length) {
    groups.push({ track: null, divisions: unassigned })
  }
  return groups
}
