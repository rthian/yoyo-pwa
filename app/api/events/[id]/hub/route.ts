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
import {
  formatInTimeZone,
  getRegistrationAvailability,
} from '@/lib/events/timing'
import { getCompetitorIdsForAccount } from '@/lib/identity/competitors'
import { formatFeeCents } from '@/lib/payments/receipts'
import { buildPrepChecklistForRegistration } from '@/lib/prep/checklist'

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
      .select(
        `id, name, description, event_date, location, status,
         starts_at, ends_at, timezone,
         registration_opens_at, registration_closes_at, music_deadline_at,
         check_in_opens_at, check_in_closes_at,
         venue_name, address_line1, address_line2, city, region, postal_code, country_code,
         website_url, organizer_contact_name, organizer_contact_email, organizer_contact_public,
         results_published_at,
         payment_required, registration_fee_cents, registration_fee_currency,
         payment_instructions, payment_qr_url`
      )
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

    const reg = getRegistrationAvailability(event)
    const tz = event.timezone || 'UTC'

    const { data: divisions, error: divError } = await admin
      .from('divisions')
      .select(
        'id, name, description, scoring_type, round_type, scheduled_start, scheduled_end, venue, sort_order, scoring_locked, is_active, capacity, waitlist_enabled'
      )
      .eq('event_id', eventId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (divError) {
      return NextResponse.json({ error: divError.message }, { status: 500 })
    }

    const divisionIds = (divisions ?? []).map((d) => d.id)

    // Callers: EventHubClient — media rows: { id, title, url, kind, provider }
    // User: "prompt 13"
    const myCompetitorIds = user
      ? await getCompetitorIdsForAccount(admin, user.id)
      : []

    const [
      { data: counts },
      { data: registrations },
      scheduleRes,
      tokensRes,
      mediaRes,
    ] = await Promise.all([
      divisionIds.length
        ? admin.from('division_members').select('division_id').in('division_id', divisionIds)
        : Promise.resolve({ data: [] as { division_id: string }[] }),
      user && divisionIds.length && myCompetitorIds.length
        ? admin
            .from('division_members')
            .select('division_id, competitor_id')
            .in('competitor_id', myCompetitorIds)
            .in('division_id', divisionIds)
        : Promise.resolve({
            data: [] as { division_id: string; competitor_id: string }[],
          }),
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
      admin
        .from('event_external_media')
        .select(
          'id, title, url, kind, provider, description, thumbnail_url, sort_order, division_id'
        )
        .eq('event_id', eventId)
        .eq('is_public', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ])

    if (scheduleRes.error) {
      return NextResponse.json({ error: scheduleRes.error.message }, { status: 500 })
    }
    if (tokensRes.error) {
      return NextResponse.json({ error: tokensRes.error.message }, { status: 500 })
    }
    // Missing table before migration 020 — treat as empty media list
    const media =
      mediaRes.error && /event_external_media|schema cache/i.test(mediaRes.error.message)
        ? []
        : mediaRes.error
          ? null
          : mediaRes.data ?? []
    if (media === null) {
      return NextResponse.json({ error: mediaRes.error!.message }, { status: 500 })
    }

    const countMap = new Map<string, number>()
    for (const row of counts ?? []) {
      countMap.set(row.division_id, (countMap.get(row.division_id) || 0) + 1)
    }

    const registeredByDivision = new Map<string, string[]>()
    for (const r of registrations ?? []) {
      const row = r as { division_id: string; competitor_id: string }
      const list = registeredByDivision.get(row.division_id) ?? []
      list.push(row.competitor_id)
      registeredByDivision.set(row.division_id, list)
    }

    const enrichedDivisions = (divisions ?? []).map((d) => ({
      ...d,
      is_registered: (registeredByDivision.get(d.id)?.length ?? 0) > 0,
      registered_competitor_ids: registeredByDivision.get(d.id) || [],
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


    const feeLabel = event.payment_required
      ? formatFeeCents(
          event.registration_fee_cents as number | null,
          (event.registration_fee_currency as string) || 'SGD'
        )
      : null

    let prepChecklists: Array<{
      registrationId: string
      competitorId: string
      competitorName: string | null
      paymentStatus: string
      items: Awaited<ReturnType<typeof buildPrepChecklistForRegistration>>
    }> = []

    if (user && myCompetitorIds.length) {
      const { data: regs } = await admin
        .from('registrations')
        .select('id, competitor_id, payment_status, status')
        .eq('event_id', eventId)
        .in('competitor_id', myCompetitorIds)
        .not('status', 'eq', 'cancelled')

      const competitorIds = (regs ?? []).map((r) => r.competitor_id as string)
      const nameById = new Map<string, string>()
      if (competitorIds.length) {
        const { data: comps } = await admin
          .from('competitors')
          .select('id, full_name')
          .in('id', competitorIds)
        for (const c of comps ?? []) {
          nameById.set(c.id as string, c.full_name as string)
        }
      }

      for (const reg of regs ?? []) {
        const items = await buildPrepChecklistForRegistration(admin, {
          registrationId: reg.id as string,
          paymentStatus: reg.payment_status as string,
          venueName: event.venue_name as string | null,
        })
        prepChecklists.push({
          registrationId: reg.id as string,
          competitorId: reg.competitor_id as string,
          competitorName: nameById.get(reg.competitor_id as string) ?? null,
          paymentStatus: reg.payment_status as string,
          items,
        })
      }
    }

    return NextResponse.json({
      event: {
        ...event,
        starts_at_local: event.starts_at
          ? formatInTimeZone(event.starts_at, tz)
          : null,
        ends_at_local: event.ends_at ? formatInTimeZone(event.ends_at, tz) : null,
        registration_opens_at_local: event.registration_opens_at
          ? formatInTimeZone(event.registration_opens_at, tz)
          : null,
        registration_closes_at_local: event.registration_closes_at
          ? formatInTimeZone(event.registration_closes_at, tz)
          : null,
        music_deadline_at_local: event.music_deadline_at
          ? formatInTimeZone(event.music_deadline_at, tz)
          : null,
      },
      registrationOpen: reg.open,
      registrationReason: reg.reason,
      authenticated: Boolean(user),
      divisions: enrichedDivisions,
      schedule,
      myBoards,
      publicBoards,
      resultsPublished: Boolean(event.results_published_at),
      resultsPublishedAt: event.results_published_at ?? null,
      media,
      feeLabel,
      prepChecklists,
    })
  } catch (error) {
    console.error('Event hub error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
