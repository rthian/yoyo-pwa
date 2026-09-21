/**
 * GET /api/rankings/leagues/[slug] — Custom League standings.
 * Called by: components/rankings/RankingsClient.tsx (league board fetch).
 * Existing file; switched to createAdminClient to avoid members RLS recursion.
 * Reads: custom_leagues, custom_league_events, ranking_points+members (public standings).
 * User: when switch to dragon league i get this error "infinite recursion detected in policy for relation "members""
 */
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getCustomLeagueBySlug,
  getCustomLeagueEventIds,
  getHomeGeoPath,
} from '@/lib/rankings/custom-league'
import { getLeagueRankings } from '@/lib/rankings/query'
import type { DivisionFilter } from '@/lib/rankings/types'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ slug: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const seasonSlug = searchParams.get('season')
    const category = searchParams.get('category')
    const geo = searchParams.get('geo')
    const division = (searchParams.get('division') as DivisionFilter) || 'open'
    const q = searchParams.get('q')
    const limit = Number(searchParams.get('limit') || 100)
    const offset = Number(searchParams.get('offset') || 0)

    const supabase = createAdminClient()

    let seasonId: string | undefined
    if (seasonSlug) {
      const { data: season } = await supabase
        .from('seasons')
        .select('id')
        .eq('slug', seasonSlug)
        .maybeSingle()
      if (!season) {
        return NextResponse.json({ error: 'Season not found' }, { status: 404 })
      }
      seasonId = season.id
    }

    const league = await getCustomLeagueBySlug(supabase, slug, { seasonId })
    if (!league) {
      return NextResponse.json({ error: 'Custom League not found' }, { status: 404 })
    }

    const eventIds = await getCustomLeagueEventIds(supabase, league.id)

    let categoryId: string | null = null
    if (category && category !== 'all') {
      const { data: cat } = await supabase
        .from('play_categories')
        .select('id')
        .eq('code', category.toUpperCase())
        .maybeSingle()
      if (!cat) {
        return NextResponse.json({ error: 'Unknown category' }, { status: 400 })
      }
      categoryId = cat.id
    }

    let geoPath: string | null = null
    if (league.eligibility_mode === 'home_geo') {
      geoPath = await getHomeGeoPath(supabase, league.home_geo_id)
    } else if (geo) {
      geoPath = geo
    }

    const { entries, total } = await getLeagueRankings(supabase, {
      seasonId: league.season_id,
      categoryId,
      geoPath,
      division,
      search: q,
      countingResults: league.counting_results,
      eventIds,
      limit,
      offset,
    })

    return NextResponse.json(
      {
        league,
        eventCount: eventIds.length,
        entries,
        total,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        },
      }
    )
  } catch (error) {
    console.error('Custom league standings error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load league' },
      { status: 500 }
    )
  }
}
