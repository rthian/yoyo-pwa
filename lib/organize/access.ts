/**
 * Prompt 16: organizer (/organize) access helpers for event staff.
 *
 * GateGuard facts:
 * 1. Callers: app/(organizer)/layout.tsx, organize/page.tsx,
 *    organize/events/[id]/page.tsx (+ edit/divisions), app/api/organize/events/route.ts
 * 2. Glob: no prior lib/organize/* (complements lib/auth/event-permissions.ts)
 * 3. Sample staffed event: { id: "evt_demo", name: "Nationals", roles: ["organizer"],
 *    starts_at: "2026-06-01T09:00:00Z" }
 * 4. User: "ok let do Prompt 16"
 */
import { redirect, notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  EVENT_CAPABILITY_ROLES,
  getActiveEventRoles,
  hasEventCapability,
} from '@/lib/auth/event-permissions'
import type {
  Event,
  EventCapability,
  EventStaffRole,
  Member,
} from '@/lib/types/database'
import { ACCOUNT_MEMBER_COLUMNS } from '@/lib/identity/account-profile'

export type EventCapabilities = Record<EventCapability, boolean>

export type StaffedEventSummary = {
  id: string
  name: string
  status: Event['status']
  event_date: string | null
  starts_at: string | null
  timezone: string | null
  venue_name: string | null
  location: string | null
  roles: EventStaffRole[]
  capabilities: EventCapabilities
}

const ALL_CAPABILITIES = Object.keys(
  EVENT_CAPABILITY_ROLES
) as EventCapability[]

export function emptyCapabilities(): EventCapabilities {
  return Object.fromEntries(
    ALL_CAPABILITIES.map((c) => [c, false])
  ) as EventCapabilities
}

export async function resolveEventCapabilities(
  supabase: SupabaseClient,
  accountId: string,
  eventId: string
): Promise<{ roles: EventStaffRole[]; capabilities: EventCapabilities }> {
  const roles = await getActiveEventRoles(supabase, accountId, eventId)
  const capabilities = emptyCapabilities()
  await Promise.all(
    ALL_CAPABILITIES.map(async (cap) => {
      capabilities[cap] = await hasEventCapability(
        supabase,
        accountId,
        eventId,
        cap
      )
    })
  )
  return { roles, capabilities }
}

export async function hasAnyEventStaff(
  supabase: SupabaseClient,
  accountId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('event_staff_roles')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .is('revoked_at', null)

  if (error) throw error
  return (count ?? 0) > 0
}

export async function listStaffedEvents(
  supabase: SupabaseClient,
  accountId: string
): Promise<StaffedEventSummary[]> {
  const { data: staffRows, error } = await supabase
    .from('event_staff_roles')
    .select('event_id, role')
    .eq('account_id', accountId)
    .is('revoked_at', null)

  if (error) throw error
  if (!staffRows?.length) return []

  const rolesByEvent = new Map<string, EventStaffRole[]>()
  for (const row of staffRows) {
    const list = rolesByEvent.get(row.event_id) ?? []
    list.push(row.role as EventStaffRole)
    rolesByEvent.set(row.event_id, list)
  }

  const eventIds = [...rolesByEvent.keys()]
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select(
      'id, name, status, event_date, starts_at, timezone, venue_name, location'
    )
    .in('id', eventIds)
    .order('starts_at', { ascending: false, nullsFirst: false })

  if (eventsError) throw eventsError

  const summaries: StaffedEventSummary[] = []
  for (const event of events ?? []) {
    const roles = [...new Set(rolesByEvent.get(event.id) ?? [])]
    const { capabilities } = await resolveEventCapabilities(
      supabase,
      accountId,
      event.id
    )
    summaries.push({
      id: event.id,
      name: event.name,
      status: event.status,
      event_date: event.event_date,
      starts_at: event.starts_at,
      timezone: event.timezone,
      venue_name: event.venue_name,
      location: event.location,
      roles,
      capabilities,
    })
  }

  return summaries
}

export async function getOrganizeSession(): Promise<{
  userId: string
  member: Pick<Member, 'id' | 'email' | 'full_name' | 'role' | 'is_active'>
  supabaseAdmin: ReturnType<typeof createAdminClient>
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/organize')
  }

  const supabaseAdmin = createAdminClient()
  const { data: member } = await supabaseAdmin
    .from('members')
    .select(ACCOUNT_MEMBER_COLUMNS)
    .eq('id', user.id)
    .single()

  if (!member || !member.is_active) {
    redirect('/unauthorized')
  }

  return {
    userId: user.id,
    member: member as Pick<
      Member,
      'id' | 'email' | 'full_name' | 'role' | 'is_active'
    >,
    supabaseAdmin,
  }
}

/** Layout: staff assignment OR global admin. */
export async function requireOrganizeLayoutAccess() {
  const session = await getOrganizeSession()
  const staffed = await hasAnyEventStaff(session.supabaseAdmin, session.userId)
  if (!staffed && session.member.role !== 'admin') {
    redirect('/unauthorized')
  }
  return session
}

export async function requireEventStaff(
  eventId: string,
  minCapability: EventCapability = 'view_ops'
) {
  const session = await getOrganizeSession()
  const { data: event, error } = await session.supabaseAdmin
    .from('events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle()

  if (error || !event) notFound()

  const ok = await hasEventCapability(
    session.supabaseAdmin,
    session.userId,
    eventId,
    minCapability
  )
  if (!ok) redirect('/unauthorized')

  const { roles, capabilities } = await resolveEventCapabilities(
    session.supabaseAdmin,
    session.userId,
    eventId
  )

  return { ...session, event: event as Event, roles, capabilities }
}
