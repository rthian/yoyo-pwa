/**
 * Division Judges API — assign / update / remove (assign_judges or lock for include toggle).
 */
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedAdminClient, requireEventCapabilityResponse } from '@/lib/auth/request'
import {
  canLockDivisionScores,
  hasEventCapability,
  resolveEventIdForDivision,
} from '@/lib/auth/event-permissions'

type DivisionAuth =
  | { error: NextResponse }
  | {
      user: User
      supabaseAdmin: ReturnType<typeof createAdminClient>
      eventId: string
    }

async function loadDivisionContext(divisionId: string): Promise<DivisionAuth> {
  const auth = await getAuthedAdminClient()
  if (!auth.ok) return { error: auth.error }

  const eventId = await resolveEventIdForDivision(auth.supabaseAdmin, divisionId)
  if (!eventId) {
    return {
      error: NextResponse.json({ error: 'Division not found' }, { status: 404 }),
    }
  }

  return { user: auth.user, supabaseAdmin: auth.supabaseAdmin, eventId }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: divisionId } = await params
    const ctx = await loadDivisionContext(divisionId)
    if ('error' in ctx) return ctx.error

    const denied = await requireEventCapabilityResponse(
      ctx.supabaseAdmin,
      ctx.user.id,
      ctx.eventId,
      'view_ops'
    )
    if (denied) return denied

    const { data: judges, error } = await ctx.supabaseAdmin
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

    const assignedIds = judges?.map((j: { member_id: string }) => j.member_id) || []

    const query = ctx.supabaseAdmin
      .from('members')
      .select('*')
      .eq('is_active', true)
      .in('role', ['judge', 'admin'])
      .order('full_name', { ascending: true })

    if (assignedIds.length > 0) {
      query.not('id', 'in', `(${assignedIds.join(',')})`)
    }

    const { data: availableJudges } = await query

    return NextResponse.json({
      judges: judges || [],
      availableJudges: availableJudges || [],
    })
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
    const { id: divisionId } = await params
    const ctx = await loadDivisionContext(divisionId)
    if ('error' in ctx) return ctx.error

    const denied = await requireEventCapabilityResponse(
      ctx.supabaseAdmin,
      ctx.user.id,
      ctx.eventId,
      'assign_judges'
    )
    if (denied) return denied

    const body = await request.json()

    const { data, error } = await ctx.supabaseAdmin
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
    const { id: divisionId } = await params
    const ctx = await loadDivisionContext(divisionId)
    if ('error' in ctx) return ctx.error

    const canAssign = await hasEventCapability(
      ctx.supabaseAdmin,
      ctx.user.id,
      ctx.eventId,
      'assign_judges'
    )
    const canLock = await canLockDivisionScores(
      ctx.supabaseAdmin,
      ctx.user.id,
      ctx.eventId,
      divisionId
    )

    if (!canAssign && !canLock) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const assignmentId = body.assignmentId
    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId required' }, { status: 400 })
    }

    const updates: {
      judge_type?: string
      scores_included_in_leaderboard?: boolean
    } = {}

    if (canAssign && body.judge_type !== undefined) {
      updates.judge_type = body.judge_type
    }
    if ((canAssign || canLock) && body.scores_included_in_leaderboard !== undefined) {
      updates.scores_included_in_leaderboard = Boolean(
        body.scores_included_in_leaderboard
      )
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data: existing } = await ctx.supabaseAdmin
      .from('division_judges')
      .select('division_id')
      .eq('id', assignmentId)
      .single()

    if (!existing || existing.division_id !== divisionId) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    const { error } = await ctx.supabaseAdmin
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
    const { id: divisionId } = await params
    const ctx = await loadDivisionContext(divisionId)
    if ('error' in ctx) return ctx.error

    const denied = await requireEventCapabilityResponse(
      ctx.supabaseAdmin,
      ctx.user.id,
      ctx.eventId,
      'assign_judges'
    )
    if (denied) return denied

    const body = await request.json()

    const { error } = await ctx.supabaseAdmin
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
