/**
 * Member Event Registration API Route
 * Allows members to register/unregister for event divisions
 * Called by: components/events/EventHubClient.tsx, app/(member)/member/events/page.tsx
 * User: "yes" (start event hub) — repair after max_participants removal
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { division_id, action } = body

    if (!division_id || !['register', 'unregister'].includes(action)) {
      return NextResponse.json(
        {
          error:
            'Invalid request. Provide division_id and action (register/unregister).',
        },
        { status: 400 }
      )
    }

    const { data: division, error: divError } = await supabaseAdmin
      .from('divisions')
      .select(
        `
        id,
        event:events(id, status)
      `
      )
      .eq('id', division_id)
      .single()

    if (divError || !division) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 })
    }

    const event = division.event as unknown as { id: string; status: string }
    if (!event || !['published', 'active'].includes(event.status)) {
      return NextResponse.json(
        { error: 'Registration is not currently open for this event' },
        { status: 400 }
      )
    }

    if (action === 'register') {
      const { data: existing } = await supabaseAdmin
        .from('division_members')
        .select('id')
        .eq('division_id', division_id)
        .eq('member_id', user.id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { error: 'Already registered for this division' },
          { status: 400 }
        )
      }

      const { error: insertError } = await supabaseAdmin
        .from('division_members')
        .insert({
          division_id,
          member_id: user.id,
          status: 'registered',
        })

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      return NextResponse.json({ message: 'Successfully registered', registered: true })
    }

    const { error: deleteError } = await supabaseAdmin
      .from('division_members')
      .delete()
      .eq('division_id', division_id)
      .eq('member_id', user.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Successfully unregistered', registered: false })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
