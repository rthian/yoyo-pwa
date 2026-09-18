/**
 * Zod Validation Schemas
 * Form validation schemas for the YoYo League system
 */
import { z } from 'zod'

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export type LoginFormData = z.infer<typeof loginSchema>

// Member schemas
export const memberSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  nickname: z.string().optional(),
  role: z.enum(['admin', 'judge', 'member']),
  country: z.string().optional(),
  is_active: z.boolean(),
})

export type MemberFormData = z.infer<typeof memberSchema>

// Event schemas
export const eventSchema = z.object({
  name: z.string().min(2, 'Event name must be at least 2 characters'),
  description: z.string().optional(),
  location: z.string().optional(),
  event_date: z.string().optional(),
  status: z.enum(['draft', 'published', 'active', 'completed', 'cancelled']),
  ruleset_id: z.string().uuid('Invalid ruleset ID').optional().nullable(),
})

export type EventFormData = z.infer<typeof eventSchema>

// Division schemas
export const divisionSchema = z.object({
  event_id: z.string().uuid('Invalid event ID'),
  name: z.string().min(2, 'Division name must be at least 2 characters'),
  description: z.string().optional(),
  scoring_type: z.enum(['standard', 'clicker', 'head_to_head']),
  sort_order: z.number().int(),
  is_active: z.boolean(),
  scoring_locked: z.boolean().optional(),
  hide_scores_until_complete: z.boolean().optional(),
  round_type: z.enum(['wildcard', 'qualifier', 'semi_final', 'final', 'exhibition', 'other']).optional().nullable(),
  scheduled_start: z.string().optional().nullable(),
  scheduled_end: z.string().optional().nullable(),
  venue: z.string().optional().nullable(),
})

export type DivisionFormData = z.infer<typeof divisionSchema>

// Score schemas
export const scoreSchema = z.object({
  division_id: z.string().uuid('Invalid division ID'),
  division_member_id: z.string().uuid('Invalid member ID'),
  judge_id: z.string().uuid('Invalid judge ID'),
  
  // Scoring fields with validation
  ex_clicks: z.number().int().min(0).max(999).default(0),
  ex_pv: z.number().min(0).max(10).default(0),
  ex_ch: z.number().min(0).max(10).default(0),
  ex_cons: z.number().min(0).max(10).default(0),
  ex_space: z.number().min(0).max(10).default(0),
  ex_body: z.number().min(0).max(10).default(0),
  ex_showman: z.number().min(0).max(10).default(0),
  ex_music: z.number().min(0).max(10).default(0),
  ex_construct: z.number().min(0).max(10).default(0),
  ex_trick_div: z.number().min(0).max(10).default(0),
  ex_deductions: z.number().int().min(0).max(50).default(0),
})

export type ScoreFormData = z.infer<typeof scoreSchema>

// Partial score for updates
export const partialScoreSchema = scoreSchema.partial().extend({
  division_member_id: z.string().uuid('Invalid member ID'),
  judge_id: z.string().uuid('Invalid judge ID'),
})

export type PartialScoreFormData = z.infer<typeof partialScoreSchema>

// Division member assignment
export const divisionMemberSchema = z.object({
  division_id: z.string().uuid('Invalid division ID'),
  member_id: z.string().uuid('Invalid member ID'),
  play_order: z.number().int().optional(),
  status: z.enum(['registered', 'checked_in', 'playing', 'completed', 'withdrawn']).default('registered'),
})

export type DivisionMemberFormData = z.infer<typeof divisionMemberSchema>

// Division judge assignment
export const divisionJudgeSchema = z.object({
  division_id: z.string().uuid('Invalid division ID'),
  member_id: z.string().uuid('Invalid member ID'),
  judge_type: z.enum(['head', 'general', 'technical', 'performance', 'shadow']).default('general'),
})

export type DivisionJudgeFormData = z.infer<typeof divisionJudgeSchema>

// Leaderboard token
export const leaderboardTokenSchema = z.object({
  division_id: z.string().uuid('Invalid division ID'),
  expires_at: z.string().datetime().optional(),
})

export type LeaderboardTokenFormData = z.infer<typeof leaderboardTokenSchema>

// Ruleset schemas
export const rulesetSchema = z.object({
  name: z.string().min(2, 'Ruleset name must be at least 2 characters'),
  code: z.string().min(2, 'Ruleset code must be at least 2 characters').regex(/^[A-Z0-9_]+$/, 'Code must be uppercase letters, numbers, and underscores only'),
  description: z.string().optional(),
  version: z.string().optional(),
  source_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  rules_content: z.string().optional(),
  scoring_config: z.record(z.string(), z.unknown()).default({}),
  is_active: z.boolean().default(true),
})

export type RulesetFormData = z.infer<typeof rulesetSchema>

// Schedule entry schemas
export const scheduleEntrySchema = z.object({
  event_id: z.string().uuid('Invalid event ID'),
  title: z.string().min(2, 'Title must be at least 2 characters'),
  description: z.string().optional(),
  entry_type: z.enum(['ceremony', 'break', 'registration', 'other']).default('other'),
  scheduled_start: z.string().optional().nullable(),
  scheduled_end: z.string().optional().nullable(),
  venue: z.string().optional().nullable(),
  sort_order: z.number().int().default(0),
})

export type ScheduleEntryFormData = z.infer<typeof scheduleEntrySchema>
