/**
 * Ruleset Detail API Route
 * Handles ruleset retrieval, updates, and deletion
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { rulesetSchema } from '@/lib/validations'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Get single ruleset
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabaseAdmin = createAdminClient()

    const { data: ruleset, error } = await supabaseAdmin
      .from('rulesets')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      )
    }

    return NextResponse.json({ ruleset })
  } catch (error) {
    console.error('Ruleset fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update ruleset (admin only)
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: currentMember } = await supabaseAdmin
      .from('members')
      .select('role')
      .eq('id', user.id)
      .single()

    if (currentMember?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can update rulesets' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validationResult = rulesetSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const { data: ruleset, error } = await supabaseAdmin
      .from('rulesets')
      .update(validationResult.data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ruleset })
  } catch (error) {
    console.error('Ruleset update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Delete ruleset (admin only) - soft delete by setting is_active = false
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: currentMember } = await supabaseAdmin
      .from('members')
      .select('role')
      .eq('id', user.id)
      .single()

    if (currentMember?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can delete rulesets' },
        { status: 403 }
      )
    }

    // Check if any events are using this ruleset
    const { data: eventsUsing } = await supabaseAdmin
      .from('events')
      .select('id, name')
      .eq('ruleset_id', id)

    if (eventsUsing && eventsUsing.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete ruleset that is in use by events',
          events: eventsUsing.map(e => e.name),
        },
        { status: 409 }
      )
    }

    // Soft delete
    const { error } = await supabaseAdmin
      .from('rulesets')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ruleset deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
