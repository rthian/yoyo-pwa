/**
 * Prompt 16: organizer self-service access helpers.
 * Callers: app/(organizer)/*, app/api/organize/events
 * Glob: no prior lib/organize/*
 * Sample: { id: "evt_demo", name: "Demo Open", roles: ["organizer"] }
 * User: "ok continue next"
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  EVENT_CAPABILITY_ROLES,
  getActiveEventRoles,
  rolesGrantCapability,
} from '@/lib/auth/event-permissions'
import type { EventCapability, EventStaffRole } from '@/lib/types/database'

export type StaffEventSummary = {
  id: string
  name: string
  status: string
  event_date: string | null
  starts_at: string | null
  location: string | null
  venue_name: string | null
  timezone: string | null
  roles: EventStaffRole[]
}

export async function isGlobalAdminAccount(
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

/** True if account is global admin or has any active event_staff_roles row. */
export async function canAccessOrganizeArea(
  supabase: SupabaseClient,
  accountId: string
): Promise<boolean> {
  if (await isGlobalAdminAccount(supabase, accountId)) return true
  const { count, error } = await supabase
    .from('event_staff_roles')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .is('revoked_at', null)
  if (error) throw error
  return (count ?? 0) > 0
}

export async function listStaffEventsForAccount(
  supabase: SupabaseClient,
  accountId: string,
  options?: { isAdmin?: boolean }
): Promise<StaffEventSummary[]> {
  if (options?.isAdmin) {
    const { data, error } = await supabase
      .from('events')
      .select(
        'id, name, status, event_date, starts_at, location, venue_name, timezone'
      )
      .order('starts_at', { ascending: false, nullsFirst: false })
      .limit(100)
    if (error) throw error
    return (data ?? []).map((e) => ({
      ...e,
      roles: ['owner'] as EventStaffRole[],
    }))
  }

  const { data: staffRows, error: staffErr } = await supabase
    .from('event_staff_roles')
    .select('event_id, role')
    .eq('account_id', accountId)
    .is('revoked_at', null)

  if (staffErr) throw staffErr
  if (!staffRows?.length) return []

  const rolesByEvent = new Map<string, EventStaffRole[]>()
  for (const row of staffRows) {
    const list = rolesByEvent.get(row.event_id) ?? []
    list.push(row.role as EventStaffRole)
    rolesByEvent.set(row.event_id, list)
  }

  const eventIds = [...rolesByEvent.keys()]
  const { data: events, error: eventsErr } = await supabase
    .from('events')
    .select(
      'id, name, status, event_date, starts_at, location, venue_name, timezone'
    )
    .in('id', eventIds)
    .order('starts_at', { ascending: false, nullsFirst: false })

  if (eventsErr) throw eventsErr

  return (events ?? []).map((e) => ({
    ...e,
    roles: rolesByEvent.get(e.id) ?? [],
  }))
}

export type OrganizeCaps = Record<EventCapability, boolean>

export async function resolveOrganizeCaps(
  supabase: SupabaseClient,
  accountId: string,
  eventId: string
): Promise<{
  isAdmin: boolean
  roles: EventStaffRole[]
  caps: OrganizeCaps
  canView: boolean
}> {
  const isAdmin = await isGlobalAdminAccount(supabase, accountId)
  const roles = isAdmin
    ? (['owner'] as EventStaffRole[])
    : await getActiveEventRoles(supabase, accountId, eventId)

  const allCaps = Object.keys(EVENT_CAPABILITY_ROLES) as EventCapability[]
  const caps = {} as OrganizeCaps
  for (const c of allCaps) {
    caps[c] = rolesGrantCapability(roles, c, { isAdmin })
  }

  return {
    isAdmin,
    roles,
    caps,
    canView: isAdmin || caps.view_ops,
  }
}
