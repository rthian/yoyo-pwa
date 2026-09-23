/**
 * Custom League — admin-curated contest sets (placeholder name).
 * Standings reuse ranking_points filtered by included event IDs.
 * Callers: app/api/rankings/leagues/*, app/api/admin/custom-leagues/*.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CustomLeague } from './types'

export async function listCustomLeagues(
  supabase: SupabaseClient,
  opts?: { seasonId?: string; includeInactive?: boolean }
): Promise<CustomLeague[]> {
  let q = supabase.from('custom_leagues').select('*').order('name')
  if (opts?.seasonId) q = q.eq('season_id', opts.seasonId)
  if (!opts?.includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as CustomLeague[]
}

export async function getCustomLeagueBySlug(
  supabase: SupabaseClient,
  slug: string,
  opts?: { seasonId?: string; includeInactive?: boolean }
): Promise<CustomLeague | null> {
  let q = supabase.from('custom_leagues').select('*').eq('slug', slug)
  if (opts?.seasonId) q = q.eq('season_id', opts.seasonId)
  if (!opts?.includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q.maybeSingle()
  if (error) throw new Error(error.message)
  return (data as CustomLeague) ?? null
}

export async function getCustomLeagueEventIds(
  supabase: SupabaseClient,
  leagueId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('custom_league_events')
    .select('event_id')
    .eq('league_id', leagueId)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => r.event_id as string)
}

export async function getHomeGeoPath(
  supabase: SupabaseClient,
  homeGeoId: string | null
): Promise<string | null> {
  if (!homeGeoId) return null
  const { data, error } = await supabase
    .from('geo_nodes')
    .select('path')
    .eq('id', homeGeoId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.path ?? null
}
