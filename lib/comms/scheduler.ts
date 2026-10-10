/**
 * Cron schedulers: payment reminders + event countdown (Prompt 22).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { enqueueComms, resolveAccountEmail } from '@/lib/comms/outbox'
import { getNotificationPreferences, prefAllows } from '@/lib/comms/preferences'
import {
  eventHubUrl,
  renderCommsTemplate,
} from '@/lib/comms/templates'
import { formatFeeCents } from '@/lib/payments/receipts'
import {
  buildPrepChecklist,
  musicApprovedForRegistration,
  prepChecklistLines,
} from '@/lib/prep/checklist'

function daysUntil(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null
  const target = new Date(iso)
  const ms = target.getTime() - now.getTime()
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

async function managers(supabase: SupabaseClient, competitorId: string) {
  const { data } = await supabase
    .from('account_competitor_links')
    .select('account_id')
    .eq('competitor_id', competitorId)
    .eq('can_register', true)
  return (data ?? []).map((r) => r.account_id as string)
}

export async function schedulePaymentReminders(
  supabase: SupabaseClient
): Promise<number> {
  const { data: events } = await supabase
    .from('events')
    .select(
      'id, name, payment_required, registration_fee_cents, registration_fee_currency, registration_closes_at, starts_at, status'
    )
    .eq('payment_required', true)
    .in('status', ['published', 'active'])

  let queued = 0
  const now = new Date()

  for (const event of events ?? []) {
    const { data: regs } = await supabase
      .from('registrations')
      .select('id, competitor_id, payment_status')
      .eq('event_id', event.id)
      .eq('payment_status', 'unpaid')

    const anchors = [
      { label: 'd-3', days: 3, at: event.registration_closes_at || event.starts_at },
      { label: 'd-1', days: 1, at: event.registration_closes_at || event.starts_at },
      { label: 'h-6', days: 0, at: event.registration_closes_at || event.starts_at },
    ]

    for (const reg of regs ?? []) {
      for (const anchor of anchors) {
        const d = daysUntil(anchor.at as string | null, now)
        if (d === null) continue
        // Fire when within the target day window (d==3, d==1, or same day for h-6)
        if (anchor.label === 'h-6') {
          if (d !== 0) continue
        } else if (d !== anchor.days) {
          continue
        }

        const feeLabel = formatFeeCents(
          event.registration_fee_cents as number | null,
          (event.registration_fee_currency as string) || 'SGD'
        )
        const { data: competitor } = await supabase
          .from('competitors')
          .select('full_name')
          .eq('id', reg.competitor_id)
          .maybeSingle()

        for (const accountId of await managers(
          supabase,
          reg.competitor_id as string
        )) {
          const prefs = await getNotificationPreferences(supabase, accountId)
          if (!prefAllows(prefs, 'payment')) continue
          const email = await resolveAccountEmail(supabase, accountId)
          if (!email) continue

          const rendered = renderCommsTemplate('payment_reminder', {
            eventName: event.name as string,
            competitorName: competitor?.full_name as string | undefined,
            hubUrl: eventHubUrl(event.id as string),
            feeLabel,
          })
          const { inserted } = await enqueueComms(supabase, {
            type: 'payment_reminder',
            eventId: event.id as string,
            registrationId: reg.id as string,
            recipientAccountId: accountId,
            recipientEmail: email,
            subject: rendered.subject,
            bodyText: rendered.body_text,
            bodyHtml: rendered.body_html,
            idempotencyKey: `payment_reminder:${reg.id}:${anchor.label}`,
          })
          if (inserted) queued += 1
        }
      }
    }
  }
  return queued
}

export async function scheduleEventCountdowns(
  supabase: SupabaseClient
): Promise<number> {
  const { data: events } = await supabase
    .from('events')
    .select('id, name, starts_at, venue_name, status, timezone')
    .in('status', ['published', 'active'])
    .not('starts_at', 'is', null)

  let queued = 0
  const now = new Date()

  for (const event of events ?? []) {
    const d = daysUntil(event.starts_at as string, now)
    if (d === null) continue

    let label: string | null = null
    let key: string | null = null
    let type: 'event_countdown' | 'event_day' = 'event_countdown'

    if (d === 6) {
      label = 'T-6 days'
      key = 'd-6'
    } else if (d === 3) {
      label = 'T-3 days'
      key = 'd-3'
    } else if (d === 1) {
      label = 'T-1 day'
      key = 'd-1'
    } else if (d === 0) {
      label = 'Event day'
      key = 'day'
      type = 'event_day'
    } else {
      continue
    }

    const { data: regs } = await supabase
      .from('registrations')
      .select('id, competitor_id, payment_status, status')
      .eq('event_id', event.id)
      .in('status', ['confirmed', 'pending', 'waitlisted', 'checked_in'])

    for (const reg of regs ?? []) {
      const musicOk = await musicApprovedForRegistration(
        supabase,
        reg.id as string
      )
      const checklist = prepChecklistLines(
        buildPrepChecklist({
          paymentStatus: reg.payment_status as string,
          musicOk,
          venueName: event.venue_name as string | null,
        })
      )

      const { data: competitor } = await supabase
        .from('competitors')
        .select('full_name')
        .eq('id', reg.competitor_id)
        .maybeSingle()

      for (const accountId of await managers(
        supabase,
        reg.competitor_id as string
      )) {
        const prefs = await getNotificationPreferences(supabase, accountId)
        if (!prefAllows(prefs, 'countdown')) continue
        const email = await resolveAccountEmail(supabase, accountId)
        if (!email) continue

        const rendered = renderCommsTemplate(type, {
          eventName: event.name as string,
          competitorName: competitor?.full_name as string | undefined,
          hubUrl: eventHubUrl(event.id as string),
          countdownLabel: label,
          checklist,
        })
        const { inserted } = await enqueueComms(supabase, {
          type,
          eventId: event.id as string,
          registrationId: reg.id as string,
          recipientAccountId: accountId,
          recipientEmail: email,
          subject: rendered.subject,
          bodyText: rendered.body_text,
          bodyHtml: rendered.body_html,
          idempotencyKey: `countdown:${event.id}:${reg.id}:${key}`,
        })
        if (inserted) queued += 1
      }
    }
  }
  return queued
}
