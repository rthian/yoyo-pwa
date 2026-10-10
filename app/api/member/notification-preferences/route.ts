import { NextResponse } from 'next/server'
import { getAuthedAdminClient } from '@/lib/auth/request'
import {
  getNotificationPreferences,
  upsertNotificationPreferences,
} from '@/lib/comms/preferences'
import { notificationPreferencesSchema } from '@/lib/validations'

export async function GET() {
  const auth = await getAuthedAdminClient()
  if (!auth.ok) return auth.error
  const prefs = await getNotificationPreferences(
    auth.supabaseAdmin,
    auth.user.id
  )
  return NextResponse.json({ preferences: prefs })
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error
    const body = await request.json()
    const parsed = notificationPreferencesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const prefs = await upsertNotificationPreferences(
      auth.supabaseAdmin,
      auth.user.id,
      parsed.data
    )
    return NextResponse.json({ preferences: prefs })
  } catch (error) {
    console.error('[PATCH notification-preferences]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}
