/**
 * GET /api/rankings/leagues — list active Custom Leagues for a season.
 * Called by rankings filters / RankingsClient. Existing route; admin client.
 * User: when switch to dragon league i get this error "infinite recursion detected..."
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { listCustomLeagues } from '@/lib/rankings/custom-league'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const seasonSlug = searchParams.get('season')
    const supabase = createAdminClient()

    let seasonId: string | undefined
    if (seasonSlug) {
      const { data: season } = await supabase
        .from('seasons')
        .select('id')
        .eq('slug', seasonSlug)
        .maybeSingle()
      seasonId = season?.id
    } else {
      const { data: season } = await supabase
        .from('seasons')
        .select('id')
        .eq('is_active', true)
        .maybeSingle()
      seasonId = season?.id ?? undefined
    }

    const leagues = await listCustomLeagues(supabase, { seasonId })
    return NextResponse.json({ leagues })
  } catch (error) {
    console.error('List custom leagues error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list leagues' },
      { status: 500 }
    )
  }
}
