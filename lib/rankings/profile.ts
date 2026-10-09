/**
 * Player public profile — Slice C: resolve via competitors (not members).
 * Callers: app/api/players/[publicId]/route.ts, app/players/[publicId]/page.tsx
 * Ledger reads prefer competitor_id; fall back to member_id during dual period.
 * Glob: existing lib/rankings/profile.ts (rewrite)
 * Sample: public_id ZX905JYC → competitor row + ranking_points by competitor_id
 * User: "ok next"
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Gender, PlayerProfile } from './types'

const COMPETITOR_SELECT =
  'id, source_member_id, public_id, full_name, nickname, country, home_geo_id, gender, bio, avatar_url, first_competed_on, created_at, is_active, profile_visibility'

type CompetitorRow = {
  id: string
  source_member_id: string | null
  public_id: string | null
  full_name: string
  nickname: string | null
  country: string | null
  home_geo_id: string | null
  gender: string | null
  bio: string | null
  avatar_url: string | null
  first_competed_on: string | null
  created_at: string
  is_active: boolean | null
  profile_visibility: string | null
}

function one<T>(val: T | T[] | null | undefined): T | null {
  if (val == null) return null
  return Array.isArray(val) ? (val[0] ?? null) : val
}

async function resolveCompetitor(
  supabase: SupabaseClient,
  publicIdOrUuid: string
): Promise<CompetitorRow | null> {
  const raw = decodeURIComponent(publicIdOrUuid).trim()
  const compact = raw.replace(/-/g, '').toUpperCase()

  let competitor = (
    await supabase
      .from('competitors')
      .select(COMPETITOR_SELECT)
      .eq('public_id', compact)
      .maybeSingle()
  ).data as CompetitorRow | null

  if (!competitor && raw !== compact) {
    competitor = (
      await supabase
        .from('competitors')
        .select(COMPETITOR_SELECT)
        .eq('public_id', raw)
        .maybeSingle()
    ).data as CompetitorRow | null
  }

  if (!competitor) {
    competitor = (
      await supabase
        .from('competitors')
        .select(COMPETITOR_SELECT)
        .eq('id', publicIdOrUuid)
        .maybeSingle()
    ).data as CompetitorRow | null
  }

  // Legacy URL: members.id → self competitor
  if (!competitor) {
    competitor = (
      await supabase
        .from('competitors')
        .select(COMPETITOR_SELECT)
        .eq('source_member_id', publicIdOrUuid)
        .maybeSingle()
    ).data as CompetitorRow | null
  }

  if (!competitor) {
    const { data: link } = await supabase
      .from('account_competitor_links')
      .select('competitor_id')
      .eq('account_id', publicIdOrUuid)
      .eq('relationship', 'self')
      .maybeSingle()
    if (link?.competitor_id) {
      competitor = (
        await supabase
          .from('competitors')
          .select(COMPETITOR_SELECT)
          .eq('id', link.competitor_id)
          .maybeSingle()
      ).data as CompetitorRow | null
    }
  }

  return competitor
}

export async function getPlayerProfile(
  supabase: SupabaseClient,
  publicIdOrUuid: string
): Promise<PlayerProfile | null> {
  const competitor = await resolveCompetitor(supabase, publicIdOrUuid)
  if (!competitor || !competitor.is_active) return null
  if (competitor.profile_visibility === 'private') return null

  let isoAlpha2: string | null = null
  let geoName: string | null = null
  if (competitor.home_geo_id) {
    const { data: geo } = await supabase
      .from('geo_nodes')
      .select('name, iso_alpha2, path')
      .eq('id', competitor.home_geo_id)
      .maybeSingle()
    isoAlpha2 = geo?.iso_alpha2 ?? null
    geoName = geo?.name ?? null
  }

  let { data: points } = await supabase
    .from('ranking_points')
    .select(
      `
      id, season_id, event_id, category_id, division_id, round_type, placement, field_size,
      points, eligibility, event_date, competitor_id, member_id,
      event:events(id, name, tier_id),
      category:play_categories(code),
      season:seasons(slug, name)
    `
    )
    .eq('competitor_id', competitor.id)
    .order('event_date', { ascending: false })

  if ((!points || points.length === 0) && competitor.source_member_id) {
    const fallback = await supabase
      .from('ranking_points')
      .select(
        `
      id, season_id, event_id, category_id, division_id, round_type, placement, field_size,
      points, eligibility, event_date, competitor_id, member_id,
      event:events(id, name, tier_id),
      category:play_categories(code),
      season:seasons(slug, name)
    `
      )
      .eq('member_id', competitor.source_member_id)
      .order('event_date', { ascending: false })
    points = fallback.data
  }

  const tierIds = [
    ...new Set(
      (points ?? [])
        .map((p) => {
          const ev = one(
            p.event as { tier_id?: string } | { tier_id?: string }[] | null
          )
          return ev?.tier_id
        })
        .filter(Boolean) as string[]
    ),
  ]
  const { data: tiers } = tierIds.length
    ? await supabase.from('event_tiers').select('id, name').in('id', tierIds)
    : { data: [] as { id: string; name: string }[] }
  const tierById = new Map((tiers ?? []).map((t) => [t.id, t.name]))

  const results = (points ?? []).map((p) => {
    const event = one(
      p.event as
        | { id: string; name: string; tier_id?: string }
        | { id: string; name: string; tier_id?: string }[]
        | null
    )
    const category = one(
      p.category as { code: string } | { code: string }[] | null
    )
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
      tierName: event?.tier_id
        ? (tierById.get(event.tier_id) ?? null)
        : null,
    }
  })

  const careerPoints =
    Math.round(results.reduce((a, r) => a + r.points, 0) * 100) / 100

  const seasonCat = new Map<string, number>()
  for (const p of points ?? []) {
    const season = one(
      p.season as
        | { slug: string; name: string }
        | { slug: string; name: string }[]
        | null
    )
    const category = one(
      p.category as { code: string } | { code: string }[] | null
    )
    if (!season || !category) continue
    const key = `${season.slug}|${category.code}|${season.name}|${p.season_id}|${p.category_id}`
    seasonCat.set(key, (seasonCat.get(key) ?? 0) + (Number(p.points) || 0))
  }

  const seasonRanks: PlayerProfile['seasonRanks'] = []
  for (const [key, total] of seasonCat) {
    const [slug, code, name, seasonId, categoryId] = key.split('|')
    const { data: peers } = await supabase
      .from('ranking_points')
      .select('competitor_id, member_id, points')
      .eq('season_id', seasonId)
      .eq('category_id', categoryId)

    const peerTotals = new Map<string, number>()
    for (const row of peers ?? []) {
      const peerKey = row.competitor_id || row.member_id
      if (!peerKey) continue
      peerTotals.set(
        peerKey,
        (peerTotals.get(peerKey) ?? 0) + (Number(row.points) || 0)
      )
    }
    const sorted = [...peerTotals.entries()].sort((a, b) => b[1] - a[1])
    const worldRank =
      sorted.findIndex(([id]) => id === competitor.id) + 1 || null

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

  let { data: titles } = await supabase
    .from('season_titles')
    .select(
      'rank, title_kind, season:seasons(name), category:play_categories(code)'
    )
    .eq('competitor_id', competitor.id)

  if ((!titles || titles.length === 0) && competitor.source_member_id) {
    const fallback = await supabase
      .from('season_titles')
      .select(
        'rank, title_kind, season:seasons(name), category:play_categories(code)'
      )
      .eq('member_id', competitor.source_member_id)
    titles = fallback.data
  }

  return {
    id: competitor.id,
    accountMemberId: competitor.source_member_id,
    publicId: competitor.public_id,
    fullName: competitor.full_name,
    nickname: competitor.nickname,
    country: competitor.country,
    isoAlpha2,
    geoName,
    gender: (competitor.gender as Gender) ?? null,
    bio: competitor.bio,
    avatarUrl: competitor.avatar_url,
    firstCompetedOn: competitor.first_competed_on,
    memberSince: competitor.created_at,
    seasonRanks,
    results,
    titles: (titles ?? []).map((t) => ({
      seasonName:
        one(t.season as { name: string } | { name: string }[] | null)?.name ??
        '',
      categoryCode:
        one(t.category as { code: string } | { code: string }[] | null)
          ?.code ?? '',
      titleKind: t.title_kind,
      rank: t.rank,
    })),
    careerPoints,
    eventsPlayed: results.length,
  }
}
