/**
 * Public search — Slice C: players from competitors; events unchanged.
 * Callers: app/api/search/route.ts, components/shared/SearchDialog.tsx
 * Glob: existing lib/search/query.ts
 * Sample hit: { type: "player", href: "/players/ZX905JYC" }
 * User: "ok next"
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface SearchHit {
  type: 'player' | 'event'
  id: string
  title: string
  subtitle: string | null
  href: string
}

export async function searchPublic(
  supabase: SupabaseClient,
  q: string,
  limit = 20
): Promise<SearchHit[]> {
  const term = q.trim()
  if (term.length < 2) return []

  const pattern = `%${term}%`
  const hits: SearchHit[] = []

  const { data: competitors } = await supabase
    .from('competitors')
    .select(
      'id, public_id, full_name, nickname, country, is_active, profile_visibility'
    )
    .eq('is_active', true)
    .eq('profile_visibility', 'public')
    .or(
      `full_name.ilike.${pattern},nickname.ilike.${pattern},public_id.ilike.${pattern}`
    )
    .limit(limit)

  for (const c of competitors ?? []) {
    hits.push({
      type: 'player',
      id: c.id,
      title: c.nickname || c.full_name,
      subtitle: [
        c.full_name !== c.nickname ? c.full_name : null,
        c.public_id,
        c.country,
      ]
        .filter(Boolean)
        .join(' · '),
      href: `/players/${c.public_id || c.id}`,
    })
  }

  const { data: events } = await supabase
    .from('events')
    .select('id, name, location, event_date, status')
    .ilike('name', pattern)
    .in('status', ['published', 'active', 'completed'])
    .limit(Math.max(5, Math.floor(limit / 2)))

  for (const e of events ?? []) {
    hits.push({
      type: 'event',
      id: e.id,
      title: e.name,
      subtitle: [e.location, e.event_date].filter(Boolean).join(' · '),
      href: `/events/${e.id}`,
    })
  }

  return hits.slice(0, limit)
}
