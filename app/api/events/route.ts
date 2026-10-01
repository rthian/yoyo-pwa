/**
 * Events API Route — create event (global admin).
 * Also grants event owner role to creator when staff table exists.
 */
import { NextResponse } from 'next/server'
import { eventSchema } from '@/lib/validations'
import { getAuthedAdminClient } from '@/lib/auth/request'
import { grantEventRole } from '@/lib/auth/event-permissions'
import { validateEventTimingOrder } from '@/lib/events/timing'

function omitUndefined<T extends Record<string, unknown>>(obj: T) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const { data: currentMember } = await auth.supabaseAdmin
      .from('members')
      .select('role')
      .eq('id', auth.user.id)
      .single()

    if (currentMember?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can create events' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validationResult = eventSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const timingError = validateEventTimingOrder(validationResult.data)
    if (timingError) {
      return NextResponse.json({ error: timingError }, { status: 400 })
    }

    const payload = omitUndefined({
      ...validationResult.data,
      created_by: auth.user.id,
    })

    const { data: event, error } = await auth.supabaseAdmin
      .from('events')
      .insert(payload)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    try {
      await grantEventRole(auth.supabaseAdmin, {
        eventId: event.id,
        accountId: auth.user.id,
        role: 'owner',
        actorId: auth.user.id,
        note: 'Auto-granted on event create',
      })
    } catch (grantErr) {
      console.error('Owner grant on create failed:', grantErr)
    }

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    console.error('Event creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
