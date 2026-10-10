/**
 * Prompt 22: process outbox + schedule reminders/countdowns.
 * Auth: Authorization Bearer CRON_SECRET or ?secret=
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processDueOutbox } from '@/lib/comms/outbox'
import {
  scheduleEventCountdowns,
  schedulePaymentReminders,
} from '@/lib/comms/scheduler'

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Allow in development without secret
    return process.env.NODE_ENV !== 'production'
  }
  const header = request.headers.get('authorization') || ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  const url = new URL(request.url)
  const q = url.searchParams.get('secret') || ''
  return bearer === secret || q === secret
}

export async function GET(request: Request) {
  return POST(request)
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const paymentQueued = await schedulePaymentReminders(supabase)
    const countdownQueued = await scheduleEventCountdowns(supabase)
    const flush = await processDueOutbox(supabase, 50)

    return NextResponse.json({
      ok: true,
      paymentQueued,
      countdownQueued,
      ...flush,
    })
  } catch (error) {
    console.error('[cron/comms]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron failed' },
      { status: 500 }
    )
  }
}
