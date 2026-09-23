/**
 * GET|PATCH|DELETE /api/admin/custom-leagues/[id]
 * PATCH body may include event_ids: string[] to replace the contest include list.
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCustomLeagueEventIds } from '@/lib/rankings/custom-league'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function requireAdmin() {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('role')
    .eq('id', user.id)
    .single()

  if (member?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { supabaseAdmin }
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error

    const { data: league, error } = await auth.supabaseAdmin!
      .from('custom_leagues')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!league) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const eventIds = await getCustomLeagueEventIds(auth.supabaseAdmin!, id)
    return NextResponse.json({ league, eventIds })
  } catch (error) {
    console.error('Admin get custom league:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error

    const body = await request.json()
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of [
      'name',
      'slug',
      'description',
      'counting_results',
      'eligibility_mode',
      'home_geo_id',
      'is_active',
      'season_id',
    ] as const) {
      if (key in body) patch[key] = body[key]
    }

    if (Object.keys(patch).length > 1) {
      const { error } = await auth.supabaseAdmin!
        .from('custom_leagues')
        .update(patch)
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (Array.isArray(body.event_ids)) {
      const eventIds = [...new Set(body.event_ids as string[])]
      const { data: leagueRow } = await auth.supabaseAdmin!
        .from('custom_leagues')
        .select('season_id')
        .eq('id', id)
        .single()
      if (!leagueRow) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      if (eventIds.length) {
        const { data: okEvents, error: evErr } = await auth.supabaseAdmin!
          .from('events')
          .select('id')
          .in('id', eventIds)
          .eq('season_id', leagueRow.season_id)
        if (evErr) return NextResponse.json({ error: evErr.message }, { status: 400 })
        const ok = new Set((okEvents ?? []).map((e) => e.id as string))
        const bad = eventIds.filter((eid) => !ok.has(eid))
        if (bad.length) {
          return NextResponse.json(
            {
              error:
                'Some events are missing or not in this league season (assign season_id on events)',
              invalidEventIds: bad,
            },
            { status: 400 }
          )
        }
        const rows = eventIds.map((event_id, i) => ({
          league_id: id,
          event_id,
          sort_order: i,
        }))
        const { error: upsertErr } = await auth.supabaseAdmin!
          .from('custom_league_events')
          .upsert(rows, { onConflict: 'league_id,event_id' })
        if (upsertErr) {
          return NextResponse.json({ error: upsertErr.message }, { status: 400 })
        }
      }
      // Remove contests no longer selected (only after upsert succeeds)
      const { data: existing } = await auth.supabaseAdmin!
        .from('custom_league_events')
        .select('event_id')
        .eq('league_id', id)
      const keep = new Set(eventIds)
      const toDelete = (existing ?? [])
        .map((r) => r.event_id as string)
        .filter((eid) => !keep.has(eid))
      if (toDelete.length) {
        const { error: delErr } = await auth.supabaseAdmin!
          .from('custom_league_events')
          .delete()
          .eq('league_id', id)
          .in('event_id', toDelete)
        if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })
      }
    }

    const { data: league } = await auth.supabaseAdmin!
      .from('custom_leagues')
      .select('*')
      .eq('id', id)
      .single()
    const eventIds = await getCustomLeagueEventIds(auth.supabaseAdmin!, id)
    return NextResponse.json({ league, eventIds })
  } catch (error) {
    console.error('Admin patch custom league:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error

    const { error } = await auth.supabaseAdmin!
      .from('custom_leagues')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin delete custom league:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}
