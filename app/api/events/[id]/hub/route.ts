/**
 * GET /api/events/[id]/hub — one payload for the event hub.
 * Called by: components/events/EventHubClient.tsx (app/events/[id]/page.tsx).
 * No prior hub route (Glob empty). Schedule stays at /api/schedule/[eventId].
 * Response fields: event, registrationOpen, authenticated, divisions, schedule, myBoards, publicBoards.
 * User: "yes" (start event hub)
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const supabase = await createClient()
    const admin = createAdminClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: event, error: eventError } = await admin
      .from('events')
      .select('id, name, description, event_date, location, status')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: eventError?.message || 'Event not found' },
        { status: eventError?.code === 'PGRST116' ? 404 : 500 }
      )
    }

    if (!['published', 'active', 'completed'].includes(event.status)) {
      return NextResponse.json({ error: 'Event not available' }, { status: 404 })
    }

    const { data: divisions, error: divError } = await admin
      .from('divisions')
      .select(
        'id, name, description, scoring_type, round_type, scheduled_start, scheduled_end, venue, sort_order, scoring_locked, is_active'
      )
      .eq('event_id', eventId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (divError) {
      return NextResponse.json({ error: divError.message }, { status: 500 })
    }

    const divisionIds = (divisions ?? []).map((d) => d.id)

    const [{ data: counts }, { data: registrations }, scheduleRes, tokensRes] =
      await Promise.all([
        divisionIds.length
          ? admin.from('division_members').select('division_id').in('division_id', divisionIds)
          : Promise.resolve({ data: [] as { division_id: string }[] }),
        user && divisionIds.length
          ? admin
              .from('division_members')
              .select('division_id')
              .eq('member_id', user.id)
              .in('division_id', divisionIds)
          : Promise.resolve({ data: [] as { division_id: string }[] }),
        admin
          .from('schedule_entries')
          .select('*')
          .eq('event_id', eventId)
          .order('scheduled_start', { ascending: true, nullsFirst: false })
          .order('sort_order', { ascending: true }),
        admin
          .from('leaderboard_tokens')
          .select('token, views_count, division_id, created_at')
          .eq('is_active', true)
          .in('division_id', divisionIds.length ? divisionIds : ['__none__'])
          .order('created_at', { ascending: false }),
      ])

    if (scheduleRes.error) {
      return NextResponse.json({ error: scheduleRes.error.message }, { status: 500 })
    }
    if (tokensRes.error) {
      return NextResponse.json({ error: tokensRes.error.message }, { status: 500 })
    }

    const countMap = new Map<string, number>()
    for (const row of counts ?? []) {
      countMap.set(row.division_id, (countMap.get(row.division_id) || 0) + 1)
    }

    const registered = new Set((registrations ?? []).map((r) => r.division_id))

    const enrichedDivisions = (divisions ?? []).map((d) => ({
      ...d,
      is_registered: registered.has(d.id),
      participant_count: countMap.get(d.id) || 0,
    }))

    const schedule = [
      ...(divisions ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        type: 'division' as const,
        round_type: d.round_type,
        scheduled_start: d.scheduled_start,
        scheduled_end: d.scheduled_end,
        venue: d.venue,
        sort_order: d.sort_order,
        is_active: d.is_active,
      })),
      ...(scheduleRes.data ?? []).map((e) => ({
        id: e.id as string,
        title: e.title as string,
        description: (e.description as string | null) ?? null,
        type: 'entry' as const,
        entry_type: e.entry_type as string,
        scheduled_start: e.scheduled_start as string | null,
        scheduled_end: e.scheduled_end as string | null,
        venue: (e.venue as string | null) ?? null,
        sort_order: e.sort_order as number,
      })),
    ].sort((a, b) => {
      if (a.scheduled_start && b.scheduled_start) {
        return (
          new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
        )
      }
      if (a.scheduled_start) return -1
      if (b.scheduled_start) return 1
      return a.sort_order - b.sort_order
    })

    const seen = new Set<string>()
    const publicBoards = (tokensRes.data ?? [])
      .filter((t) => {
        if (seen.has(t.division_id)) return false
        seen.add(t.division_id)
        return true
      })
      .map((t) => {
        const div = enrichedDivisions.find((d) => d.id === t.division_id)
        return {
          divisionId: t.division_id,
          divisionName: div?.name || 'Division',
          token: t.token as string,
          viewsCount: t.views_count as number,
          scoringLocked: Boolean(div?.scoring_locked),
        }
      })

    const myBoards = enrichedDivisions
      .filter((d) => d.is_registered)
      .map((d) => ({
        divisionId: d.id,
        divisionName: d.name,
        scoringLocked: Boolean(d.scoring_locked),
      }))

    return NextResponse.json({
      event,
      registrationOpen: ['published', 'active'].includes(event.status),
      authenticated: Boolean(user),
      divisions: enrichedDivisions,
      schedule,
      myBoards,
      publicBoards,
    })
  } catch (error) {
    console.error('Event hub error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
