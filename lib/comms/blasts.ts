import type { SupabaseClient } from '@supabase/supabase-js'
import { enqueueComms, resolveAccountEmail } from '@/lib/comms/outbox'
import { getNotificationPreferences, prefAllows } from '@/lib/comms/preferences'
import { eventHubUrl, renderCommsTemplate } from '@/lib/comms/templates'
import type { BlastSegment } from '@/lib/comms/types'

const RATE_LIMIT_PER_HOUR = 5

export async function previewBlastRecipients(
  supabase: SupabaseClient,
  args: {
    eventId: string
    segment: BlastSegment
    divisionId?: string | null
  }
): Promise<{ accountId: string; email: string; registrationId: string }[]> {
  let query = supabase
    .from('registrations')
    .select(
      `
      id, competitor_id, payment_status, status,
      entries:registration_entries(id, status, division_id)
    `
    )
    .eq('event_id', args.eventId)
    .not('status', 'eq', 'cancelled')

  const { data: regs, error } = await query
  if (error) throw new Error(error.message)

  const filtered = (regs ?? []).filter((reg) => {
    const entries = (reg.entries as Array<{
      status: string
      division_id: string
    }>) ?? []
    switch (args.segment) {
      case 'all_registered':
        return true
      case 'unpaid':
        return reg.payment_status === 'unpaid' || reg.payment_status === 'pending'
      case 'waitlisted':
        return (
          reg.status === 'waitlisted' ||
          entries.some((e) => e.status === 'waitlisted')
        )
      case 'confirmed':
        return (
          reg.status === 'confirmed' ||
          entries.some((e) => e.status === 'confirmed')
        )
      case 'by_division':
        if (!args.divisionId) return false
        return entries.some((e) => e.division_id === args.divisionId)
      default:
        return false
    }
  })

  const out: { accountId: string; email: string; registrationId: string }[] = []
  const seen = new Set<string>()

  for (const reg of filtered) {
    const { data: links } = await supabase
      .from('account_competitor_links')
      .select('account_id')
      .eq('competitor_id', reg.competitor_id)
      .eq('can_register', true)

    for (const link of links ?? []) {
      const accountId = link.account_id as string
      if (seen.has(accountId)) continue
      const prefs = await getNotificationPreferences(supabase, accountId)
      if (!prefAllows(prefs, 'blast')) continue
      const email = await resolveAccountEmail(supabase, accountId)
      if (!email) continue
      seen.add(accountId)
      out.push({
        accountId,
        email,
        registrationId: reg.id as string,
      })
    }
  }
  return out
}

export async function sendOrganizerBlast(
  supabase: SupabaseClient,
  args: {
    eventId: string
    actorId: string
    segment: BlastSegment
    divisionId?: string | null
    subject: string
    body: string
  }
) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('event_comms_log')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', args.eventId)
    .gte('created_at', since)

  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    const err = new Error(
      `Blast rate limit: max ${RATE_LIMIT_PER_HOUR} per event per hour`
    )
    ;(err as Error & { status: number }).status = 429
    throw err
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, name')
    .eq('id', args.eventId)
    .maybeSingle()
  if (!event) {
    const err = new Error('Event not found')
    ;(err as Error & { status: number }).status = 404
    throw err
  }

  const recipients = await previewBlastRecipients(supabase, {
    eventId: args.eventId,
    segment: args.segment,
    divisionId: args.divisionId,
  })

  const outboxIds: string[] = []
  const batch = crypto.randomUUID()

  for (const r of recipients) {
    const rendered = renderCommsTemplate('organizer_blast', {
      eventName: event.name as string,
      hubUrl: eventHubUrl(args.eventId),
      customBody: args.body,
      subjectOverride: args.subject,
    })
    const { id, inserted } = await enqueueComms(supabase, {
      type: 'organizer_blast',
      eventId: args.eventId,
      registrationId: r.registrationId,
      recipientAccountId: r.accountId,
      recipientEmail: r.email,
      subject: rendered.subject,
      bodyText: rendered.body_text,
      bodyHtml: rendered.body_html,
      idempotencyKey: `organizer_blast:${args.eventId}:${batch}:${r.accountId}`,
      meta: { segment: args.segment, batch },
    })
    if (inserted && id) outboxIds.push(id)
  }

  const { data: log, error } = await supabase
    .from('event_comms_log')
    .insert({
      event_id: args.eventId,
      actor_account_id: args.actorId,
      segment: args.segment,
      subject: args.subject,
      body_preview: args.body.slice(0, 280),
      recipient_count: outboxIds.length,
      outbox_ids: outboxIds,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  return { log, recipientCount: outboxIds.length, outboxIds }
}
