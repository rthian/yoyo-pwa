/**
 * Prompt 3 Slice 1: event-scoped staff permissions.
 * Global admin always wins. Roles live on accounts (members), not competitors.
 * Callers: future event/division APIs and admin staff UI (Slice 2+).
 * Capability map must stay in sync with has_event_capability() in 012_event_staff_roles.sql.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  EventCapability,
  EventStaffRole,
  EventStaffRoleRow,
} from '@/lib/types/database'

export const EVENT_STAFF_ROLES: EventStaffRole[] = [
  'owner',
  'organizer',
  'registration_manager',
  'music_manager',
  'head_judge',
  'stage_manager',
  'readonly_staff',
]

/** Capability → roles that grant it (admin always implied in helpers). */
export const EVENT_CAPABILITY_ROLES: Record<EventCapability, EventStaffRole[]> = {
  manage_event: ['owner', 'organizer'],
  manage_staff: ['owner'],
  delete_event: ['owner'],
  cancel_event: ['owner'],
  manage_divisions: ['owner', 'organizer'],
  assign_judges: ['owner', 'organizer', 'head_judge'],
  manage_registration: ['owner', 'organizer', 'registration_manager'],
  manage_music: ['owner', 'organizer', 'music_manager'],
  manage_schedule: ['owner', 'organizer', 'stage_manager'],
  manage_play_order: ['owner', 'organizer', 'registration_manager', 'stage_manager'],
  check_in: ['owner', 'organizer', 'registration_manager', 'stage_manager'],
  lock_scores: ['owner', 'head_judge'],
  view_ops: [
    'owner',
    'organizer',
    'registration_manager',
    'music_manager',
    'head_judge',
    'stage_manager',
    'readonly_staff',
  ],
  finalize_results: ['owner'],
  unfinalize_results: [], // admin only
  publish_results: ['owner', 'organizer'],
  manage_leaderboard_tokens: ['owner', 'organizer', 'head_judge'],
}

export class EventPermissionError extends Error {
  status: number

  constructor(message: string, status = 403) {
    super(message)
    this.name = 'EventPermissionError'
    this.status = status
  }
}

async function isGlobalAdmin(
  supabase: SupabaseClient,
  accountId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('members')
    .select('role')
    .eq('id', accountId)
    .maybeSingle()
  return data?.role === 'admin'
}

export async function getActiveEventRoles(
  supabase: SupabaseClient,
  accountId: string,
  eventId: string
): Promise<EventStaffRole[]> {
  const { data, error } = await supabase
    .from('event_staff_roles')
    .select('role')
    .eq('event_id', eventId)
    .eq('account_id', accountId)
    .is('revoked_at', null)

  if (error) throw error
  return (data ?? []).map((r) => r.role as EventStaffRole)
}

export async function listEventStaff(
  supabase: SupabaseClient,
  eventId: string,
  options?: { includeRevoked?: boolean }
): Promise<EventStaffRoleRow[]> {
  let query = supabase
    .from('event_staff_roles')
    .select('*')
    .eq('event_id', eventId)
    .order('granted_at', { ascending: true })

  if (!options?.includeRevoked) {
    query = query.is('revoked_at', null)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as EventStaffRoleRow[]
}

export async function hasEventCapability(
  supabase: SupabaseClient,
  accountId: string,
  eventId: string,
  capability: EventCapability
): Promise<boolean> {
  if (await isGlobalAdmin(supabase, accountId)) return true

  const allowed = EVENT_CAPABILITY_ROLES[capability]
  if (!allowed.length) return false

  const roles = await getActiveEventRoles(supabase, accountId, eventId)
  return roles.some((r) => allowed.includes(r))
}

/**
 * Lock / visualiser / triage: event head_judge OR division head assignment OR admin.
 */
export async function canLockDivisionScores(
  supabase: SupabaseClient,
  accountId: string,
  eventId: string,
  divisionId: string
): Promise<boolean> {
  if (await hasEventCapability(supabase, accountId, eventId, 'lock_scores')) {
    return true
  }

  const { data } = await supabase
    .from('division_judges')
    .select('judge_type')
    .eq('division_id', divisionId)
    .eq('member_id', accountId)
    .maybeSingle()

  return data?.judge_type === 'head'
}

export async function assertEventCapability(
  supabase: SupabaseClient,
  accountId: string,
  eventId: string,
  capability: EventCapability
): Promise<void> {
  const ok = await hasEventCapability(supabase, accountId, eventId, capability)
  if (!ok) {
    throw new EventPermissionError(`Missing event capability: ${capability}`)
  }
}

export async function resolveEventIdForDivision(
  supabase: SupabaseClient,
  divisionId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('divisions')
    .select('event_id')
    .eq('id', divisionId)
    .maybeSingle()
  return data?.event_id ?? null
}

/**
 * Grant a staff role. Owner role: global admin only.
 * Soft-revoked rows are reactivated rather than duplicated.
 */
export async function grantEventRole(
  supabase: SupabaseClient,
  params: {
    eventId: string
    accountId: string
    role: EventStaffRole
    actorId: string
    note?: string | null
  }
): Promise<EventStaffRoleRow> {
  const { eventId, accountId, role, actorId, note } = params

  if (role === 'owner') {
    if (!(await isGlobalAdmin(supabase, actorId))) {
      throw new EventPermissionError('Only global admins can grant owner')
    }
  } else {
    await assertEventCapability(supabase, actorId, eventId, 'manage_staff')
  }

  const { data: existing } = await supabase
    .from('event_staff_roles')
    .select('*')
    .eq('event_id', eventId)
    .eq('account_id', accountId)
    .eq('role', role)
    .is('revoked_at', null)
    .maybeSingle()

  if (existing) {
    return existing as EventStaffRoleRow
  }

  const { data: revoked } = await supabase
    .from('event_staff_roles')
    .select('*')
    .eq('event_id', eventId)
    .eq('account_id', accountId)
    .eq('role', role)
    .not('revoked_at', 'is', null)
    .order('revoked_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let row: EventStaffRoleRow

  if (revoked) {
    const { data, error } = await supabase
      .from('event_staff_roles')
      .update({
        revoked_at: null,
        revoked_by: null,
        granted_by: actorId,
        granted_at: new Date().toISOString(),
      })
      .eq('id', revoked.id)
      .select('*')
      .single()
    if (error) throw error
    row = data as EventStaffRoleRow
  } else {
    const { data, error } = await supabase
      .from('event_staff_roles')
      .insert({
        event_id: eventId,
        account_id: accountId,
        role,
        granted_by: actorId,
      })
      .select('*')
      .single()
    if (error) throw error
    row = data as EventStaffRoleRow
  }

  await supabase.from('event_staff_role_audit').insert({
    event_id: eventId,
    account_id: accountId,
    role,
    action: 'grant',
    actor_id: actorId,
    note: note ?? null,
  })

  return row
}

export async function revokeEventRole(
  supabase: SupabaseClient,
  params: {
    eventId: string
    accountId: string
    role: EventStaffRole
    actorId: string
    note?: string | null
  }
): Promise<EventStaffRoleRow | null> {
  const { eventId, accountId, role, actorId, note } = params

  if (role === 'owner') {
    if (!(await isGlobalAdmin(supabase, actorId))) {
      throw new EventPermissionError('Only global admins can revoke owner')
    }
  } else {
    await assertEventCapability(supabase, actorId, eventId, 'manage_staff')
  }

  const { data: existing } = await supabase
    .from('event_staff_roles')
    .select('*')
    .eq('event_id', eventId)
    .eq('account_id', accountId)
    .eq('role', role)
    .is('revoked_at', null)
    .maybeSingle()

  if (!existing) return null

  const { data, error } = await supabase
    .from('event_staff_roles')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: actorId,
    })
    .eq('id', existing.id)
    .select('*')
    .single()

  if (error) throw error

  await supabase.from('event_staff_role_audit').insert({
    event_id: eventId,
    account_id: accountId,
    role,
    action: 'revoke',
    actor_id: actorId,
    note: note ?? null,
  })

  return data as EventStaffRoleRow
}
