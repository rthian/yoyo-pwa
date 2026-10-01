/**
 * Schedule Entry Detail API — update/delete (manage_schedule).
 */
import { NextResponse } from 'next/server'
import { scheduleEntrySchema } from '@/lib/validations'
import {
  getAuthedAdminClient,
  requireEventCapabilityResponse,
} from '@/lib/auth/request'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function loadEntryEventId(
  supabaseAdmin: ReturnType<
    typeof import('@/lib/supabase/admin').createAdminClient
  >,
  entryId: string
) {
  const { data } = await supabaseAdmin
    .from('schedule_entries')
    .select('event_id')
    .eq('id', entryId)
    .maybeSingle()
  return data?.event_id ?? null
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const eventId = await loadEntryEventId(auth.supabaseAdmin, id)
    if (!eventId) {
      return NextResponse.json({ error: 'Schedule entry not found' }, { status: 404 })
    }

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'manage_schedule'
    )
    if (denied) return denied

    const body = await request.json()
    const validationResult = scheduleEntrySchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const { data: entry, error } = await auth.supabaseAdmin
      .from('schedule_entries')
      .update(validationResult.data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ entry })
  } catch (error) {
    console.error('Schedule entry update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const eventId = await loadEntryEventId(auth.supabaseAdmin, id)
    if (!eventId) {
      return NextResponse.json({ error: 'Schedule entry not found' }, { status: 404 })
    }

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'manage_schedule'
    )
    if (denied) return denied

    const { error } = await auth.supabaseAdmin
      .from('schedule_entries')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Schedule entry deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
