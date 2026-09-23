/**
 * League ranking types — FIP-style season points
 * Schema: supabase/migrations/004_league_rankings.sql
 *
 * Callers: lib/rankings/standings.ts, finalize.ts, query.ts;
 *          app/api/rankings/*, app/rankings/page.tsx
 * User request: create a branch… plan & build a ranking with point system league leaderboards…
 */

export type GeoLevel = 'world' | 'region' | 'country' | 'state'
export type PointsRoundType = 'wildcard' | 'qualifier' | 'semi_final' | 'final'
export type Gender = 'female' | 'male' | 'other' | 'undisclosed'
export type Eligibility = 'open' | 'women' | 'youth' | 'masters'
export type FieldScope = 'championship' | 'invitational'
export type DivisionFilter = 'open' | 'women'

export interface PlayCategory {
  id: string
  code: string
  name: string
  is_championship: boolean
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface GeoNode {
  id: string
  parent_id: string | null
  level: GeoLevel
  code: string
  name: string
  iso_alpha2: string | null
  path: string
  sort_order: number
  created_at: string
}

export interface Season {
  id: string
  name: string
  slug: string
  starts_on: string
  ends_on: string
  is_active: boolean
  points_table_id: string | null
  counting_results: number | null
  min_field_size?: number | null
  created_at: string
  updated_at: string
}

/** Admin-curated participation race (placeholder name; not World/National Race). */
export type CustomLeagueEligibility = 'open' | 'home_geo'

export interface CustomLeague {
  id: string
  season_id: string
  name: string
  slug: string
  description: string | null
  counting_results: number | null
  eligibility_mode: CustomLeagueEligibility
  home_geo_id: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CustomLeagueEvent {
  league_id: string
  event_id: string
  sort_order: number
  added_at: string
}

export interface EventTier {
  id: string
  code: string
  name: string
  multiplier: number
  sort_order: number
  counts_for_world_race?: boolean
  counts_for_national_race?: boolean
}

export interface PointsTable {
  id: string
  name: string
  code: string
  description: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PointsTableRow {
  id: string
  points_table_id: string
  round_type: PointsRoundType
  placement_from: number
  placement_to: number
  points: number
}

export interface DivisionResult {
  id: string
  division_id: string
  member_id: string
  placement: number | null
  total_score: number | null
  score_count: number
  source: 'auto' | 'manual'
  created_at: string
}

export interface RankingPoints {
  id: string
  season_id: string
  event_id: string
  category_id: string
  member_id: string
  division_id: string | null
  round_type: string
  placement: number | null
  field_size: number | null
  base_points: number
  bonus_points: number
  multiplier: number
  points: number
  representing_geo_id: string | null
  event_date: string | null
  awarded_at: string
  notes: string | null
  eligibility?: Eligibility
  field_scope?: FieldScope
}

export interface LeagueRankingEntry {
  memberId: string
  publicId: string | null
  memberName: string
  nickname: string | null
  country: string | null
  isoAlpha2: string | null
  geoName: string | null
  gender: Gender | null
  totalPoints: number
  eventsPlayed: number
  rank: number
  overallRank: number | null
}

export interface LeagueStandingsRow {
  memberId: string
  totalScore: number
  scoreCount: number
  placement: number | null
}

export interface PlayerProfile {
  id: string
  publicId: string | null
  fullName: string
  nickname: string | null
  country: string | null
  isoAlpha2: string | null
  geoName: string | null
  gender: Gender | null
  bio: string | null
  avatarUrl: string | null
  firstCompetedOn: string | null
  memberSince: string
  seasonRanks: {
    seasonSlug: string
    seasonName: string
    categoryCode: string
    worldRank: number | null
    regionRank: number | null
    countryRank: number | null
    totalPoints: number
  }[]
  results: {
    eventId: string
    divisionId: string | null
    eventName: string
    eventDate: string | null
    categoryCode: string
    roundType: string
    placement: number | null
    fieldSize: number | null
    points: number
    eligibility: string
    tierName: string | null
  }[]
  titles: {
    seasonName: string
    categoryCode: string
    titleKind: string
    rank: number
  }[]
  careerPoints: number
  eventsPlayed: number
}
