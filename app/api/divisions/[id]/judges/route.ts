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

export async function PATCH(
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
      .update({ judge_type: body.judge_type })
      .eq('id', body.assignmentId)

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
