/**
 * Prompt 20: registration payment receipts (manual QR verify).
 * Callers: /api/registrations/[id]/receipts, registrations staff PATCH
 * Bucket: registration-receipts (private)
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertManagesCompetitor } from '@/lib/identity/competitors'
import type { PaymentStatusPlaceholder } from '@/lib/types/database'
import {
  notifyPaymentReceiptUploaded,
  notifyPaymentReviewed,
} from '@/lib/comms/hooks'

export const RECEIPT_BUCKET = 'registration-receipts'
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024
export const ALLOWED_RECEIPT_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

export type RegistrationReceipt = {
  id: string
  registration_id: string
  version_number: number
  storage_path: string
  original_filename: string | null
  mime_type: string | null
  byte_size: number | null
  status: 'pending' | 'approved' | 'rejected' | 'superseded'
  uploaded_by_account_id: string | null
  reviewed_by_account_id: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
}

export function buildReceiptStoragePath(args: {
  eventId: string
  registrationId: string
  versionId: string
  ext: string
}) {
  return `${args.eventId}/${args.registrationId}/${args.versionId}.${args.ext}`
}

export function formatFeeCents(
  cents: number | null | undefined,
  currency = 'SGD'
): string | null {
  if (cents == null) return null
  return `${currency} ${(cents / 100).toFixed(2)}`
}

async function writePaymentAudit(
  supabase: SupabaseClient,
  args: {
    registrationId: string
    actorId: string
    action: string
    detail?: Record<string, unknown>
  }
) {
  await supabase.from('registration_audit_events').insert({
    registration_id: args.registrationId,
    actor_account_id: args.actorId,
    action: args.action,
    detail: args.detail ?? {},
  })
}

export async function getRegistrationForAccount(
  supabase: SupabaseClient,
  registrationId: string,
  accountId: string,
  options?: { isStaff?: boolean }
) {
  const { data: reg, error } = await supabase
    .from('registrations')
    .select(
      `
      *,
      event:events(
        id, name, payment_required, registration_fee_cents,
        registration_fee_currency, payment_instructions,
        payment_qr_url, payment_qr_payload, require_paid_before_confirm
      )
    `
    )
    .eq('id', registrationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!reg) {
    const err = new Error('Registration not found')
    ;(err as Error & { status: number }).status = 404
    throw err
  }

  if (!options?.isStaff) {
    await assertManagesCompetitor(
      supabase,
      accountId,
      reg.competitor_id,
      'register'
    )
  }

  return reg
}

export async function listReceipts(
  supabase: SupabaseClient,
  registrationId: string
): Promise<RegistrationReceipt[]> {
  const { data, error } = await supabase
    .from('registration_receipts')
    .select('*')
    .eq('registration_id', registrationId)
    .order('version_number', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as RegistrationReceipt[]
}

export async function signReceiptUpload(
  supabase: SupabaseClient,
  args: {
    accountId: string
    registrationId: string
    filename: string
    mimeType: string
    byteSize: number
  }
) {
  const reg = await getRegistrationForAccount(
    supabase,
    args.registrationId,
    args.accountId
  )
  const event = reg.event as { id: string; payment_required?: boolean } | null
  if (!event?.payment_required && reg.payment_status === 'not_required') {
    const err = new Error('Payment is not required for this registration')
    ;(err as Error & { status: number }).status = 400
    throw err
  }

  if (!ALLOWED_RECEIPT_MIMES.includes(args.mimeType as (typeof ALLOWED_RECEIPT_MIMES)[number])) {
    const err = new Error('Receipt must be JPEG, PNG, WebP, or PDF')
    ;(err as Error & { status: number }).status = 400
    throw err
  }
  if (args.byteSize > MAX_RECEIPT_BYTES) {
    const err = new Error('Receipt file too large (max 10MB)')
    ;(err as Error & { status: number }).status = 400
    throw err
  }

  const { count } = await supabase
    .from('registration_receipts')
    .select('*', { count: 'exact', head: true })
    .eq('registration_id', args.registrationId)

  const versionNumber = (count ?? 0) + 1
  const versionId = crypto.randomUUID()
  const ext = args.filename.split('.').pop()?.toLowerCase() || 'bin'
  const storagePath = buildReceiptStoragePath({
    eventId: event!.id,
    registrationId: args.registrationId,
    versionId,
    ext,
  })

  // Supersede prior pending receipts
  await supabase
    .from('registration_receipts')
    .update({ status: 'superseded' })
    .eq('registration_id', args.registrationId)
    .eq('status', 'pending')

  const { data: receipt, error } = await supabase
    .from('registration_receipts')
    .insert({
      id: versionId,
      registration_id: args.registrationId,
      version_number: versionNumber,
      storage_path: storagePath,
      original_filename: args.filename,
      mime_type: args.mimeType,
      byte_size: args.byteSize,
      status: 'pending',
      uploaded_by_account_id: args.accountId,
    })
    .select('*')
    .single()

  if (error || !receipt) {
    throw new Error(error?.message || 'Failed to create receipt row')
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .createSignedUploadUrl(storagePath)

  if (signErr || !signed) {
    await supabase.from('registration_receipts').delete().eq('id', versionId)
    throw new Error(
      signErr?.message ||
        'Could not create signed upload URL. Ensure private bucket registration-receipts exists.'
    )
  }

  await supabase
    .from('registrations')
    .update({ payment_status: 'pending' satisfies PaymentStatusPlaceholder })
    .eq('id', args.registrationId)
    .in('payment_status', ['unpaid', 'not_required', 'pending'])

  await writePaymentAudit(supabase, {
    registrationId: args.registrationId,
    actorId: args.accountId,
    action: 'payment_receipt_uploaded',
    detail: { receiptId: versionId, versionNumber },
  })

  try {
    await notifyPaymentReceiptUploaded(supabase, {
      eventId: event!.id,
      registrationId: args.registrationId,
      competitorId: reg.competitor_id as string,
      receiptId: versionId,
    })
  } catch (e) {
    console.error('[comms] payment receipt upload notify', e)
  }

  return { receipt: receipt as RegistrationReceipt, signed }
}

export async function reviewReceipt(
  supabase: SupabaseClient,
  args: {
    eventId: string
    registrationId: string
    receiptId: string
    actorId: string
    decision: 'approve' | 'reject'
    reason?: string | null
  }
) {
  const { data: reg } = await supabase
    .from('registrations')
    .select('id, event_id, payment_status, competitor_id')
    .eq('id', args.registrationId)
    .eq('event_id', args.eventId)
    .maybeSingle()

  if (!reg) {
    const err = new Error('Registration not found')
    ;(err as Error & { status: number }).status = 404
    throw err
  }

  const { data: receipt } = await supabase
    .from('registration_receipts')
    .select('*')
    .eq('id', args.receiptId)
    .eq('registration_id', args.registrationId)
    .maybeSingle()

  if (!receipt || receipt.status !== 'pending') {
    const err = new Error('Pending receipt not found')
    ;(err as Error & { status: number }).status = 404
    throw err
  }

  if (args.decision === 'approve') {
    await supabase
      .from('registration_receipts')
      .update({
        status: 'approved',
        reviewed_by_account_id: args.actorId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', args.receiptId)

    await supabase
      .from('registrations')
      .update({ payment_status: 'paid' satisfies PaymentStatusPlaceholder })
      .eq('id', args.registrationId)

    await writePaymentAudit(supabase, {
      registrationId: args.registrationId,
      actorId: args.actorId,
      action: 'payment_approved',
      detail: { receiptId: args.receiptId },
    })

    try {
      await notifyPaymentReviewed(supabase, {
        eventId: args.eventId,
        registrationId: args.registrationId,
        competitorId: reg.competitor_id as string,
        receiptId: args.receiptId,
        decision: 'approve',
      })
    } catch (e) {
      console.error('[comms] payment approved notify', e)
    }

    return { payment_status: 'paid' as const }
  }

  if (!args.reason?.trim()) {
    const err = new Error('Rejection reason required')
    ;(err as Error & { status: number }).status = 400
    throw err
  }

  await supabase
    .from('registration_receipts')
    .update({
      status: 'rejected',
      reviewed_by_account_id: args.actorId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: args.reason.trim(),
    })
    .eq('id', args.receiptId)

  await supabase
    .from('registrations')
    .update({ payment_status: 'unpaid' satisfies PaymentStatusPlaceholder })
    .eq('id', args.registrationId)

  await writePaymentAudit(supabase, {
    registrationId: args.registrationId,
    actorId: args.actorId,
    action: 'payment_rejected',
    detail: { receiptId: args.receiptId, reason: args.reason.trim() },
  })

  try {
    await notifyPaymentReviewed(supabase, {
      eventId: args.eventId,
      registrationId: args.registrationId,
      competitorId: reg.competitor_id as string,
      receiptId: args.receiptId,
      decision: 'reject',
      reason: args.reason.trim(),
    })
  } catch (e) {
    console.error('[comms] payment rejected notify', e)
  }

  return { payment_status: 'unpaid' as const }
}

/** After registration create: mark unpaid when event requires payment. */
export async function applyPaymentRequiredOnRegistration(
  supabase: SupabaseClient,
  registrationId: string,
  eventId: string
) {
  const { data: event } = await supabase
    .from('events')
    .select('payment_required')
    .eq('id', eventId)
    .maybeSingle()

  if (!event?.payment_required) return

  await supabase
    .from('registrations')
    .update({ payment_status: 'unpaid' satisfies PaymentStatusPlaceholder })
    .eq('id', registrationId)
    .eq('payment_status', 'not_required')
}
