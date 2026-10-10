/**
 * Prompt 22: organizer blast preview/send + audit log.
 */
import { NextResponse } from 'next/server'
import {
  getAuthedAdminClient,
  requireEventCapabilityResponse,
} from '@/lib/auth/request'
import {
  previewBlastRecipients,
  sendOrganizerBlast,
} from '@/lib/comms/blasts'
import { organizerBlastSchema } from '@/lib/validations'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'view_ops'
    )
    if (denied) return denied

    const { data: log } = await auth.supabaseAdmin
      .from('event_comms_log')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(30)

    return NextResponse.json({ log: log ?? [] })
  } catch (error) {
    console.error('[GET comms]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const body = await request.json()
    const action = body.action as string

    if (action === 'preview') {
      const denied = await requireEventCapabilityResponse(
        auth.supabaseAdmin,
        auth.user.id,
        eventId,
        'manage_registration'
      )
      if (denied) return denied

      const segment = body.segment
      const recipients = await previewBlastRecipients(auth.supabaseAdmin, {
        eventId,
        segment,
        divisionId: body.division_id ?? null,
      })
      return NextResponse.json({
        count: recipients.length,
        sample: recipients.slice(0, 5).map((r) => r.email),
      })
    }

    if (action === 'send') {
      const denied = await requireEventCapabilityResponse(
        auth.supabaseAdmin,
        auth.user.id,
        eventId,
        'manage_registration'
      )
      if (denied) return denied

      const parsed = organizerBlastSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid data', details: parsed.error.flatten() },
          { status: 400 }
        )
      }

      const result = await sendOrganizerBlast(auth.supabaseAdmin, {
        eventId,
        actorId: auth.user.id,
        segment: parsed.data.segment,
        divisionId: parsed.data.division_id,
        subject: parsed.data.subject,
        body: parsed.data.body,
      })

      // Flush immediately so blasts don't wait for cron
      const { processDueOutbox } = await import('@/lib/comms/outbox')
      const flush = await processDueOutbox(auth.supabaseAdmin, 100)

      return NextResponse.json({ ...result, flush })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500
    console.error('[POST comms]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: status === 429 || status === 404 ? status : 500 }
    )
  }
}
