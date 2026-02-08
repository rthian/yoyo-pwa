/**
 * Database Types for YoYo Event Management System
 * TypeScript interfaces matching the Supabase schema
 */

export type MemberRole = 'admin' | 'judge' | 'member'
export type EventStatus = 'draft' | 'published' | 'active' | 'completed' | 'cancelled'
export type ScoringType = 'standard' | 'clicker' | 'head_to_head'
export type DivisionMemberStatus = 'registered' | 'checked_in' | 'playing' | 'completed' | 'withdrawn'
export type JudgeType = 'head' | 'general' | 'technical' | 'performance'
export type RoundType = 'wildcard' | 'qualifier' | 'semi_final' | 'final' | 'exhibition' | 'other'
export type ScheduleEntryType = 'ceremony' | 'break' | 'registration' | 'other'

export interface Member {
  id: string
  email: string
  full_name: string
  nickname: string | null
  role: MemberRole
  country: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  name: string
  description: string | null
  location: string | null
  event_date: string | null
  status: EventStatus
  ruleset_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Division {
  id: string
  event_id: string
  name: string
  description: string | null
  scoring_type: ScoringType
  sort_order: number
  is_active: boolean
  round_type: RoundType | null
  scheduled_start: string | null
  scheduled_end: string | null
  venue: string | null
  created_at: string
  updated_at: string
}

export interface DivisionMember {
  id: string
  division_id: string
  member_id: string
  play_order: number | null
  status: DivisionMemberStatus
  created_at: string
  updated_at: string
}

export interface DivisionJudge {
  id: string
  division_id: string
  member_id: string
  judge_type: JudgeType
  created_at: string
}

export interface Score {
  id: string
  division_id: string
  division_member_id: string
  judge_id: string
  
  // Scoring fields
  ex_clicks: number
  ex_pv: number
  ex_ch: number
  ex_cons: number
  ex_space: number
  ex_body: number
  ex_showman: number
  ex_music: number
  ex_construct: number
  ex_trick_div: number
  ex_deductions: number
  
  // Calculated totals
  technical_score: number
  performance_score: number
  total_score: number
  
  // Metadata
  is_submitted: boolean
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface Ruleset {
  id: string
  name: string
  code: string
  description: string | null
  version: string | null
  source_url: string | null
  rules_content: string | null
  scoring_config: Record<string, unknown>
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ScheduleEntry {
  id: string
  event_id: string
  title: string
  description: string | null
  entry_type: ScheduleEntryType
  scheduled_start: string | null
  scheduled_end: string | null
  venue: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface LeaderboardToken {
  id: string
  division_id: string
  token: string
  is_active: boolean
  views_count: number
  expires_at: string | null
  created_by: string | null
  created_at: string
}

export interface LeaderboardEntry {
  member_id: string
  member_name: string
  avg_technical: number
  avg_performance: number
  total_score: number
  rank: number
}

// Form types for creating/updating records
export interface MemberFormData {
  email: string
  full_name: string
  nickname?: string
  role: MemberRole
  country?: string
  is_active?: boolean
}

export interface EventFormData {
  name: string
  description?: string
  location?: string
  event_date?: string
  status?: EventStatus
  ruleset_id?: string
}

export interface DivisionFormData {
  event_id: string
  name: string
  description?: string
  scoring_type?: ScoringType
  sort_order?: number
  is_active?: boolean
  round_type?: RoundType
  scheduled_start?: string
  scheduled_end?: string
  venue?: string
}

export interface ScoreFormData {
  division_id: string
  division_member_id: string
  judge_id: string
  ex_clicks?: number
  ex_pv?: number
  ex_ch?: number
  ex_cons?: number
  ex_space?: number
  ex_body?: number
  ex_showman?: number
  ex_music?: number
  ex_construct?: number
  ex_trick_div?: number
  ex_deductions?: number
}

export interface RulesetFormData {
  name: string
  code: string
  description?: string
  version?: string
  source_url?: string
  rules_content?: string
  scoring_config: Record<string, unknown>
  is_active?: boolean
}

export interface ScheduleEntryFormData {
  event_id: string
  title: string
  description?: string
  entry_type?: ScheduleEntryType
  scheduled_start?: string
  scheduled_end?: string
  venue?: string
  sort_order?: number
}

// Extended types with relations
export interface DivisionWithEvent extends Division {
  event: Event
}

export interface DivisionMemberWithMember extends DivisionMember {
  member: Member
}

export interface DivisionJudgeWithMember extends DivisionJudge {
  member: Member
}

export interface ScoreWithDetails extends Score {
  division_member: DivisionMemberWithMember
  judge: Member
}

// Offline queue for PWA sync
export interface OfflineScoreData {
  clientId: string
  divisionMemberId: string
  judgeId: string
  scoreData: Partial<ScoreFormData>
  timestamp: number
}

export interface EventWithRuleset extends Event {
  ruleset: Ruleset | null
}

// Auth related types
export interface AuthUser {
  id: string
  email: string
  member?: Member
}
