import type { SupabaseClient } from '@supabase/supabase-js'
import { sendCommsEmail } from '@/lib/comms/email'
import type { CommsOutboxType } from '@/lib/comms/types'

export type EnqueueMessage = {
  type: CommsOutboxType
  eventId?: string | null
  registrationId?: string | null
  recipientAccountId?: string | null
  recipientEmail: string
  subject: string
  bodyText: string
  bodyHtml?: string | null
  idempotencyKey: string
  scheduledFor?: string
  meta?: Record<string, unknown>
}

export async function enqueueComms(
  supabase: SupabaseClient,
  msg: EnqueueMessage
): Promise<{ id: string; inserted: boolean }> {
  const { data, error } = await supabase
    .from('comms_outbox')
    .upsert(
      {
        type: msg.type,
        event_id: msg.eventId ?? null,
        registration_id: msg.registrationId ?? null,
        recipient_account_id: msg.recipientAccountId ?? null,
        recipient_email: msg.recipientEmail,
        subject: msg.subject,
        body_text: msg.bodyText,
        body_html: msg.bodyHtml ?? null,
        idempotency_key: msg.idempotencyKey,
        scheduled_for: msg.scheduledFor ?? new Date().toISOString(),
        status: 'pending',
        meta: msg.meta ?? {},
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true }
    )
    .select('id')
    .maybeSingle()

  if (error) {
    // Unique race / ignore: treat as already queued
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('comms_outbox')
        .select('id')
        .eq('idempotency_key', msg.idempotencyKey)
        .maybeSingle()
      return { id: existing?.id ?? '', inserted: false }
    }
    throw new Error(error.message)
  }

  if (!data) {
    const { data: existing } = await supabase
      .from('comms_outbox')
      .select('id')
      .eq('idempotency_key', msg.idempotencyKey)
      .maybeSingle()
    return { id: existing?.id ?? '', inserted: false }
  }

  return { id: data.id as string, inserted: true }
}

export async function processDueOutbox(
  supabase: SupabaseClient,
  limit = 40
): Promise<{ processed: number; sent: number; failed: number }> {
  const now = new Date().toISOString()
  const { data: rows, error } = await supabase
    .from('comms_outbox')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)

  let sent = 0
  let failed = 0
  for (const row of rows ?? []) {
    await supabase
      .from('comms_outbox')
      .update({ status: 'processing' })
      .eq('id', row.id)
      .eq('status', 'pending')

    const result = await sendCommsEmail({
      to: row.recipient_email,
      subject: row.subject,
      text: row.body_text,
      html: row.body_html,
    })

    if (result.ok) {
      sent += 1
      await supabase
        .from('comms_outbox')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          error: null,
          meta: {
            ...(row.meta as object),
            provider: result.provider,
            provider_id: result.id,
          },
        })
        .eq('id', row.id)
    } else {
      failed += 1
      await supabase
        .from('comms_outbox')
        .update({
          status: 'failed',
          error: result.error,
          meta: { ...(row.meta as object), provider: result.provider },
        })
        .eq('id', row.id)
    }
  }

  return { processed: (rows ?? []).length, sent, failed }
}

export async function resolveAccountEmail(
  supabase: SupabaseClient,
  accountId: string
): Promise<string | null> {
  const { data: member } = await supabase
    .from('members')
    .select('id, email')
    .eq('id', accountId)
    .maybeSingle()
  if (member?.email) return member.email as string

  // Fallback: auth.users via admin list is heavy; members.email should exist
  return null
}
