/**
 * Query season league rankings with category, geo, gender filters.
 * Optimized: one embedded ranking_points query (+ optional geo already embedded).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DivisionFilter, Gender, LeagueRankingEntry } from './types'

export interface RankingsQuery {
  seasonId: string
  categoryId?: string | null
  geoPath?: string | null
  division?: DivisionFilter
  search?: string | null
  countingResults?: number | null
  /** When set (Custom League), only these events' points count. */
  eventIds?: string[] | null
  /** World Race: National + Continental + World tiers. */
  worldRaceOnly?: boolean
  /** National Race: Regional + National tiers. */
  nationalRaceOnly?: boolean
  /** public_id or member uuid — return focusEntry even outside the page window. */
  focusMember?: string | null
  limit?: number
  offset?: number
}

type AggMember = {
  id: string
  full_name: string
  nickname: string | null
  country: string | null
  home_geo_id: string | null
  public_id: string | null
  gender: Gender | null
  geo_path: string | null
  geo_name: string | null
  iso_alpha2: string | null
}

type PointsRow = {
  member_id: string
  points: number | string
  field_scope: string | null
  event_id: string
  members: {
    id: string
    full_name: string
    nickname: string | null
    country: string | null
    is_active: boolean
    home_geo_id: string | null
    public_id: string | null
    gender: string | null
    geo_nodes: {
      name: string
      iso_alpha2: string | null
      path: string
    } | null
  } | null
  events: {
    id: string
    event_tiers: {
      counts_for_world_race: boolean
      counts_for_national_race: boolean
    } | null
  } | null
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function aggregateTotals(
  byMember: Map<string, { points: number[]; member: AggMember; bestSingle: number }>,
  counting: number | null
) {
  return [...byMember.entries()].map(([memberId, { points, member, bestSingle }]) => {
    const sorted = [...points].sort((a, b) => b - a)
    const counted =
      counting != null && counting > 0 ? sorted.slice(0, counting) : sorted
    const totalPoints =
      Math.round(counted.reduce((a, b) => a + b, 0) * 100) / 100
    return {
      memberId,
      publicId: member.public_id,
      memberName: member.full_name,
      nickname: member.nickname,
      country: member.country,
      isoAlpha2: member.iso_alpha2,
      geoName: member.geo_name,
      gender: member.gender,
      totalPoints,
      eventsPlayed: points.length,
      bestSingle,
      rank: 0,
      overallRank: null as number | null,
    }
  })
}

function rankList<
  T extends {
    totalPoints: number
    bestSingle: number
    eventsPlayed: number
    memberName: string
    rank: number
  },
>(list: T[]) {
  list.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    if (b.bestSingle !== a.bestSingle) return b.bestSingle - a.bestSingle
    if (a.eventsPlayed !== b.eventsPlayed) return a.eventsPlayed - b.eventsPlayed
    return a.memberName.localeCompare(b.memberName)
  })
  let lastKey: string | null = null
  let lastRank = 0
  list.forEach((t, i) => {
    const key = `${t.totalPoints}|${t.bestSingle}|${t.eventsPlayed}`
    if (lastKey === null || key !== lastKey) {
      lastRank = i + 1
      lastKey = key
    }
    t.rank = lastRank
  })
}

export async function getLeagueRankings(
  supabase: SupabaseClient,
  query: RankingsQuery
): Promise<{
  entries: LeagueRankingEntry[]
  total: number
  focusEntry: LeagueRankingEntry | null
}> {
  const limit = query.limit ?? 100
  const offset = query.offset ?? 0
  const division = query.division ?? 'open'
  const focusKey = query.focusMember?.trim() || ''

  if (query.eventIds && query.eventIds.length === 0) {
    return { entries: [], total: 0, focusEntry: null }
  }

  let pointsQuery = supabase
    .from('ranking_points')
    .select(
      `
      member_id,
      points,
      field_scope,
      event_id,
      members!inner (
        id,
        full_name,
        nickname,
        country,
        is_active,
        home_geo_id,
        public_id,
        gender,
        geo_nodes ( name, iso_alpha2, path )
      ),
      events!inner (
        id,
        event_tiers ( counts_for_world_race, counts_for_national_race )
      )
    `
    )
    .eq('season_id', query.seasonId)
    .eq('members.is_active', true)

  if (query.categoryId) {
    pointsQuery = pointsQuery.eq('category_id', query.categoryId)
  }
  if (query.eventIds?.length) {
    pointsQuery = pointsQuery.in('event_id', query.eventIds)
  }
  if (query.nationalRaceOnly) {
    pointsQuery = pointsQuery.eq('field_scope', 'championship')
  }

  const { data: rawRows, error } = await pointsQuery
  if (error) throw new Error(error.message)

  if (!rawRows?.length) return { entries: [], total: 0, focusEntry: null }

  const rows = (rawRows as unknown as PointsRow[]).filter((r) => {
    const tier = one(r.events?.event_tiers as
      | { counts_for_world_race: boolean; counts_for_national_race: boolean }
      | { counts_for_world_race: boolean; counts_for_national_race: boolean }[]
      | null)
    if (query.worldRaceOnly && !tier?.counts_for_world_race) return false
    if (query.nationalRaceOnly && !tier?.counts_for_national_race) return false
    return true
  })

  if (!rows.length) return { entries: [], total: 0, focusEntry: null }

  const memberById = new Map<string, AggMember>()
  for (const r of rows) {
    const m = one(r.members as PointsRow['members'] | PointsRow['members'][])
    if (!m || memberById.has(r.member_id)) continue
    const geo = one(m.geo_nodes as
      | { name: string; iso_alpha2: string | null; path: string }
      | { name: string; iso_alpha2: string | null; path: string }[]
      | null)
    memberById.set(r.member_id, {
      id: m.id,
      full_name: m.full_name,
      nickname: m.nickname,
      country: m.country,
      home_geo_id: m.home_geo_id,
      public_id: m.public_id ?? null,
      gender: (m.gender as Gender) ?? 'undisclosed',
      geo_path: geo?.path ?? null,
      geo_name: geo?.name ?? null,
      iso_alpha2: geo?.iso_alpha2 ?? null,
    })
  }

  const search = query.search?.trim().toLowerCase() ?? ''

  const matchesGeo = (member: AggMember) => {
    if (!query.geoPath || query.geoPath === '/WORLD') return true
    if (!member.geo_path) return false
    return (
      member.geo_path === query.geoPath ||
      member.geo_path.startsWith(query.geoPath + '/')
    )
  }

  const matchesSearch = (member: AggMember) => {
    if (!search) return true
    const hay =
      `${member.full_name} ${member.nickname ?? ''} ${member.public_id ?? ''}`.toLowerCase()
    return hay.includes(search)
  }

  const overallFiltered = rows.filter((r) => {
    const member = memberById.get(r.member_id)
    if (!member) return false
    return matchesGeo(member) && matchesSearch(member)
  })

  const overallByMember = new Map<
    string,
    { points: number[]; member: AggMember; bestSingle: number }
  >()
  for (const r of overallFiltered) {
    const member = memberById.get(r.member_id)!
    const pts = Number(r.points) || 0
    const entry = overallByMember.get(r.member_id) ?? {
      points: [] as number[],
      member,
      bestSingle: 0,
    }
    entry.points.push(pts)
    entry.bestSingle = Math.max(entry.bestSingle, pts)
    overallByMember.set(r.member_id, entry)
  }

  const counting = query.countingResults ?? null
  const overallTotals = aggregateTotals(overallByMember, counting)
  rankList(overallTotals)
  const overallRankById = new Map(overallTotals.map((t) => [t.memberId, t.rank]))

  const cohortFiltered = overallFiltered.filter((r) => {
    const member = memberById.get(r.member_id)!
    if (division === 'women') return member.gender === 'female'
    return true
  })

  const byMember = new Map<
    string,
    { points: number[]; member: AggMember; bestSingle: number }
  >()
  for (const r of cohortFiltered) {
    const member = memberById.get(r.member_id)!
    const pts = Number(r.points) || 0
    const entry = byMember.get(r.member_id) ?? {
      points: [] as number[],
      member,
      bestSingle: 0,
    }
    entry.points.push(pts)
    entry.bestSingle = Math.max(entry.bestSingle, pts)
    byMember.set(r.member_id, entry)
  }

  const totals = aggregateTotals(byMember, counting)
  rankList(totals)

  const entries: LeagueRankingEntry[] = totals.map((t) => ({
    memberId: t.memberId,
    publicId: t.publicId,
    memberName: t.memberName,
    nickname: t.nickname,
    country: t.country,
    isoAlpha2: t.isoAlpha2,
    geoName: t.geoName,
    gender: t.gender,
    totalPoints: t.totalPoints,
    eventsPlayed: t.eventsPlayed,
    rank: t.rank,
    overallRank:
      division === 'women' ? (overallRankById.get(t.memberId) ?? null) : null,
  }))

  const focusEntry = focusKey
    ? entries.find((e) => e.publicId === focusKey || e.memberId === focusKey) ?? null
    : null

  return {
    entries: entries.slice(offset, offset + limit),
    total: entries.length,
    focusEntry,
  }
}
