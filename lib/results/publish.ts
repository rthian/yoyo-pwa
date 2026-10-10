/**
 * Prompt 12: publish official event results from frozen division_results.
 * Callers: app/api/events/[id]/results/route.ts, results/publish/route.ts,
 *          components/admin/PublishResultsPanel.tsx, EventHubClient via hub API.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { snapshotDivisionResults } from '@/lib/rankings/standings'

export type PublishBlocker = { code: string; message: string; divisionId?: string }

export type PublishedPlacement = {
  placement: number | null
  totalScore: number | null
  scoreCount: number
  memberId: string
  competitorName: string
  publicId: string | null
  country: string | null
}

export type PublishedDivision = {
  divisionId: string
  divisionName: string
  roundType: string | null
  sortOrder: number
  scoringLocked: boolean
  placements: PublishedPlacement[]
}

export async function getPublishReadiness(
  supabase: SupabaseClient,
  eventId: string
): Promise<{
  published: boolean
  publishedAt: string | null
  publishedBy: string | null
  canPublish: boolean
  blockers: PublishBlocker[]
  divisions: Array<{
    id: string
    name: string
    scoringLocked: boolean
    resultCount: number
    participantCount: number
  }>
}> {
  const { data: event } = await supabase
    .from('events')
    .select('id, results_published_at, results_published_by')
    .eq('id', eventId)
    .single()

  if (!event) throw new Error('Event not found')

  const { data: divisions } = await supabase
    .from('divisions')
    .select('id, name, scoring_locked, sort_order')
    .eq('event_id', eventId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const divisionIds = (divisions ?? []).map((d) => d.id)
  const blockers: PublishBlocker[] = []

  const [{ data: members }, { data: results }] = await Promise.all([
    divisionIds.length
      ? supabase.from('division_members').select('division_id').in('division_id', divisionIds)
      : Promise.resolve({ data: [] as { division_id: string }[] }),
    divisionIds.length
      ? supabase
          .from('division_results')
          .select('division_id')
          .in('division_id', divisionIds)
      : Promise.resolve({ data: [] as { division_id: string }[] }),
  ])

  const participantCounts = new Map<string, number>()
  for (const m of members ?? []) {
    participantCounts.set(m.division_id, (participantCounts.get(m.division_id) || 0) + 1)
  }
  const resultCounts = new Map<string, number>()
  for (const r of results ?? []) {
    resultCounts.set(r.division_id, (resultCounts.get(r.division_id) || 0) + 1)
  }

  const divSummaries = (divisions ?? []).map((d) => {
    const participantCount = participantCounts.get(d.id) || 0
    const resultCount = resultCounts.get(d.id) || 0
    if (!d.scoring_locked) {
      blockers.push({
        code: 'not_locked',
        message: `${d.name} is not scoring-locked`,
        divisionId: d.id,
      })
    } else if (participantCount > 0 && resultCount === 0) {
      blockers.push({
        code: 'missing_results',
        message: `${d.name} has no frozen results — re-lock to snapshot`,
        divisionId: d.id,
      })
    }
    return {
      id: d.id,
      name: d.name,
      scoringLocked: Boolean(d.scoring_locked),
      resultCount,
      participantCount,
    }
  })

  if (!(divisions ?? []).length) {
    blockers.push({ code: 'no_divisions', message: 'Event has no active divisions' })
  }

  return {
    published: Boolean(event.results_published_at),
    publishedAt: event.results_published_at ?? null,
    publishedBy: event.results_published_by ?? null,
    canPublish: blockers.length === 0,
    blockers,
    divisions: divSummaries,
  }
}

export async function publishEventResults(
  supabase: SupabaseClient,
  args: { eventId: string; actorId: string }
): Promise<{ publishedAt: string; divisionsRefreshed: number }> {
  const readiness = await getPublishReadiness(supabase, args.eventId)
  if (!readiness.canPublish) {
    const err = new Error(readiness.blockers[0]?.message || 'Cannot publish') as Error & {
      blockers: PublishBlocker[]
    }
    err.blockers = readiness.blockers
    throw err
  }

  let refreshed = 0
  for (const d of readiness.divisions) {
    if (d.scoringLocked) {
      await snapshotDivisionResults(supabase, d.id)
      refreshed += 1
    }
  }

  const publishedAt = new Date().toISOString()
  const action = readiness.published ? 'republish' : 'publish'

  const { error } = await supabase
    .from('events')
    .update({
      results_published_at: publishedAt,
      results_published_by: args.actorId,
    })
    .eq('id', args.eventId)

  if (error) throw error

  await supabase.from('published_results_audit').insert({
    event_id: args.eventId,
    action,
    actor_account_id: args.actorId,
    detail: {
      divisionsRefreshed: refreshed,
      divisionIds: readiness.divisions.map((d) => d.id),
    },
  })

  return { publishedAt, divisionsRefreshed: refreshed }
}

export async function unpublishEventResults(
  supabase: SupabaseClient,
  args: { eventId: string; actorId: string }
): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({
      results_published_at: null,
      results_published_by: null,
    })
    .eq('id', args.eventId)

  if (error) throw error

  await supabase.from('published_results_audit').insert({
    event_id: args.eventId,
    action: 'unpublish',
    actor_account_id: args.actorId,
    detail: {},
  })
}

export async function getPublishedEventResults(
  supabase: SupabaseClient,
  eventId: string,
  options?: { requirePublished?: boolean }
): Promise<{
  eventId: string
  eventName: string
  publishedAt: string | null
  divisions: PublishedDivision[]
} | null> {
  const { data: event } = await supabase
    .from('events')
    .select('id, name, results_published_at, status')
    .eq('id', eventId)
    .single()

  if (!event) return null
  if (options?.requirePublished !== false && !event.results_published_at) {
    return null
  }

  const { data: divisions } = await supabase
    .from('divisions')
    .select('id, name, round_type, sort_order, scoring_locked')
    .eq('event_id', eventId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const divisionIds = (divisions ?? []).map((d) => d.id)
  if (!divisionIds.length) {
    return {
      eventId: event.id,
      eventName: event.name,
      publishedAt: event.results_published_at,
      divisions: [],
    }
  }

  const { data: results } = await supabase
    .from('division_results')
    .select('division_id, competitor_id, placement, total_score, score_count')
    .in('division_id', divisionIds)

  const competitorIds = [
    ...new Set(
      (results ?? [])
        .map((r) => r.competitor_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const { data: competitors } = competitorIds.length
    ? await supabase
        .from('competitors')
        .select('id, full_name, public_id, country')
        .in('id', competitorIds)
    : {
        data: [] as Array<{
          id: string
          full_name: string
          public_id: string | null
          country: string | null
        }>,
      }

  const competitorById = new Map((competitors ?? []).map((c) => [c.id, c]))

  const resultsByDivision = new Map<string, NonNullable<typeof results>>()
  for (const r of results ?? []) {
    const list = resultsByDivision.get(r.division_id) ?? []
    list.push(r)
    resultsByDivision.set(r.division_id, list)
  }

  const publishedDivisions: PublishedDivision[] = (divisions ?? []).map((d) => {
    const rows = [...(resultsByDivision.get(d.id) ?? [])].sort((a, b) => {
      const pa = a.placement ?? 9999
      const pb = b.placement ?? 9999
      if (pa !== pb) return pa - pb
      return Number(b.total_score ?? 0) - Number(a.total_score ?? 0)
    })

    return {
      divisionId: d.id,
      divisionName: d.name,
      roundType: d.round_type,
      sortOrder: d.sort_order,
      scoringLocked: Boolean(d.scoring_locked),
      placements: rows.map((r) => {
        const comp = competitorById.get(r.competitor_id)
        return {
          placement: r.placement,
          totalScore: r.total_score != null ? Number(r.total_score) : null,
          scoreCount: r.score_count ?? 0,
          memberId: r.competitor_id,
          competitorName: comp?.full_name || 'Unknown',
          publicId: comp?.public_id ?? null,
          country: comp?.country ?? null,
        }
      }),
    }
  })

  return {
    eventId: event.id,
    eventName: event.name,
    publishedAt: event.results_published_at,
    divisions: publishedDivisions,
  }
}
