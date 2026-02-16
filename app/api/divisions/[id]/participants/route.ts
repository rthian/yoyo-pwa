/**
 * Division Participants API Routes
 * Handles CRUD for division participants (bypasses RLS)
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

    const { data: participants, error } = await supabaseAdmin
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

    // Get available members (not in this division, role=member)
    const participantIds = participants?.map((p: { member_id: string }) => p.member_id) || []
    
    const query = supabaseAdmin
      .from('members')
      .select('*')
      .eq('is_active', true)
      .eq('role', 'member')
      .order('full_name', { ascending: true })

    if (participantIds.length > 0) {
      query.not('id', 'in', `(${participantIds.join(',')})`)
    }

    const { data: availableMembers } = await query

    return NextResponse.json({ participants: participants || [], availableMembers: availableMembers || [] })
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
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: divisionId } = await params
    const body = await request.json()
    const supabaseAdmin = createAdminClient()

    const { data, error } = await supabaseAdmin
      .from('division_members')
      .insert({
        division_id: divisionId,
        member_id: body.member_id,
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
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const supabaseAdmin = createAdminClient()

    if (Array.isArray(body.participantIds)) {
      for (let i = 0; i < body.participantIds.length; i++) {
        const { error } = await supabaseAdmin
          .from('division_members')
          .update({ play_order: i + 1 })
          .eq('id', body.participantIds[i])

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      }
      return NextResponse.json({ success: true })
    }

    const { error } = await supabaseAdmin
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
    const user = await checkAdmin()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const supabaseAdmin = createAdminClient()

    const { error } = await supabaseAdmin
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
