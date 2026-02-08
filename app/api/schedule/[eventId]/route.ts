/**
 * Event Schedule API Route
 * Fetches the full schedule for an event (divisions + schedule entries)
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ eventId: string }>
}

// Get full event schedule (divisions with times + schedule entries)
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params
    const supabaseAdmin = createAdminClient()

    // Fetch divisions with schedule info
    const { data: divisions, error: divError } = await supabaseAdmin
      .from('divisions')
      .select('id, name, description, round_type, scheduled_start, scheduled_end, venue, sort_order, is_active')
      .eq('event_id', eventId)
      .order('scheduled_start', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true })

    if (divError) {
      return NextResponse.json(
        { error: divError.message },
        { status: 500 }
      )
    }

    // Fetch schedule entries (ceremonies, breaks, etc.)
    const { data: entries, error: entryError } = await supabaseAdmin
      .from('schedule_entries')
      .select('*')
      .eq('event_id', eventId)
      .order('scheduled_start', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true })

    if (entryError) {
      return NextResponse.json(
        { error: entryError.message },
        { status: 500 }
      )
    }

    // Combine and sort by scheduled_start
    const schedule = [
      ...(divisions || []).map(d => ({
        ...d,
        type: 'division' as const,
      })),
      ...(entries || []).map(e => ({
        ...e,
        type: 'entry' as const,
      })),
    ].sort((a, b) => {
      // Items with scheduled_start come first, sorted by time
      if (a.scheduled_start && b.scheduled_start) {
        return new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
      }
      if (a.scheduled_start) return -1
      if (b.scheduled_start) return 1
      // Fallback to sort_order
      return (a.sort_order || 0) - (b.sort_order || 0)
    })

    return NextResponse.json({
      divisions: divisions || [],
      entries: entries || [],
      schedule,
    })
  } catch (error) {
    console.error('Schedule fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
