/**
 * Division Judges API Routes
 * Handles CRUD for division judge assignments (bypasses RLS)
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const supabaseAdmin = createAdminClient()
  const { data: member } = await supabaseAdmin
    .from('members')
    .select('role')
    .eq('id', user.id)
    .single()

  return member?.role === 'admin' ? user : null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: divisionId } = await params
    const supabaseAdmin = createAdminClient()

    const { data: judges, error } = await supabaseAdmin
      .from('division_judges')
      .select(`
        *,
        member:members(*)
      `)
      .eq('division_id', divisionId)
      .order('judge_type', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get available judges (not assigned to this division, role=judge or admin)
    const assignedIds = judges?.map((j: { member_id: string }) => j.member_id) || []
    
    const query = supabaseAdmin
      .from('members')
      .select('*')
      .eq('is_active', true)
      .in('role', ['judge', 'admin'])
      .order('full_name', { ascending: true })

    if (assignedIds.length > 0) {
      query.not('id', 'in', `(${assignedIds.join(',')})`)
    }

    const { data: availableJudges } = await query

    return NextResponse.json({ judges: judges || [], availableJudges: availableJudges || [] })
  } catch (error) {
    console.error('Error fetching judges:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: divisionId } = await params
    const body = await request.json()
    const supabaseAdmin = createAdminClient()

    const { data, error } = await supabaseAdmin
      .from('division_judges')
      .insert({
        division_id: divisionId,
        member_id: body.member_id,
        judge_type: body.judge_type || 'general',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ judge: data }, { status: 201 })
  } catch (error) {
    console.error('Error assigning judge:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function checkAdminOrHeadJudge(divisionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, isAdmin: false, isHeadJudge: false }

  const supabaseAdmin = createAdminClient()
  const { data: member } = await supabaseAdmin
    .from('members')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = member?.role === 'admin'
  if (isAdmin) return { user, isAdmin: true, isHeadJudge: false }

  const { data: assignment } = await supabaseAdmin
    .from('division_judges')
    .select('judge_type')
    .eq('division_id', divisionId)
    .eq('member_id', user.id)
    .single()

  const isHeadJudge = assignment?.judge_type === 'head'
  return { user, isAdmin: false, isHeadJudge }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: divisionId } = await params
    const { user, isAdmin, isHeadJudge } = await checkAdminOrHeadJudge(divisionId)

    if (!user || (!isAdmin && !isHeadJudge)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const supabaseAdmin = createAdminClient()

    const assignmentId = body.assignmentId
    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId required' }, { status: 400 })
    }

    const updates: { judge_type?: string; scores_included_in_leaderboard?: boolean } = {}
    if (isAdmin && body.judge_type !== undefined) {
      updates.judge_type = body.judge_type
    }
    if ((isAdmin || isHeadJudge) && body.scores_included_in_leaderboard !== undefined) {
      updates.scores_included_in_leaderboard = Boolean(body.scores_included_in_leaderboard)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('division_judges')
      .select('division_id')
      .eq('id', assignmentId)
      .single()

    if (!existing || existing.division_id !== divisionId) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    const { error } = await supabaseAdmin
      .from('division_judges')
      .update(updates)
      .eq('id', assignmentId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating judge:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const supabaseAdmin = createAdminClient()

    const { error } = await supabaseAdmin
      .from('division_judges')
      .delete()
      .eq('id', body.assignmentId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing judge:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
