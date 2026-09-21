/**
 * GET|POST /api/admin/custom-leagues — list/create Custom Leagues.
 * Admin picks which contests count (via custom_league_events).
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listCustomLeagues } from '@/lib/rankings/custom-league'
import { NextResponse } from 'next/server'

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
  return { supabaseAdmin, userId: user.id }
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const seasonId = searchParams.get('seasonId') || undefined
    const leagues = await listCustomLeagues(auth.supabaseAdmin!, {
      seasonId,
      includeInactive: true,
    })
    return NextResponse.json({ leagues })
  } catch (error) {
    console.error('Admin list custom leagues:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error

    const body = await request.json()
    const name = String(body.name || '').trim()
    if (!name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }
    const seasonId = body.season_id as string | undefined
    if (!seasonId) {
      return NextResponse.json({ error: 'season_id required' }, { status: 400 })
    }

    const eligibility = body.eligibility_mode === 'home_geo' ? 'home_geo' : 'open'
    if (eligibility === 'home_geo' && !body.home_geo_id) {
      return NextResponse.json({ error: 'home_geo_id required for home_geo' }, { status: 400 })
    }

    const slug = String(body.slug || slugify(name))
    const { data, error } = await auth.supabaseAdmin!
      .from('custom_leagues')
      .insert({
        season_id: seasonId,
        name,
        slug,
        description: body.description ?? null,
        counting_results: body.counting_results ?? null,
        eligibility_mode: eligibility,
        home_geo_id: eligibility === 'home_geo' ? body.home_geo_id : null,
        is_active: body.is_active !== false,
        created_by: auth.userId,
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ league: data }, { status: 201 })
  } catch (error) {
    console.error('Admin create custom league:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}
