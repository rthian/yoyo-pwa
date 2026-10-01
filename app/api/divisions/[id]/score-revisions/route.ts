/**
 * GET score revisions for a division (head judge / admin / own judge rows).
 */
import { NextResponse } from 'next/server'
import { getAuthedAdminClient } from '@/lib/auth/request'
import {
  canViewDivisionOps,
  resolveEventIdForDivision,
} from '@/lib/auth/event-permissions'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: divisionId } = await params
    const auth = await getAuthedAdminClient()
    if (!auth.ok) return auth.error

    const eventId = await resolveEventIdForDivision(auth.supabaseAdmin, divisionId)
    if (!eventId) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 })
    }

    const allowed = await canViewDivisionOps(
      auth.supabaseAdmin,
      auth.user.id,
      eventId,
      divisionId
    )
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: member } = await auth.supabaseAdmin
      .from('members')
      .select('role')
      .eq('id', auth.user.id)
      .single()

    let query = auth.supabaseAdmin
      .from('score_revisions')
      .select('*')
      .eq('division_id', divisionId)
      .order('created_at', { ascending: false })
      .limit(200)

    // Non-admin without head/ops already filtered by canViewDivisionOps;
    // further restrict plain judges who somehow pass — keep own only if not admin/head
    if (member?.role !== 'admin') {
      // head / ops already allowed full; if only own scores judge, filter
      const { data: assignment } = await auth.supabaseAdmin
        .from('division_judges')
        .select('judge_type')
        .eq('division_id', divisionId)
        .eq('member_id', auth.user.id)
        .maybeSingle()
      const isHead = assignment?.judge_type === 'head'
      if (!isHead) {
        query = query.eq('judge_id', auth.user.id)
      }
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ revisions: data ?? [] })
  } catch (error) {
    console.error('Score revisions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
