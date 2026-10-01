/**
 * Schedule Entries API — create (manage_schedule).
 */
import { NextResponse } from 'next/server'
import { scheduleEntrySchema } from '@/lib/validations'
import {
  getAuthedAdminClient,
  requireEventCapabilityResponse,
} from '@/lib/auth/request'

export async function POST(request: Request) {
  try {
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const body = await request.json()
    const validationResult = scheduleEntrySchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const denied = await requireEventCapabilityResponse(
      auth.supabaseAdmin,
      auth.user.id,
      validationResult.data.event_id,
      'manage_schedule'
    )
    if (denied) return denied

    const { data: entry, error } = await auth.supabaseAdmin
      .from('schedule_entries')
      .insert(validationResult.data)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ entry }, { status: 201 })
  } catch (error) {
    console.error('Schedule entry creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
