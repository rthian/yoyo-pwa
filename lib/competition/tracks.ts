/**
 * Competition tracks helpers — stages are divisions; no auto-advance.
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

export async function recordAdvancementDecision(
  supabase: SupabaseClient,
  input: {
    trackId: string
    ruleId?: string | null
    competitorId: string
    fromDivisionId: string
    toDivisionId: string
    decision: 'advanced' | 'not_advanced' | 'seeded' | 'wildcard' | 'override'
    reason?: string | null
    actorAccountId: string
    apply?: boolean
  }
) {
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

  // Explicit apply only — never automatic
  if (input.apply) {
    const { error: applyErr } = await supabase
      .from('advancement_decisions')
      .update({ applied: true })
      .eq('id', data.id)
    if (applyErr) throw applyErr
  }

  return data
}

export function groupDivisionsByTrack<T extends { track_id?: string | null; id: string }>(
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
  const groups: Array<{ track: CompetitionTrack | null; divisions: T[] }> = tracks.map(
    (track) => ({
      track,
      divisions: byTrack.get(track.id) ?? [],
    })
  )
  if (unassigned.length) {
    groups.push({ track: null, divisions: unassigned })
  }
  return groups
}
