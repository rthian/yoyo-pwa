/**
 * POST|DELETE|GET /api/admin/events/[id]/finalize — award/revoke season points.
 * Caller: components/admin/FinalizeEventPanel.tsx (fetch this path).
 * Glob: no prior finalize route under admin/events.
 * Writes ranking_points rows; may set events.status='completed'. Dates: event_date YYYY-MM-DD.
 * User: "create a branch for this, plan & build a ranking with point system league leaderboards..."
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  finalizeEventPoints,
  getFinalizeBlockers,
  unfinalizeEventPoints,
} from '@/lib/rankings/finalize'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function requireAdmin() {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('role')
    .eq('id', user.id)
    .single()

  if (member?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { supabaseAdmin }
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error

    const blockers = await getFinalizeBlockers(auth.supabaseAdmin!, id)
    const { count } = await auth.supabaseAdmin!
      .from('ranking_points')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)

    return NextResponse.json({
      blockers,
      canFinalize: blockers.length === 0,
      awardsCount: count ?? 0,
      isFinalized: (count ?? 0) > 0,
    })
  } catch (error) {
    console.error('Finalize status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error

    const result = await finalizeEventPoints(auth.supabaseAdmin!, id)
    if (!result.ok) {
      return NextResponse.json(
        { error: 'Cannot finalize', blockers: result.blockers },
        { status: 409 }
      )
    }
    return NextResponse.json({
      message: 'Season points awarded',
      awardsWritten: result.awardsWritten,
    })
  } catch (error) {
    console.error('Finalize error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error

    await unfinalizeEventPoints(auth.supabaseAdmin!, id)
    return NextResponse.json({ message: 'Season points revoked for this event' })
  } catch (error) {
    console.error('Unfinalize error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
