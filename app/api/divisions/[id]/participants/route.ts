/**
 * Division Participants API — enroll / order / status (event staff capabilities).
 */
import { NextResponse } from 'next/server'
import { getAuthedAdminClient, requireEventCapabilityResponse } from '@/lib/auth/request'
import { resolveEventIdForDivision } from '@/lib/auth/event-permissions'
import type { EventCapability } from '@/lib/types/database'

async function requireDivisionCapability(
  capability: EventCapability,
  divisionId: string
) {
  const auth = await getAuthedAdminClient()
  if (!auth.ok) return { error: auth.error }

  const eventId = await resolveEventIdForDivision(auth.supabaseAdmin, divisionId)
  if (!eventId) {
    return {
      error: NextResponse.json({ error: 'Division not found' }, { status: 404 }),
    }
  }

  const denied = await requireEventCapabilityResponse(
    auth.supabaseAdmin,
    auth.user.id,
    eventId,
    capability
  )
  if (denied) return { error: denied }

  return { user: auth.user, supabaseAdmin: auth.supabaseAdmin, eventId }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: divisionId } = await params
    const auth = await requireDivisionCapability('view_ops', divisionId)
    if ('error' in auth) return auth.error

    const { data: participants, error } = await auth.supabaseAdmin
      .from('division_members')
      .select(`
        *,
        member:members(*)
      `)
      .eq('division_id', divisionId)
      .order('play_order', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const participantIds =
      participants?.map((p: { member_id: string }) => p.member_id) || []

    const query = auth.supabaseAdmin
      .from('members')
      .select('*')
      .eq('is_active', true)
      .eq('role', 'member')
      .order('full_name', { ascending: true })

    if (participantIds.length > 0) {
      query.not('id', 'in', `(${participantIds.join(',')})`)
    }

    const { data: availableMembers } = await query

    return NextResponse.json({
      participants: participants || [],
      availableMembers: availableMembers || [],
    })
  } catch (error) {
    console.error('Error fetching participants:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: divisionId } = await params
    const auth = await requireDivisionCapability('manage_registration', divisionId)
    if ('error' in auth) return auth.error

    const body = await request.json()

    // Slice B dual-write: competitor_id (+ DB trigger fills if omitted)
    const { getCompetitorIdForMember } = await import(
      '@/lib/identity/competitors'
    )
    const competitorId = body.member_id
      ? await getCompetitorIdForMember(auth.supabaseAdmin, body.member_id)
      : null

    const { data, error } = await auth.supabaseAdmin
      .from('division_members')
      .insert({
        division_id: divisionId,
        member_id: body.member_id,
        competitor_id: competitorId,
        play_order: body.play_order || 1,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ participant: data }, { status: 201 })
  } catch (error) {
    console.error('Error adding participant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: divisionId } = await params
    const body = await request.json()

    const capability: EventCapability = Array.isArray(body.participantIds)
      ? 'manage_play_order'
      : body.status === 'checked_in'
        ? 'check_in'
        : 'manage_registration'

    const auth = await requireDivisionCapability(capability, divisionId)
    if ('error' in auth) return auth.error

    if (Array.isArray(body.participantIds)) {
      for (let i = 0; i < body.participantIds.length; i++) {
        const { error } = await auth.supabaseAdmin
          .from('division_members')
          .update({ play_order: i + 1 })
          .eq('id', body.participantIds[i])

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      }
      return NextResponse.json({ success: true })
    }

    const { error } = await auth.supabaseAdmin
      .from('division_members')
      .update({ status: body.status })
      .eq('id', body.participantId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating participant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: divisionId } = await params
    const auth = await requireDivisionCapability('manage_registration', divisionId)
    if ('error' in auth) return auth.error

    const body = await request.json()

    const { error } = await auth.supabaseAdmin
      .from('division_members')
      .delete()
      .eq('id', body.participantId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing participant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
