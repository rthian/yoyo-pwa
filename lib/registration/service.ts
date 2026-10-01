/**
 * Prompt 5 registration aggregate helpers.
 * Confirmed entries sync into division_members; capacity via confirm_or_waitlist RPC.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getRegistrationAvailability } from '@/lib/events/timing'
import {
  assertManagesCompetitor,
  getCompetitorIdForMember,
} from '@/lib/identity/competitors'
import type {
  Registration,
  RegistrationEntry,
  RegistrationStatus,
} from '@/lib/types/database'

export async function getMemberIdForCompetitor(
  supabase: SupabaseClient,
  competitorId: string
): Promise<string | null> {
  const { data: competitor } = await supabase
    .from('competitors')
    .select('source_member_id')
    .eq('id', competitorId)
    .maybeSingle()
  if (competitor?.source_member_id) return competitor.source_member_id

  const { data: link } = await supabase
    .from('account_competitor_links')
    .select('account_id')
    .eq('competitor_id', competitorId)
    .eq('relationship', 'self')
    .maybeSingle()

  return link?.account_id ?? null
}

async function writeAudit(
  supabase: SupabaseClient,
  args: {
    registrationId: string
    entryId?: string | null
    actorId?: string | null
    action: string
    fromStatus?: string | null
    toStatus?: string | null
    detail?: Record<string, unknown>
  }
) {
  await supabase.from('registration_audit_events').insert({
    registration_id: args.registrationId,
    registration_entry_id: args.entryId ?? null,
    actor_account_id: args.actorId ?? null,
    action: args.action,
    from_status: args.fromStatus ?? null,
    to_status: args.toStatus ?? null,
    detail: args.detail ?? {},
  })
}

export async function getOrCreateRegistration(
  supabase: SupabaseClient,
  params: {
    eventId: string
    competitorId: string
    accountId: string
    isAdmin?: boolean
  }
): Promise<Registration> {
  await assertManagesCompetitor(
    supabase,
    params.accountId,
    params.competitorId,
    'register',
    { isAdmin: params.isAdmin }
  )

  const { data: existing } = await supabase
    .from('registrations')
    .select('*')
    .eq('event_id', params.eventId)
    .eq('competitor_id', params.competitorId)
    .maybeSingle()

  if (existing) return existing as Registration

  const { data, error } = await supabase
    .from('registrations')
    .insert({
      event_id: params.eventId,
      competitor_id: params.competitorId,
      submitted_by_account_id: params.accountId,
      status: 'draft',
    })
    .select('*')
    .single()

  if (error) {
    // Race: unique violation → re-read
    const { data: again } = await supabase
      .from('registrations')
      .select('*')
      .eq('event_id', params.eventId)
      .eq('competitor_id', params.competitorId)
      .single()
    if (again) return again as Registration
    throw error
  }

  await writeAudit(supabase, {
    registrationId: data.id,
    actorId: params.accountId,
    action: 'create',
    toStatus: 'draft',
  })

  return data as Registration
}

export async function addRegistrationEntry(
  supabase: SupabaseClient,
  params: {
    registrationId: string
    divisionId: string
    accountId: string
  }
): Promise<RegistrationEntry> {
  const { data: reg } = await supabase
    .from('registrations')
    .select('*')
    .eq('id', params.registrationId)
    .single()
  if (!reg) throw new Error('Registration not found')

  const { data: division } = await supabase
    .from('divisions')
    .select('id, event_id')
    .eq('id', params.divisionId)
    .single()
  if (!division || division.event_id !== reg.event_id) {
    throw new Error('Division does not belong to this event')
  }

  const { data, error } = await supabase
    .from('registration_entries')
    .insert({
      registration_id: params.registrationId,
      division_id: params.divisionId,
      status: 'draft',
    })
    .select('*')
    .single()

  if (error) {
    const { data: existing } = await supabase
      .from('registration_entries')
      .select('*')
      .eq('registration_id', params.registrationId)
      .eq('division_id', params.divisionId)
      .maybeSingle()
    if (existing) return existing as RegistrationEntry
    throw error
  }

  await writeAudit(supabase, {
    registrationId: params.registrationId,
    entryId: data.id,
    actorId: params.accountId,
    action: 'add_entry',
    toStatus: 'draft',
  })

  return data as RegistrationEntry
}

/**
 * Submit registration: enforce event window, then confirm-or-waitlist each draft/pending entry.
 */
export async function submitRegistration(
  supabase: SupabaseClient,
  params: {
    registrationId: string
    accountId: string
    isAdmin?: boolean
  }
): Promise<{ registration: Registration; entries: RegistrationEntry[] }> {
  const { data: reg } = await supabase
    .from('registrations')
    .select('*')
    .eq('id', params.registrationId)
    .single()
  if (!reg) throw new Error('Registration not found')

  await assertManagesCompetitor(
    supabase,
    params.accountId,
    reg.competitor_id,
    'register',
    { isAdmin: params.isAdmin }
  )

  const { data: event } = await supabase
    .from('events')
    .select(
      'id, status, event_date, starts_at, ends_at, timezone, registration_opens_at, registration_closes_at, music_deadline_at, check_in_opens_at, check_in_closes_at'
    )
    .eq('id', reg.event_id)
    .single()
  if (!event) throw new Error('Event not found')

  const availability = getRegistrationAvailability(event)
  if (!availability.open && !params.isAdmin) {
    const err = new Error('Registration window is closed')
    ;(err as Error & { status: number; reason: string }).status = 403
    ;(err as Error & { reason: string }).reason = availability.reason
    throw err
  }

  await supabase
    .from('registrations')
    .update({ status: 'pending' as RegistrationStatus })
    .eq('id', reg.id)

  const { data: entries } = await supabase
    .from('registration_entries')
    .select('*')
    .eq('registration_id', reg.id)
    .in('status', ['draft', 'pending', 'waitlisted'])

  const results: RegistrationEntry[] = []
  for (const entry of entries ?? []) {
    const { data, error } = await supabase.rpc(
      'confirm_or_waitlist_registration_entry',
      {
        p_entry_id: entry.id,
        p_actor_id: params.accountId,
      }
    )
    if (error) throw error
    results.push((Array.isArray(data) ? data[0] : data) as RegistrationEntry)
  }

  const { data: refreshed } = await supabase
    .from('registrations')
    .select('*')
    .eq('id', reg.id)
    .single()

  await writeAudit(supabase, {
    registrationId: reg.id,
    actorId: params.accountId,
    action: 'submit',
    fromStatus: reg.status,
    toStatus: refreshed?.status ?? 'pending',
  })

  return {
    registration: refreshed as Registration,
    entries: results,
  }
}

export async function cancelRegistration(
  supabase: SupabaseClient,
  params: {
    registrationId: string
    accountId: string
    reason?: string | null
    isAdmin?: boolean
  }
): Promise<Registration> {
  const { data: reg } = await supabase
    .from('registrations')
    .select('*')
    .eq('id', params.registrationId)
    .single()
  if (!reg) throw new Error('Registration not found')

  await assertManagesCompetitor(
    supabase,
    params.accountId,
    reg.competitor_id,
    'register',
    { isAdmin: params.isAdmin }
  )

  const { data: entries } = await supabase
    .from('registration_entries')
    .select('*')
    .eq('registration_id', reg.id)

  for (const entry of entries ?? []) {
    if (entry.division_member_id) {
      await supabase.from('division_members').delete().eq('id', entry.division_member_id)
    }
    await supabase
      .from('registration_entries')
      .update({
        status: 'cancelled',
        waitlist_position: null,
        division_member_id: null,
      })
      .eq('id', entry.id)
  }

  const { data: updated, error } = await supabase
    .from('registrations')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: params.reason ?? null,
    })
    .eq('id', reg.id)
    .select('*')
    .single()

  if (error) throw error

  await writeAudit(supabase, {
    registrationId: reg.id,
    actorId: params.accountId,
    action: 'cancel',
    fromStatus: reg.status,
    toStatus: 'cancelled',
    detail: { reason: params.reason ?? null },
  })

  return updated as Registration
}

/**
 * Legacy hub toggle: register account's self competitor into one division.
 */
export async function registerSelfForDivision(
  supabase: SupabaseClient,
  params: { accountId: string; divisionId: string; isAdmin?: boolean }
): Promise<{ registration: Registration; entry: RegistrationEntry }> {
  const { data: division } = await supabase
    .from('divisions')
    .select('id, event_id')
    .eq('id', params.divisionId)
    .single()
  if (!division) throw new Error('Division not found')

  let competitorId = await getCompetitorIdForMember(supabase, params.accountId)
  if (!competitorId) {
    const { data: member } = await supabase
      .from('members')
      .select('id, full_name, nickname, country, public_id, is_active')
      .eq('id', params.accountId)
      .single()
    if (!member) throw new Error('Member not found')
    const { ensureSelfCompetitorForMember } = await import(
      '@/lib/identity/competitors'
    )
    const created = await ensureSelfCompetitorForMember(supabase, member)
    competitorId = created.competitor.id
  }

  const registration = await getOrCreateRegistration(supabase, {
    eventId: division.event_id,
    competitorId,
    accountId: params.accountId,
    isAdmin: params.isAdmin,
  })

  const entry = await addRegistrationEntry(supabase, {
    registrationId: registration.id,
    divisionId: params.divisionId,
    accountId: params.accountId,
  })

  const submitted = await submitRegistration(supabase, {
    registrationId: registration.id,
    accountId: params.accountId,
    isAdmin: params.isAdmin,
  })

  const updatedEntry =
    submitted.entries.find((e) => e.division_id === params.divisionId) || entry

  return { registration: submitted.registration, entry: updatedEntry }
}
