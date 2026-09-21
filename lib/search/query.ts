/**
 * Public search over members + events.
 * Callers: app/api/search/route.ts, components/shared/SearchDialog.tsx
 * Glob: no prior lib/search/
 * Reads members (public), events. No writes.
 * User: "Lastly it should have a search for ease of discovery."
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

  const { data: members } = await supabase
    .from('members')
    .select(
      'id, public_id, full_name, nickname, country, is_active, profile_visibility'
    )
    .eq('is_active', true)
    .eq('profile_visibility', 'public')
    .or(
      `full_name.ilike.${pattern},nickname.ilike.${pattern},public_id.ilike.${pattern}`
    )
    .limit(limit)

  for (const m of members ?? []) {
    hits.push({
      type: 'player',
      id: m.id,
      title: m.nickname || m.full_name,
      subtitle: [m.full_name !== m.nickname ? m.full_name : null, m.public_id, m.country]
        .filter(Boolean)
        .join(' · '),
      href: `/players/${m.public_id || m.id}`,
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
