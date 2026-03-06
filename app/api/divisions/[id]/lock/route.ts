/**
 * Division Lock API Route
 * Head judges and admins can toggle scoring_locked
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: divisionId } = await params
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const scoringLocked = body.scoring_locked

    if (typeof scoringLocked !== 'boolean') {
      return NextResponse.json(
        { error: 'scoring_locked must be a boolean' },
        { status: 400 }
      )
    }

    const { data: currentMember } = await supabaseAdmin
      .from('members')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = currentMember?.role === 'admin'

    if (!isAdmin) {
      const { data: assignment } = await supabaseAdmin
        .from('division_judges')
        .select('judge_type')
        .eq('division_id', divisionId)
        .eq('member_id', user.id)
        .single()

      if (!assignment || assignment.judge_type !== 'head') {
        return NextResponse.json(
          { error: 'Only head judges or admins can lock/unlock divisions' },
          { status: 403 }
        )
      }
    }

    const { data: division, error } = await supabaseAdmin
      .from('divisions')
      .update({ scoring_locked: scoringLocked })
      .eq('id', divisionId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ division })
  } catch (error) {
    console.error('Division lock error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
