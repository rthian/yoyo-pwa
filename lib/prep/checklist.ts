/**
 * Shared event prep checklist (Prompt 21 UI + Prompt 22 emails).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentStatusPlaceholder } from '@/lib/types/database'

export type PrepChecklistItem = {
  key: 'payment' | 'music' | 'venue'
  label: string
  detail: string
  ok: boolean | null
}

export async function musicApprovedForRegistration(
  supabase: SupabaseClient,
  registrationId: string
): Promise<boolean | null> {
  const { data: entries } = await supabase
    .from('registration_entries')
    .select('division_id')
    .eq('registration_id', registrationId)
  const divisionIds = (entries ?? []).map((e) => e.division_id)
  if (!divisionIds.length) return null

  const { data: regs } = await supabase
    .from('registrations')
    .select('competitor_id')
    .eq('id', registrationId)
    .maybeSingle()
  if (!regs?.competitor_id) return null

  const { data: music } = await supabase
    .from('music_submissions')
    .select('id, status')
    .eq('competitor_id', regs.competitor_id)
    .in('division_id', divisionIds)

  if (!music?.length) return false
  return music.every((m) => m.status === 'approved')
}

export function buildPrepChecklist(args: {
  paymentStatus: PaymentStatusPlaceholder | string
  musicOk: boolean | null
  venueName?: string | null
}): PrepChecklistItem[] {
  const paymentOk =
    args.paymentStatus === 'paid' ||
    args.paymentStatus === 'waived' ||
    args.paymentStatus === 'not_required'

  return [
    {
      key: 'payment',
      label: 'Payment',
      detail: String(args.paymentStatus),
      ok: paymentOk,
    },
    {
      key: 'music',
      label: 'Music',
      detail:
        args.musicOk == null
          ? 'n/a'
          : args.musicOk
            ? 'approved'
            : 'still needed',
      ok: args.musicOk,
    },
    {
      key: 'venue',
      label: 'Venue',
      detail: args.venueName?.trim()
        ? args.venueName
        : 'see event hub',
      ok: Boolean(args.venueName?.trim()),
    },
  ]
}

/** Lines used in countdown email templates. */
export function prepChecklistLines(items: PrepChecklistItem[]): string[] {
  return items.map((i) => `${i.label}: ${i.detail}`)
}

export async function buildPrepChecklistForRegistration(
  supabase: SupabaseClient,
  args: {
    registrationId: string
    paymentStatus: PaymentStatusPlaceholder | string
    venueName?: string | null
  }
): Promise<PrepChecklistItem[]> {
  const musicOk = await musicApprovedForRegistration(
    supabase,
    args.registrationId
  )
  return buildPrepChecklist({
    paymentStatus: args.paymentStatus,
    musicOk,
    venueName: args.venueName,
  })
}
