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
        competitor:competitors(id, full_name, nickname, country, public_id, source_member_id)
      `)
      .eq('division_id', divisionId)
      .order('play_order', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    type CompetitorEmbed = { source_member_id?: string | null } | null
    const enrolledAccountIds = (participants ?? [])
      .map((p) => {
        const raw = (p as { competitor?: CompetitorEmbed | CompetitorEmbed[] })
          .competitor
        const c = Array.isArray(raw) ? raw[0] : raw
        return c?.source_member_id ?? null
      })
      .filter((id): id is string => Boolean(id))

    const query = auth.supabaseAdmin
      .from('members')
      .select('*')
      .eq('is_active', true)
      .eq('role', 'member')
      .order('full_name', { ascending: true })

    if (enrolledAccountIds.length > 0) {
      query.not('id', 'in', `(${enrolledAccountIds.join(',')})`)
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

    // Slice D1: competitor_id required — ensure self competitor for account
    const {
      ensureSelfCompetitorForMember,
      getCompetitorIdForMember,
    } = await import('@/lib/identity/competitors')

    if (!body.member_id) {
      return NextResponse.json({ error: 'member_id required' }, { status: 400 })
    }

    let competitorId = await getCompetitorIdForMember(
      auth.supabaseAdmin,
      body.member_id
    )
    if (!competitorId) {
      const { data: memberRow } = await auth.supabaseAdmin
        .from('members')
        .select(
          'id, full_name, nickname, country, home_geo_id, gender, avatar_url, bio, profile_visibility, first_competed_on, public_id, is_active'
        )
        .eq('id', body.member_id)
        .single()
      if (!memberRow) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 })
      }
      const ensured = await ensureSelfCompetitorForMember(
        auth.supabaseAdmin,
        memberRow
      )
      competitorId = ensured.competitor.id
    }

    const { data, error } = await auth.supabaseAdmin
      .from('division_members')
      .insert({
        division_id: divisionId,
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
