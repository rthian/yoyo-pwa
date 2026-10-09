/**
 * Query season league rankings — Slice C: embed competitors via competitor_id.
 * Callers: app/api/rankings/route.ts, app/api/rankings/leagues/[slug]/route.ts
 * Glob: existing lib/rankings/query.ts (rewrite embed path)
 * Sample: ranking_points.competitor_id → competitors.public_id for /players links
 * User: "ok next"
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
  eventIds?: string[] | null
  worldRaceOnly?: boolean
  nationalRaceOnly?: boolean
  /** public_id, competitor uuid, or legacy member uuid */
  focusMember?: string | null
  limit?: number
  offset?: number
}

type AggCompetitor = {
  competitorId: string
  memberId: string | null
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
  competitor_id: string
  points: number | string
  field_scope: string | null
  event_id: string
  competitors: {
    id: string
    source_member_id: string | null
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
  byCompetitor: Map<
    string,
    { points: number[]; competitor: AggCompetitor; bestSingle: number }
  >,
  counting: number | null
) {
  return [...byCompetitor.entries()].map(
    ([competitorId, { points, competitor, bestSingle }]) => {
      const sorted = [...points].sort((a, b) => b - a)
      const counted =
        counting != null && counting > 0 ? sorted.slice(0, counting) : sorted
      const totalPoints =
        Math.round(counted.reduce((a, b) => a + b, 0) * 100) / 100
      return {
        competitorId,
        memberId: competitor.memberId || competitorId,
        publicId: competitor.public_id,
        memberName: competitor.full_name,
        nickname: competitor.nickname,
        country: competitor.country,
        isoAlpha2: competitor.iso_alpha2,
        geoName: competitor.geo_name,
        gender: competitor.gender,
        totalPoints,
        eventsPlayed: points.length,
        bestSingle,
        rank: 0,
        overallRank: null as number | null,
      }
    }
  )
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
      competitor_id,
      points,
      field_scope,
      event_id,
      competitors!inner (
        id,
        source_member_id,
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
    .eq('competitors.is_active', true)
    .not('competitor_id', 'is', null)

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
    const tier = one(
      r.events?.event_tiers as
        | { counts_for_world_race: boolean; counts_for_national_race: boolean }
        | {
            counts_for_world_race: boolean
            counts_for_national_race: boolean
          }[]
        | null
    )
    if (query.worldRaceOnly && !tier?.counts_for_world_race) return false
    if (query.nationalRaceOnly && !tier?.counts_for_national_race) return false
    return true
  })

  if (!rows.length) return { entries: [], total: 0, focusEntry: null }

  const competitorById = new Map<string, AggCompetitor>()
  for (const r of rows) {
    const c = one(
      r.competitors as PointsRow['competitors'] | PointsRow['competitors'][]
    )
    const competitorId = r.competitor_id || c?.id
    if (!c || !competitorId || competitorById.has(competitorId)) continue
    const geo = one(
      c.geo_nodes as
        | { name: string; iso_alpha2: string | null; path: string }
        | { name: string; iso_alpha2: string | null; path: string }[]
        | null
    )
    competitorById.set(competitorId, {
      competitorId,
      memberId: c.source_member_id ?? null,
      full_name: c.full_name,
      nickname: c.nickname,
      country: c.country,
      home_geo_id: c.home_geo_id,
      public_id: c.public_id ?? null,
      gender: (c.gender as Gender) ?? 'undisclosed',
      geo_path: geo?.path ?? null,
      geo_name: geo?.name ?? null,
      iso_alpha2: geo?.iso_alpha2 ?? null,
    })
  }

  const search = query.search?.trim().toLowerCase() ?? ''

  const matchesGeo = (competitor: AggCompetitor) => {
    if (!query.geoPath || query.geoPath === '/WORLD') return true
    if (!competitor.geo_path) return false
    return (
      competitor.geo_path === query.geoPath ||
      competitor.geo_path.startsWith(query.geoPath + '/')
    )
  }

  const matchesSearch = (competitor: AggCompetitor) => {
    if (!search) return true
    const hay =
      `${competitor.full_name} ${competitor.nickname ?? ''} ${competitor.public_id ?? ''}`.toLowerCase()
    return hay.includes(search)
  }

  const overallFiltered = rows.filter((r) => {
    const competitorId = r.competitor_id
    if (!competitorId) return false
    const competitor = competitorById.get(competitorId)
    if (!competitor) return false
    return matchesGeo(competitor) && matchesSearch(competitor)
  })

  const overallByCompetitor = new Map<
    string,
    { points: number[]; competitor: AggCompetitor; bestSingle: number }
  >()
  for (const r of overallFiltered) {
    const competitorId = r.competitor_id!
    const competitor = competitorById.get(competitorId)!
    const pts = Number(r.points) || 0
    const entry = overallByCompetitor.get(competitorId) ?? {
      points: [] as number[],
      competitor,
      bestSingle: 0,
    }
    entry.points.push(pts)
    entry.bestSingle = Math.max(entry.bestSingle, pts)
    overallByCompetitor.set(competitorId, entry)
  }

  const counting = query.countingResults ?? null
  const overallTotals = aggregateTotals(overallByCompetitor, counting)
  rankList(overallTotals)
  const overallRankById = new Map(
    overallTotals.map((t) => [t.competitorId, t.rank])
  )

  const cohortFiltered = overallFiltered.filter((r) => {
    const competitor = competitorById.get(r.competitor_id!)!
    if (division === 'women') return competitor.gender === 'female'
    return true
  })

  const byCompetitor = new Map<
    string,
    { points: number[]; competitor: AggCompetitor; bestSingle: number }
  >()
  for (const r of cohortFiltered) {
    const competitorId = r.competitor_id!
    const competitor = competitorById.get(competitorId)!
    const pts = Number(r.points) || 0
    const entry = byCompetitor.get(competitorId) ?? {
      points: [] as number[],
      competitor,
      bestSingle: 0,
    }
    entry.points.push(pts)
    entry.bestSingle = Math.max(entry.bestSingle, pts)
    byCompetitor.set(competitorId, entry)
  }

  const totals = aggregateTotals(byCompetitor, counting)
  rankList(totals)

  const entries: LeagueRankingEntry[] = totals.map((t) => ({
    memberId: t.memberId,
    competitorId: t.competitorId,
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
      division === 'women'
        ? (overallRankById.get(t.competitorId) ?? null)
        : null,
  }))

  const focusEntry = focusKey
    ? (entries.find(
        (e) =>
          e.publicId === focusKey ||
          e.memberId === focusKey ||
          e.competitorId === focusKey
      ) ?? null)
    : null

  return {
    entries: entries.slice(offset, offset + limit),
    total: entries.length,
    focusEntry,
  }
}
