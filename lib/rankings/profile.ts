/**
 * Player public profile from season points ledger.
 * Callers: app/api/players/[publicId]/route.ts, app/players/[publicId]/page.tsx
 * Glob: no prior lib/rankings/profile.ts
 * Reads members, ranking_points, season_titles. Dates: event_date DATE, created_at TIMESTAMPTZ.
 * User: "There should also have a member profile page (reference WCA persons)..."
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Gender, PlayerProfile } from './types'

export async function getPlayerProfile(
  supabase: SupabaseClient,
  publicIdOrUuid: string
): Promise<PlayerProfile | null> {
  // Resolve compact id (stored) or hyphenated display form from URL
  const raw = decodeURIComponent(publicIdOrUuid).trim()
  const compact = raw.replace(/-/g, '').toUpperCase()

  let member = (
    await supabase
      .from('members')
      .select(
        'id, public_id, full_name, nickname, country, home_geo_id, gender, bio, avatar_url, first_competed_on, created_at, is_active, profile_visibility'
      )
      .eq('public_id', compact)
      .maybeSingle()
  ).data

  if (!member && raw !== compact) {
    member = (
      await supabase
        .from('members')
        .select(
          'id, public_id, full_name, nickname, country, home_geo_id, gender, bio, avatar_url, first_competed_on, created_at, is_active, profile_visibility'
        )
        .eq('public_id', raw)
        .maybeSingle()
    ).data
  }

  if (!member) {
    const byId = await supabase
      .from('members')
      .select(
        'id, public_id, full_name, nickname, country, home_geo_id, gender, bio, avatar_url, first_competed_on, created_at, is_active, profile_visibility'
      )
      .eq('id', publicIdOrUuid)
      .maybeSingle()
    member = byId.data
  }

  if (!member || !member.is_active) return null
  if (member.profile_visibility === 'private') return null

  let isoAlpha2: string | null = null
  let geoName: string | null = null
  if (member.home_geo_id) {
    const { data: geo } = await supabase
      .from('geo_nodes')
      .select('name, iso_alpha2, path')
      .eq('id', member.home_geo_id)
      .maybeSingle()
    isoAlpha2 = geo?.iso_alpha2 ?? null
    geoName = geo?.name ?? null
  }

  const { data: points } = await supabase
    .from('ranking_points')
    .select(
      `
      id, season_id, event_id, category_id, division_id, round_type, placement, field_size,
      points, eligibility, event_date,
      event:events(id, name, tier_id),
      category:play_categories(code),
      season:seasons(slug, name)
    `
    )
    .eq('member_id', member.id)
    .order('event_date', { ascending: false })

  const tierIds = [
    ...new Set(
      (points ?? [])
        .map((p) => (p.event as { tier_id?: string } | null)?.tier_id)
        .filter(Boolean) as string[]
    ),
  ]
  const { data: tiers } = tierIds.length
    ? await supabase.from('event_tiers').select('id, name').in('id', tierIds)
    : { data: [] as { id: string; name: string }[] }
  const tierById = new Map((tiers ?? []).map((t) => [t.id, t.name]))

function one<T>(val: T | T[] | null | undefined): T | null {
  if (val == null) return null
  return Array.isArray(val) ? val[0] ?? null : val
}

  const results = (points ?? []).map((p) => {
    const event = one(p.event as { id: string; name: string; tier_id?: string } | { id: string; name: string; tier_id?: string }[] | null)
    const category = one(p.category as { code: string } | { code: string }[] | null)
    return {
      eventId: p.event_id,
      divisionId: p.division_id ?? null,
      eventName: event?.name ?? 'Event',
      eventDate: p.event_date,
      categoryCode: category?.code ?? '?',
      roundType: p.round_type,
      placement: p.placement,
      fieldSize: p.field_size,
      points: Number(p.points) || 0,
      eligibility: p.eligibility ?? 'open',
      tierName: event?.tier_id ? (tierById.get(event.tier_id) ?? null) : null,
    }
  })

  const careerPoints =
    Math.round(results.reduce((a, r) => a + r.points, 0) * 100) / 100

  const seasonCat = new Map<string, number>()
  for (const p of points ?? []) {
    const season = one(p.season as { slug: string; name: string } | { slug: string; name: string }[] | null)
    const category = one(p.category as { code: string } | { code: string }[] | null)
    if (!season || !category) continue
    const key = `${season.slug}|${category.code}|${season.name}|${p.season_id}|${p.category_id}`
    seasonCat.set(key, (seasonCat.get(key) ?? 0) + (Number(p.points) || 0))
  }

  const seasonRanks: PlayerProfile['seasonRanks'] = []
  for (const [key, total] of seasonCat) {
    const [slug, code, name, seasonId, categoryId] = key.split('|')
    const { data: peers } = await supabase
      .from('ranking_points')
      .select('member_id, points')
      .eq('season_id', seasonId)
      .eq('category_id', categoryId)

    const peerTotals = new Map<string, number>()
    for (const row of peers ?? []) {
      peerTotals.set(
        row.member_id,
        (peerTotals.get(row.member_id) ?? 0) + (Number(row.points) || 0)
      )
    }
    const sorted = [...peerTotals.entries()].sort((a, b) => b[1] - a[1])
    const worldRank = sorted.findIndex(([id]) => id === member.id) + 1 || null

    seasonRanks.push({
      seasonSlug: slug,
      seasonName: name,
      categoryCode: code,
      worldRank,
      regionRank: null,
      countryRank: null,
      totalPoints: Math.round(total * 100) / 100,
    })
  }

  const { data: titles } = await supabase
    .from('season_titles')
    .select('rank, title_kind, season:seasons(name), category:play_categories(code)')
    .eq('member_id', member.id)

  return {
    id: member.id,
    publicId: member.public_id,
    fullName: member.full_name,
    nickname: member.nickname,
    country: member.country,
    isoAlpha2,
    geoName,
    gender: (member.gender as Gender) ?? null,
    bio: member.bio,
    avatarUrl: member.avatar_url,
    firstCompetedOn: member.first_competed_on,
    memberSince: member.created_at,
    seasonRanks,
    results,
    titles: (titles ?? []).map((t) => ({
      seasonName: one(t.season as { name: string } | { name: string }[] | null)?.name ?? '',
      categoryCode: one(t.category as { code: string } | { code: string }[] | null)?.code ?? '',
      titleKind: t.title_kind,
      rank: t.rank,
    })),
    careerPoints,
    eventsPlayed: results.length,
  }
}
