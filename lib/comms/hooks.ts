/**
 * Side-effect enqueues for payment / results events (Prompt 22).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { enqueueComms, resolveAccountEmail } from '@/lib/comms/outbox'
import { getNotificationPreferences, prefAllows } from '@/lib/comms/preferences'
import {
  eventHubUrl,
  renderCommsTemplate,
} from '@/lib/comms/templates'
import { formatFeeCents } from '@/lib/payments/receipts'
import { EVENT_CAPABILITY_ROLES } from '@/lib/auth/event-permissions'
import type { EventStaffRole } from '@/lib/types/database'

async function managersForCompetitor(
  supabase: SupabaseClient,
  competitorId: string
) {
  const { data } = await supabase
    .from('account_competitor_links')
    .select('account_id, can_register')
    .eq('competitor_id', competitorId)
    .eq('can_register', true)
  return (data ?? []).map((r) => r.account_id as string)
}

async function staffAccountIds(
  supabase: SupabaseClient,
  eventId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('event_staff_roles')
    .select('account_id, role')
    .eq('event_id', eventId)
    .is('revoked_at', null)

  const allowed = new Set(EVENT_CAPABILITY_ROLES.manage_registration)
  const ids = new Set<string>()
  for (const row of data ?? []) {
    if (allowed.has(row.role as EventStaffRole)) {
      ids.add(row.account_id as string)
    }
  }

  const { data: event } = await supabase
    .from('events')
    .select('created_by')
    .eq('id', eventId)
    .maybeSingle()
  if (event?.created_by) ids.add(event.created_by as string)

  return [...ids]
}

async function enqueueToAccount(
  supabase: SupabaseClient,
  args: {
    accountId: string
    pref: 'payment' | 'staff' | 'results' | 'countdown' | 'blast'
    type: Parameters<typeof renderCommsTemplate>[0]
    eventId: string
    registrationId?: string | null
    idempotencyKey: string
    ctx: Parameters<typeof renderCommsTemplate>[1]
  }
) {
  const prefs = await getNotificationPreferences(supabase, args.accountId)
  if (!prefAllows(prefs, args.pref)) return

  const email = await resolveAccountEmail(supabase, args.accountId)
  if (!email) return

  const rendered = renderCommsTemplate(args.type, args.ctx)
  await enqueueComms(supabase, {
    type: args.type,
    eventId: args.eventId,
    registrationId: args.registrationId,
    recipientAccountId: args.accountId,
    recipientEmail: email,
    subject: rendered.subject,
    bodyText: rendered.body_text,
    bodyHtml: rendered.body_html,
    idempotencyKey: args.idempotencyKey,
  })
}

export async function notifyPaymentReceiptUploaded(
  supabase: SupabaseClient,
  args: {
    eventId: string
    registrationId: string
    competitorId: string
    receiptId: string
  }
) {
  const { data: event } = await supabase
    .from('events')
    .select('id, name, registration_fee_cents, registration_fee_currency')
    .eq('id', args.eventId)
    .maybeSingle()
  if (!event) return

  const { data: competitor } = await supabase
    .from('competitors')
    .select('full_name')
    .eq('id', args.competitorId)
    .maybeSingle()

  const ctx = {
    eventName: event.name as string,
    competitorName: competitor?.full_name as string | undefined,
    hubUrl: eventHubUrl(args.eventId),
    feeLabel: formatFeeCents(
      event.registration_fee_cents as number | null,
      (event.registration_fee_currency as string) || 'SGD'
    ),
  }

  for (const accountId of await managersForCompetitor(
    supabase,
    args.competitorId
  )) {
    await enqueueToAccount(supabase, {
      accountId,
      pref: 'payment',
      type: 'payment_pending_ack',
      eventId: args.eventId,
      registrationId: args.registrationId,
      idempotencyKey: `payment_pending_ack:${args.receiptId}:${accountId}`,
      ctx,
    })
  }

  for (const accountId of await staffAccountIds(supabase, args.eventId)) {
    await enqueueToAccount(supabase, {
      accountId,
      pref: 'staff',
      type: 'payment_pending_staff',
      eventId: args.eventId,
      registrationId: args.registrationId,
      idempotencyKey: `payment_pending_staff:${args.receiptId}:${accountId}`,
      ctx,
    })
  }
}

export async function notifyPaymentReviewed(
  supabase: SupabaseClient,
  args: {
    eventId: string
    registrationId: string
    competitorId: string
    receiptId: string
    decision: 'approve' | 'reject'
    reason?: string | null
  }
) {
  const { data: event } = await supabase
    .from('events')
    .select('id, name')
    .eq('id', args.eventId)
    .maybeSingle()
  if (!event) return

  const { data: competitor } = await supabase
    .from('competitors')
    .select('full_name')
    .eq('id', args.competitorId)
    .maybeSingle()

  const type =
    args.decision === 'approve' ? 'payment_approved' : 'payment_rejected'
  const ctx = {
    eventName: event.name as string,
    competitorName: competitor?.full_name as string | undefined,
    hubUrl: eventHubUrl(args.eventId),
    reason: args.reason,
  }

  for (const accountId of await managersForCompetitor(
    supabase,
    args.competitorId
  )) {
    await enqueueToAccount(supabase, {
      accountId,
      pref: 'payment',
      type,
      eventId: args.eventId,
      registrationId: args.registrationId,
      idempotencyKey: `${type}:${args.receiptId}:${accountId}`,
      ctx,
    })
  }
}

export async function notifyResultsPublished(
  supabase: SupabaseClient,
  args: { eventId: string; publishedAt: string }
) {
  const { data: event } = await supabase
    .from('events')
    .select('id, name')
    .eq('id', args.eventId)
    .maybeSingle()
  if (!event) return

  const { data: regs } = await supabase
    .from('registrations')
    .select('id, competitor_id')
    .eq('event_id', args.eventId)
    .neq('status', 'cancelled').neq('status', 'rejected')

  const dayKey = args.publishedAt.slice(0, 10)
  const seen = new Set<string>()

  for (const reg of regs ?? []) {
    for (const accountId of await managersForCompetitor(
      supabase,
      reg.competitor_id as string
    )) {
      if (seen.has(accountId)) continue
      seen.add(accountId)
      await enqueueToAccount(supabase, {
        accountId,
        pref: 'results',
        type: 'results_published',
        eventId: args.eventId,
        registrationId: reg.id as string,
        idempotencyKey: `results_published:${args.eventId}:${accountId}:${dayKey}`,
        ctx: {
          eventName: event.name as string,
          hubUrl: eventHubUrl(args.eventId),
        },
      })
    }
  }
}
