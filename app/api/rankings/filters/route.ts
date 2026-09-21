/**
 * GET /api/rankings/filters — filter chip data for rankings UI.
 * Caller: app/rankings/page.tsx / RankingsClient via fetch('/api/rankings/filters').
 * Reads seasons, play_categories, geo_nodes, event_tiers, custom_leagues.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const revalidate = 300

export async function GET() {
  try {
    const supabase = createAdminClient()

    const [seasonsRes, categoriesRes, geoRes, tiersRes, leaguesRes] = await Promise.all([
      supabase.from('seasons').select('*').order('starts_on', { ascending: false }),
      supabase
        .from('play_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('geo_nodes')
        .select('id, parent_id, level, code, name, iso_alpha2, path, sort_order')
        .order('sort_order')
        .order('name'),
      supabase.from('event_tiers').select('*').order('sort_order'),
      supabase
        .from('custom_leagues')
        .select('id, season_id, name, slug, is_active, counting_results')
        .eq('is_active', true)
        .order('name'),
    ])

    if (seasonsRes.error || categoriesRes.error || geoRes.error) {
      return NextResponse.json(
        {
          error:
            seasonsRes.error?.message ||
            categoriesRes.error?.message ||
            geoRes.error?.message ||
            'Failed to load filters',
          hint: 'Apply supabase/migrations/004_league_rankings.sql',
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        seasons: seasonsRes.data ?? [],
        categories: categoriesRes.data ?? [],
        geoNodes: geoRes.data ?? [],
        tiers: tiersRes.data ?? [],
        leagues: leaguesRes.error ? [] : leaguesRes.data ?? [],
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error('Rankings filters error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
