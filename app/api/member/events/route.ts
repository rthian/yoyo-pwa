/**
 * Member Events API Route
 * Fetches events the current authenticated member is registered in
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Find all division_members entries for this user
    const { data: memberships, error: memberError } = await supabaseAdmin
      .from('division_members')
      .select(`
        id,
        status,
        play_order,
        division:divisions(
          id,
          name,
          description,
          round_type,
          scheduled_start,
          scheduled_end,
          venue,
          sort_order,
          event:events(
            id,
            name,
            event_date,
            location,
            status
          )
        )
      `)
      .eq('member_id', user.id)
      .order('created_at', { ascending: false })

    if (memberError) {
      return NextResponse.json(
        { error: memberError.message },
        { status: 500 }
      )
    }

    // Group by event
    const eventMap = new Map<string, {
      id: string
      name: string
      event_date: string | null
      location: string | null
      status: string
      divisions: Array<{
        id: string
        name: string
        round_type: string | null
        scheduled_start: string | null
        scheduled_end: string | null
        venue: string | null
        member_status: string
        play_order: number | null
      }>
    }>()

    type DivisionWithEvent = {
      id: string; name: string; description: string | null; round_type: string | null
      scheduled_start: string | null; scheduled_end: string | null
      venue: string | null; sort_order: number | null
      event: { id: string; name: string; event_date: string | null; location: string | null; status: string } | null
    }

    for (const membership of memberships || []) {
      const division = membership.division as DivisionWithEvent
      if (!division?.event) continue

      const event = division.event
      if (!eventMap.has(event.id)) {
        eventMap.set(event.id, {
          id: event.id,
          name: event.name,
          event_date: event.event_date,
          location: event.location,
          status: event.status,
          divisions: [],
        })
      }

      eventMap.get(event.id)!.divisions.push({
        id: division.id,
        name: division.name,
        round_type: division.round_type,
        scheduled_start: division.scheduled_start,
        scheduled_end: division.scheduled_end,
        venue: division.venue,
        member_status: membership.status,
        play_order: membership.play_order,
      })
    }

    const events = Array.from(eventMap.values())
      .sort((a, b) => {
        if (a.event_date && b.event_date) {
          return new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
        }
        return 0
      })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Member events fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
