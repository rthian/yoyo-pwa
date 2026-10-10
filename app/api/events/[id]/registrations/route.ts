/**
 * Organizer registration management for an event.
 * GET list (+ optional CSV), PATCH status actions.
 */
import { NextResponse } from 'next/server'
import {
  getAuthedAdminClient,
  requireEventCapabilityResponse,
} from '@/lib/auth/request'
import { cancelRegistration } from '@/lib/registration/service'
import { reviewReceipt, listReceipts, RECEIPT_BUCKET } from '@/lib/payments/receipts'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'manage_registration'
    )
    if (denied) return denied

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format')

    const { data: registrations, error } = await auth.supabaseAdmin
      .from('registrations')
      .select(
        `
        *,
        competitor:competitors(id, full_name, nickname, public_id, country),
        entries:registration_entries(
          id, division_id, status, waitlist_position, division_member_id,
          division:divisions(id, name)
        )
      `
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (format === 'csv') {
      const rows = [['registration_id', 'competitor', 'public_id', 'status', 'division', 'entry_status', 'waitlist_position']]
      for (const reg of registrations ?? []) {
        const competitor = reg.competitor as {
          full_name?: string
          public_id?: string | null
        } | null
        const entries = (reg.entries as Array<{
          status: string
          waitlist_position: number | null
          division: { name?: string } | null
        }>) ?? []
        if (!entries.length) {
          rows.push([
            reg.id,
            competitor?.full_name ?? '',
            competitor?.public_id ?? '',
            reg.status,
            '',
            '',
            '',
          ])
        } else {
          for (const entry of entries) {
            rows.push([
              reg.id,
              competitor?.full_name ?? '',
              competitor?.public_id ?? '',
              reg.status,
              entry.division?.name ?? '',
              entry.status,
              entry.waitlist_position?.toString() ?? '',
            ])
          }
        }
      }
      const csv = rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="registrations-${eventId}.csv"`,
        },
      })
    }

    const regs = registrations ?? []
    const enriched = await Promise.all(
      regs.map(async (reg) => {
        const receipts = await listReceipts(auth.supabaseAdmin, reg.id)
        const latest = receipts[0] ?? null
        let latest_signed_url: string | null = null
        if (latest) {
          const { data } = await auth.supabaseAdmin.storage
            .from(RECEIPT_BUCKET)
            .createSignedUrl(latest.storage_path, 60 * 30)
          latest_signed_url = data?.signedUrl ?? null
        }
        return {
          ...reg,
          latest_receipt: latest
            ? { ...latest, signed_url: latest_signed_url }
            : null,
        }
      })
    )

    return NextResponse.json({ registrations: enriched })
  } catch (error) {
    console.error('Event registrations list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'manage_registration'
    )
    if (denied) return denied

    const body = await request.json()
    const registrationId = body.registration_id as string | undefined
    const action = body.action as string | undefined

    if (!registrationId || !action) {
      return NextResponse.json(
        { error: 'registration_id and action required' },
        { status: 400 }
      )
    }

    const { data: reg } = await auth.supabaseAdmin
      .from('registrations')
      .select('*')
      .eq('id', registrationId)
      .eq('event_id', eventId)
      .maybeSingle()

    if (!reg) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }

    if (action === 'cancel') {
      const updated = await cancelRegistration(auth.supabaseAdmin, {
        registrationId,
        accountId: auth.user.id,
        reason: body.reason ?? 'Cancelled by organizer',
        isAdmin: true,
      })
      return NextResponse.json({ registration: updated })
    }

    if (action === 'confirm_entry') {
      const entryId = body.entry_id as string | undefined
      if (!entryId) {
        return NextResponse.json({ error: 'entry_id required' }, { status: 400 })
      }
      const { data: eventPay } = await auth.supabaseAdmin
        .from('events')
        .select('require_paid_before_confirm')
        .eq('id', eventId)
        .maybeSingle()
      if (
        eventPay?.require_paid_before_confirm &&
        !['paid', 'waived', 'not_required'].includes(reg.payment_status)
      ) {
        return NextResponse.json(
          { error: 'Payment must be paid or waived before confirming entry' },
          { status: 409 }
        )
      }
      const { data, error } = await auth.supabaseAdmin.rpc(
        'confirm_or_waitlist_registration_entry',
        { p_entry_id: entryId, p_actor_id: auth.user.id }
      )
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
      return NextResponse.json({
        entry: Array.isArray(data) ? data[0] : data,
      })
    }

    if (action === 'set_eligibility') {
      const eligibility = body.eligibility_status as string
      const { data, error } = await auth.supabaseAdmin
        .from('registrations')
        .update({ eligibility_status: eligibility })
        .eq('id', registrationId)
        .select('*')
        .single()
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ registration: data })
    }

    if (action === 'approve_payment' || action === 'reject_payment') {
      const receiptId = body.receipt_id as string | undefined
      if (!receiptId) {
        return NextResponse.json({ error: 'receipt_id required' }, { status: 400 })
      }
      try {
        const result = await reviewReceipt(auth.supabaseAdmin, {
          eventId,
          registrationId,
          receiptId,
          actorId: auth.user.id,
          decision: action === 'approve_payment' ? 'approve' : 'reject',
          reason: body.reason ?? null,
        })
        return NextResponse.json(result)
      } catch (err) {
        const status = (err as Error & { status?: number }).status ?? 500
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Review failed' },
          { status: status === 400 || status === 404 ? status : 500 }
        )
      }
    }

    if (action === 'waive_payment') {
      const { data, error } = await auth.supabaseAdmin
        .from('registrations')
        .update({ payment_status: 'waived' })
        .eq('id', registrationId)
        .select('*')
        .single()
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      await auth.supabaseAdmin.from('registration_audit_events').insert({
        registration_id: registrationId,
        actor_account_id: auth.user.id,
        action: 'payment_waived',
        detail: {},
      })
      return NextResponse.json({ registration: data })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Event registrations patch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
