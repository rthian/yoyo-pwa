/**
 * Division Detail API Route — update/delete (manage_divisions).
 */
import { NextResponse } from 'next/server'
import { divisionSchema } from '@/lib/validations'
import {
  getAuthedAdminClient,
  requireEventCapabilityResponse,
} from '@/lib/auth/request'
import { resolveEventIdForDivision } from '@/lib/auth/event-permissions'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const eventId = await resolveEventIdForDivision(auth.supabaseAdmin, id)
    if (!eventId) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 })
    }

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'manage_divisions'
    )
    if (denied) return denied

    const body = await request.json()
    const validationResult = divisionSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const { data: division, error } = await auth.supabaseAdmin
      .from('divisions')
      .update(validationResult.data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ division })
  } catch (error) {
    console.error('Division update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const eventId = await resolveEventIdForDivision(auth.supabaseAdmin, id)
    if (!eventId) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 })
    }

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      'manage_divisions'
    )
    if (denied) return denied

    const { error } = await auth.supabaseAdmin.from('divisions').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Division deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
