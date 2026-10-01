/**
 * Divisions API Route — create division (manage_divisions on event).
 */
import { NextResponse } from 'next/server'
import { divisionSchema } from '@/lib/validations'
import {
  getAuthedAdminClient,
  requireEventCapabilityResponse,
} from '@/lib/auth/request'

export async function POST(request: Request) {
  try {
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const body = await request.json()
    const validationResult = divisionSchema.safeParse(body)

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
      'manage_divisions'
    )
    if (denied) return denied

    const { data: division, error } = await auth.supabaseAdmin
      .from('divisions')
      .insert(validationResult.data)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ division }, { status: 201 })
  } catch (error) {
    console.error('Division creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
