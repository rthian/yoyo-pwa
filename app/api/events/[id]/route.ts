/**
 * Event Detail API Route
 * Handles event updates and deletion (admin or event staff capabilities).
 */
import { NextResponse } from 'next/server'
import { eventSchema } from '@/lib/validations'
import {
  getAuthedAdminClient,
  requireEventCapabilityResponse,
} from '@/lib/auth/request'
import { createAdminClient } from '@/lib/supabase/admin'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabaseAdmin = createAdminClient()

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .select('*, ruleset:rulesets(*)')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      )
    }

    return NextResponse.json({ event })
  } catch (error) {
    console.error('Event fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const body = await request.json()
    const validationResult = eventSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const capability =
      validationResult.data.status === 'cancelled' ? 'cancel_event' : 'manage_event'
    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      id,
      capability
    )
    if (denied) return denied

    const { data: event, error } = await auth.supabaseAdmin
      .from('events')
      .update(validationResult.data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ event })
  } catch (error) {
    console.error('Event update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      id,
      'delete_event'
    )
    if (denied) return denied

    const { error } = await auth.supabaseAdmin.from('events').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Event deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
