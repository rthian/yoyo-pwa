/**
 * Member History API Route
 * Fetches participation history with scores and rankings for the current member
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all division memberships with event info
    const { data: memberships, error: memberError } = await supabaseAdmin
      .from('division_members')
      .select(`
        id,
        status,
        play_order,
        created_at,
        division:divisions(
          id,
          name,
          round_type,
          event:events(
            id,
            name,
            event_date,
            location,
            status
          )
        )
      `)
      .eq('member_id', user.id)
      .order('created_at', { ascending: false })

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    // Fetch scores for this member
    const { data: scores, error: scoreError } = await supabaseAdmin
      .from('scores')
      .select(`
        id,
        total_score,
        division_id,
        created_at
      `)
      .eq('participant_id', user.id)

    if (scoreError) {
      return NextResponse.json({ error: scoreError.message }, { status: 500 })
    }

    // Build score map: division_id -> array of scores
    const scoreMap = new Map<string, number[]>()
    for (const score of scores || []) {
      if (!scoreMap.has(score.division_id)) {
        scoreMap.set(score.division_id, [])
      }
      scoreMap.get(score.division_id)!.push(score.total_score || 0)
    }

    type DivisionWithEvent = {
      id: string; name: string; round_type: string | null
      event: { id: string; name: string; event_date: string | null; location: string | null; status: string } | null
    }

    // For ranking, fetch all scores per division the member participated in
    const divisionIds = (memberships || [])
      .map(m => (m.division as DivisionWithEvent)?.id)
      .filter(Boolean)

    const rankingMap = new Map<string, { rank: number; total: number }>()

    if (divisionIds.length > 0) {
      // Get all scores grouped by division
      const { data: allDivScores } = await supabaseAdmin
        .from('scores')
        .select('participant_id, division_id, total_score')
        .in('division_id', divisionIds)

      // Calculate rankings per division
      const divScoreGroups = new Map<string, Map<string, number>>()
      for (const s of allDivScores || []) {
        if (!divScoreGroups.has(s.division_id)) {
          divScoreGroups.set(s.division_id, new Map())
        }
        const participantScores = divScoreGroups.get(s.division_id)!
        const current = participantScores.get(s.participant_id) || 0
        participantScores.set(s.participant_id, current + (s.total_score || 0))
      }

      for (const [divId, participantScores] of divScoreGroups) {
        const sorted = Array.from(participantScores.entries())
          .sort((a, b) => b[1] - a[1])
        const rank = sorted.findIndex(([pid]) => pid === user.id) + 1
        if (rank > 0) {
          rankingMap.set(divId, { rank, total: sorted.length })
        }
      }
    }

    // Build history
    const history = (memberships || []).map(m => {
      const division = m.division as DivisionWithEvent
      const event = division?.event
      const divId = division?.id
      const memberScores = scoreMap.get(divId) || []
      const avgScore = memberScores.length > 0
        ? memberScores.reduce((a, b) => a + b, 0) / memberScores.length
        : null
      const ranking = rankingMap.get(divId) || null

      return {
        id: m.id,
        registered_at: m.created_at,
        status: m.status,
        division: {
          id: divId,
          name: division?.name,
          round_type: division?.round_type,
        },
        event: event ? {
          id: event.id,
          name: event.name,
          event_date: event.event_date,
          location: event.location,
          status: event.status,
        } : null,
        scores: {
          count: memberScores.length,
          average: avgScore ? Math.round(avgScore * 100) / 100 : null,
        },
        ranking,
      }
    })

    return NextResponse.json({ history })
  } catch (error) {
    console.error('Member history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
