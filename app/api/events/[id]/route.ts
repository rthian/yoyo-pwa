/**
 * Event Detail API Route
 * Handles event updates and deletion
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { eventSchema } from '@/lib/validations'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Get single event
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabaseAdmin = createAdminClient()

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .select('*, ruleset:rulesets(*)')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      )
    }

    return NextResponse.json({ event })
  } catch (error) {
    console.error('Event fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update event
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()
    
    // Check if current user is admin
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use admin client to check role
    const { data: currentMember } = await supabaseAdmin
      .from('members')
      .select('role')
      .eq('id', user.id)
      .single()

    if (currentMember?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can update events' },
        { status: 403 }
      )
    }

    // Validate event data
    const body = await request.json()
    const validationResult = eventSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Update event using admin client
    const { data: event, error } = await supabaseAdmin
      .from('events')
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

    return NextResponse.json({ event })
  } catch (error) {
    console.error('Event update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Delete event
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()
    
    // Check if current user is admin
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use admin client to check role
    const { data: currentMember } = await supabaseAdmin
      .from('members')
      .select('role')
      .eq('id', user.id)
      .single()

    if (currentMember?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can delete events' },
        { status: 403 }
      )
    }

    // Delete event using admin client
    const { error } = await supabaseAdmin
      .from('events')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Event deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
