/**
 * Database Types for YoYo League
 * TypeScript interfaces matching the Supabase schema
 */

export type MemberRole = 'admin' | 'judge' | 'member'
export type EventStatus = 'draft' | 'published' | 'active' | 'completed' | 'cancelled'
export type ScoringType = 'standard' | 'clicker' | 'head_to_head'
export type DivisionMemberStatus = 'registered' | 'checked_in' | 'playing' | 'completed' | 'withdrawn'
export type JudgeType = 'head' | 'general' | 'technical' | 'performance' | 'shadow'
export type RoundType = 'wildcard' | 'qualifier' | 'semi_final' | 'final' | 'exhibition' | 'other'
export type ScheduleEntryType = 'ceremony' | 'break' | 'registration' | 'other'
/** Slice A identity: account→competitor relationship */
export type CompetitorRelationship = 'self' | 'guardian' | 'manager' | 'coach'
export type CompetitorCapability = 'any' | 'register' | 'music' | 'profile'
export type ProfileVisibility = 'public' | 'members_only' | 'private'

/** Prompt 5 registration aggregate */
export type RegistrationStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'waitlisted'
  | 'cancelled'
  | 'rejected'
  | 'checked_in'

export type EligibilityStatus =
  | 'not_reviewed'
  | 'pending'
  | 'eligible'
  | 'ineligible'
  | 'needs_info'

export type PaymentStatusPlaceholder =
  | 'not_required'
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'waived'
  | 'refunded'

export type WaiverStatusPlaceholder =
  | 'not_required'
  | 'pending'
  | 'signed'
  | 'declined'

export type RegistrationEntryStatus = RegistrationStatus

/** Prompt 3: event-scoped staff roles (accounts, not competitors) */
export type EventStaffRole =
  | 'owner'
  | 'organizer'
  | 'registration_manager'
  | 'music_manager'
  | 'head_judge'
  | 'stage_manager'
  | 'readonly_staff'

export type EventCapability =
  | 'manage_event'
  | 'manage_staff'
  | 'delete_event'
  | 'cancel_event'
  | 'manage_divisions'
  | 'assign_judges'
  | 'manage_registration'
  | 'manage_music'
  | 'manage_schedule'
  | 'manage_play_order'
  | 'check_in'
  | 'lock_scores'
  | 'view_ops'
  | 'finalize_results'
  | 'unfinalize_results'
  | 'publish_results'
  | 'manage_leaderboard_tokens'

export type EventStaffRoleAuditAction = 'grant' | 'revoke'

export interface Member {
  id: string
  email: string
  full_name: string
  nickname: string | null
  role: MemberRole
  country: string | null
  home_geo_id?: string | null
  gender?: 'female' | 'male' | 'other' | 'undisclosed' | null
  public_id?: string | null
  avatar_url?: string | null
  bio?: string | null
  profile_visibility?: ProfileVisibility | null
  first_competed_on?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Persistent competition identity (Slice A). Not an Auth UID. */
export interface Competitor {
  id: string
  source_member_id?: string | null
  public_id: string | null
  full_name: string
  nickname: string | null
  country: string | null
  home_geo_id: string | null
  gender: 'female' | 'male' | 'other' | 'undisclosed' | null
  avatar_url: string | null
  bio: string | null
  profile_visibility: ProfileVisibility
  date_of_birth: string | null
  first_competed_on: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AccountCompetitorLink {
  id: string
  account_id: string
  competitor_id: string
  relationship: CompetitorRelationship
  can_register: boolean
  can_manage_music: boolean
  can_manage_profile: boolean
  granted_by: string | null
  created_at: string
}

export interface Event {
  id: string
  name: string
  description: string | null
  location: string | null
  event_date: string | null
  starts_at?: string | null
  ends_at?: string | null
  timezone?: string | null
  registration_opens_at?: string | null
  registration_closes_at?: string | null
  music_deadline_at?: string | null
  check_in_opens_at?: string | null
  check_in_closes_at?: string | null
  venue_name?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  region?: string | null
  postal_code?: string | null
  country_code?: string | null
  website_url?: string | null
  social_links?: Record<string, string> | null
  organizer_contact_name?: string | null
  organizer_contact_email?: string | null
  organizer_contact_public?: boolean | null
  status: EventStatus
  ruleset_id: string | null
  season_id?: string | null
  tier_id?: string | null
  geo_id?: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface EventStaffRoleRow {
  id: string
  event_id: string
  account_id: string
  role: EventStaffRole
  granted_by: string | null
  granted_at: string
  revoked_at: string | null
  revoked_by: string | null
  created_at: string
}

export interface EventStaffRoleAudit {
  id: string
  event_id: string
  account_id: string
  role: EventStaffRole
  action: EventStaffRoleAuditAction
  actor_id: string | null
  note: string | null
  created_at: string
}

export interface Division {
  id: string
  event_id: string
  name: string
  description: string | null
  scoring_type: ScoringType
  sort_order: number
  is_active: boolean
  scoring_locked?: boolean
  hide_scores_until_complete?: boolean
  round_type: RoundType | null
  scheduled_start: string | null
  scheduled_end: string | null
  venue: string | null
  category_id?: string | null
  eligibility?: 'open' | 'women' | 'youth' | 'masters' | null
  field_scope?: 'championship' | 'invitational' | null
  capacity?: number | null
  waitlist_enabled?: boolean
  track_id?: string | null
  stage_order?: number
  allow_direct_entry?: boolean
  created_at: string
  updated_at: string
}

export interface Registration {
  id: string
  event_id: string
  competitor_id: string
  submitted_by_account_id: string | null
  status: RegistrationStatus
  eligibility_status: EligibilityStatus
  payment_status: PaymentStatusPlaceholder
  waiver_status: WaiverStatusPlaceholder
  cancelled_at: string | null
  cancellation_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RegistrationEntry {
  id: string
  registration_id: string
  division_id: string
  status: RegistrationEntryStatus
  waitlist_position: number | null
  division_member_id: string | null
  created_at: string
  updated_at: string
}

export interface RegistrationAuditEvent {
  id: string
  registration_id: string
  registration_entry_id: string | null
  actor_account_id: string | null
  action: string
  from_status: string | null
  to_status: string | null
  detail: Record<string, unknown>
  created_at: string
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
  scores_included_in_leaderboard?: boolean
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
  md_stop_count?: number
  md_discard_count?: number
  md_detach_count?: number
  
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
  season_id?: string | null
  tier_id?: string | null
  geo_id?: string | null
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
  category_id?: string | null
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
