/**
 * Public Leaderboards API Route
 * Returns all divisions that have active public leaderboard tokens
 * No authentication required - only returns publicly shared leaderboards
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    // Fetch all active leaderboard tokens with their division and event info
    const { data: tokens, error } = await supabase
      .from('leaderboard_tokens')
      .select(`
        id,
        token,
        division_id,
        views_count,
        created_at,
        division:divisions(
          id,
          name,
          description,
          is_active,
          event:events(
            id,
            name,
            status,
            event_date,
            location
          )
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Filter to only include tokens for active divisions in published/active events
    // and deduplicate by division (take the most recent token per division)
    const seenDivisions = new Set<string>()
    const publicLeaderboards = (tokens || [])
      .filter(t => {
        const division = t.division as unknown as {
          id: string
          name: string
          description: string | null
          is_active: boolean
          event: { id: string; name: string; status: string; event_date: string | null; location: string | null }
        }
        if (!division || !division.event) return false
        if (!division.is_active) return false
        if (!['published', 'active', 'completed'].includes(division.event.status)) return false

        // Deduplicate: only keep the first (most recent) token per division
        if (seenDivisions.has(division.id)) return false
        seenDivisions.add(division.id)
        return true
      })
      .map(t => {
        const division = t.division as unknown as {
          id: string
          name: string
          description: string | null
          is_active: boolean
          event: { id: string; name: string; status: string; event_date: string | null; location: string | null }
        }
        return {
          divisionId: division.id,
          divisionName: division.name,
          divisionDescription: division.description,
          eventId: division.event.id,
          eventName: division.event.name,
          eventStatus: division.event.status,
          eventDate: division.event.event_date,
          eventLocation: division.event.location,
          token: t.token,
          viewsCount: t.views_count,
        }
      })

    // Group by event for a cleaner response
    const eventMap = new Map<string, {
      eventId: string
      eventName: string
      eventStatus: string
      eventDate: string | null
      eventLocation: string | null
      divisions: {
        divisionId: string
        divisionName: string
        divisionDescription: string | null
        token: string
        viewsCount: number
      }[]
    }>()

    for (const lb of publicLeaderboards) {
      if (!eventMap.has(lb.eventId)) {
        eventMap.set(lb.eventId, {
          eventId: lb.eventId,
          eventName: lb.eventName,
          eventStatus: lb.eventStatus,
          eventDate: lb.eventDate,
          eventLocation: lb.eventLocation,
          divisions: [],
        })
      }
      eventMap.get(lb.eventId)!.divisions.push({
        divisionId: lb.divisionId,
        divisionName: lb.divisionName,
        divisionDescription: lb.divisionDescription,
        token: lb.token,
        viewsCount: lb.viewsCount,
      })
    }

    const events = Array.from(eventMap.values())
      // Sort: active events first, then by date descending
      .sort((a, b) => {
        const statusOrder: Record<string, number> = { active: 0, published: 1, completed: 2 }
        const aOrder = statusOrder[a.eventStatus] ?? 3
        const bOrder = statusOrder[b.eventStatus] ?? 3
        if (aOrder !== bOrder) return aOrder - bOrder
        return (b.eventDate || '').localeCompare(a.eventDate || '')
      })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Public leaderboards API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
