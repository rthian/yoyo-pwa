/**
 * GET /api/rankings — season points leaderboard.
 * Caller: app/rankings/page.tsx via fetch('/api/rankings?...').
 * Glob: no prior app/api/rankings/* files.
 * Reads: seasons, play_categories, ranking_points (+ members/geo). No writes.
 * Response shape: { entries:[{memberId,memberName,totalPoints,rank}], total, page }.
 * User: "create a branch for this, plan & build a ranking with point system league leaderboards where each contest participate score points while finalist and winners score more points..."
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { getLeagueRankings } from '@/lib/rankings/query'
import { NextResponse } from 'next/server'

export const revalidate = 300

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const seasonSlug = searchParams.get('season')
    const categoryCode = searchParams.get('category')
    const geoPath = searchParams.get('geo')
    const division = (searchParams.get('division') || 'open') as 'open' | 'women'
    const search = searchParams.get('q')
    const race = (searchParams.get('race') || 'world').toLowerCase()
    const focusMember = searchParams.get('member')
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)))
    const offset = (page - 1) * limit

    const supabase = createAdminClient()

    let seasonId: string | null = null
    let countingResults: number | null = null

    if (seasonSlug) {
      const { data: season } = await supabase
        .from('seasons')
        .select('id, counting_results')
        .eq('slug', seasonSlug)
        .single()
      seasonId = season?.id ?? null
      countingResults = season?.counting_results ?? null
    } else {
      const { data: season } = await supabase
        .from('seasons')
        .select('id, counting_results, slug')
        .eq('is_active', true)
        .maybeSingle()
      seasonId = season?.id ?? null
      countingResults = season?.counting_results ?? null
    }

    if (!seasonId) {
      return NextResponse.json(
        { error: 'No active season. Apply migration 004 and seed a season.' },
        { status: 404 }
      )
    }

    let categoryId: string | null = null
    if (categoryCode && categoryCode !== 'all') {
      const { data: cat } = await supabase
        .from('play_categories')
        .select('id')
        .eq('code', categoryCode.toUpperCase())
        .single()
      categoryId = cat?.id ?? null
      if (!categoryId) {
        return NextResponse.json({ error: 'Unknown category' }, { status: 400 })
      }
    }

    const isNational = race === 'national'
    const { entries, total, focusEntry } = await getLeagueRankings(supabase, {
      seasonId,
      categoryId,
      geoPath: geoPath || '/WORLD',
      division: division === 'women' ? 'women' : 'open',
      search,
      countingResults,
      worldRaceOnly: !isNational,
      nationalRaceOnly: isNational,
      focusMember,
      limit,
      offset,
    })

    return NextResponse.json(
      {
        entries,
        total,
        page,
        limit,
        focusEntry,
        filters: {
          seasonId,
          categoryCode: categoryCode || 'all',
          geoPath: geoPath || '/WORLD',
          division: division === 'women' ? 'women' : 'open',
          race: isNational ? 'national' : 'world',
          q: search || '',
          member: focusMember || '',
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        },
      }
    )
  } catch (error) {
    console.error('Rankings error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load rankings. Ensure migration 004 is applied.',
      },
      { status: 500 }
    )
  }
}
