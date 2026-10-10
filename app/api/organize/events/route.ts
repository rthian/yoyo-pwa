/**
 * GET /api/organize/events — events the caller staffs (Prompt 16).
 * GateGuard: callers MemberDashboardView / organize UI; Glob no prior api/organize;
 * Sample: { events: [{ id: "evt_demo", name: "Nationals", roles: ["organizer"] }] }
 * User: "ok let do Prompt 16"
 */
import { NextResponse } from 'next/server'
import { getAuthedAdminClient } from '@/lib/auth/request'
import { listStaffedEvents } from '@/lib/organize/access'

export async function GET() {
  try {
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const events = await listStaffedEvents(auth.supabaseAdmin, auth.user.id)
    return NextResponse.json({ events })
  } catch (error) {
    console.error('[GET /api/organize/events]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
