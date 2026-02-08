/**
 * Public Events Browse API Route
 * Returns all active events with their divisions for member browsing
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all non-draft, non-cancelled events with their divisions
    const { data: events, error } = await supabaseAdmin
      .from('events')
      .select(`
        id,
        name,
        description,
        event_date,
        location,
        status,
        divisions(
          id,
          name,
          description,
          scoring_type,
          round_type,
          max_participants,
          scheduled_start,
          scheduled_end,
          venue,
          sort_order
        )
      `)
      .in('status', ['published', 'active'])
      .order('event_date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch user's existing registrations
    const { data: registrations } = await supabaseAdmin
      .from('division_members')
      .select('division_id')
      .eq('member_id', user.id)

    const registeredDivisionIds = new Set(
      (registrations || []).map(r => r.division_id)
    )

    // Get participant counts per division
    const allDivisionIds = (events || []).flatMap(e =>
      (e.divisions || []).map((d: { id: string }) => d.id)
    )

    const { data: counts } = await supabaseAdmin
      .from('division_members')
      .select('division_id')
      .in('division_id', allDivisionIds.length > 0 ? allDivisionIds : ['__none__'])

    const countMap = new Map<string, number>()
    for (const c of counts || []) {
      countMap.set(c.division_id, (countMap.get(c.division_id) || 0) + 1)
    }

    // Registration is open for published and active events
    // Enrich events with registration status and participant counts
    const enrichedEvents = (events || []).map(event => ({
      ...event,
      registration_open: ['published', 'active'].includes(event.status),
      divisions: ((event.divisions || []) as Array<{
        id: string
        name: string
        description: string | null
        scoring_type: string
        round_type: string | null
        max_participants: number | null
        scheduled_start: string | null
        scheduled_end: string | null
        venue: string | null
        sort_order: number
      }>)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(d => ({
          ...d,
          is_registered: registeredDivisionIds.has(d.id),
          participant_count: countMap.get(d.id) || 0,
        })),
    }))

    return NextResponse.json({ events: enrichedEvents })
  } catch (error) {
    console.error('Events browse error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
