/**
 * Leaderboard API Route
 * Returns calculated leaderboard for a division
 * Uses admin client to bypass RLS (supports public token-based access)
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ divisionId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { divisionId } = await params
    const supabaseAdmin = createAdminClient()
    
    // Check if public access via token
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (token) {
      // Verify token
      const { data: tokenData } = await supabaseAdmin
        .from('leaderboard_tokens')
        .select('*')
        .eq('token', token)
        .eq('division_id', divisionId)
        .eq('is_active', true)
        .single()

      if (!tokenData) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 403 }
        )
      }

      // Update view count
      await supabaseAdmin
        .from('leaderboard_tokens')
        .update({ views_count: (tokenData.views_count || 0) + 1 })
        .eq('id', tokenData.id)
    } else {
      // Check authentication
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    // Get division info
    const { data: division } = await supabaseAdmin
      .from('divisions')
      .select(`
        *,
        event:events(id, name, status)
      `)
      .eq('id', divisionId)
      .single()

    if (!division) {
      return NextResponse.json(
        { error: 'Division not found' },
        { status: 404 }
      )
    }

    const scoresHidden =
      division.hide_scores_until_complete === true &&
      division.scoring_locked !== true

    if (scoresHidden) {
      return NextResponse.json({
        division,
        leaderboard: [],
        lastUpdated: new Date().toISOString(),
        scoresHidden: true,
      })
    }

    // Get all participants with their scores
    const { data: participants } = await supabaseAdmin
      .from('division_members')
      .select(`
        id,
        play_order,
        member:members(id, full_name, nickname, country)
      `)
      .eq('division_id', divisionId)
      .order('play_order', { ascending: true })

    if (!participants || participants.length === 0) {
      return NextResponse.json({
        division,
        leaderboard: [],
        lastUpdated: new Date().toISOString(),
        scoresHidden: false,
      })
    }

    // Judges whose scores count: included in leaderboard and not shadow
    const { data: divisionJudges } = await supabaseAdmin
      .from('division_judges')
      .select('member_id, judge_type, scores_included_in_leaderboard')
      .eq('division_id', divisionId)

    const countingJudgeIds = new Set(
      (divisionJudges ?? [])
        .filter(
          (j: { member_id: string; judge_type: string; scores_included_in_leaderboard?: boolean }) =>
            j.judge_type !== 'shadow' &&
            (j.scores_included_in_leaderboard !== false)
        )
        .map((j: { member_id: string }) => j.member_id)
    )

    // Get submitted scores for each participant
    const { data: scores } = await supabaseAdmin
      .from('scores')
      .select('*')
      .eq('division_id', divisionId)
      .eq('is_submitted', true)

    // Calculate averages using only counting judges
    type ParticipantMember = { id: string; full_name: string; nickname: string | null; country: string | null } | null
    const leaderboard = participants.map(participant => {
      const member = participant.member as unknown as ParticipantMember
      const participantScores = (scores?.filter(
        s => s.division_member_id === participant.id && countingJudgeIds.has(s.judge_id)
      ) || [])

      const scoreCount = participantScores.length
      
      if (scoreCount === 0) {
        return {
          memberId: member?.id,
          memberName: member?.full_name,
          nickname: member?.nickname,
          country: member?.country,
          playOrder: participant.play_order,
          avgTechnical: 0,
          avgPerformance: 0,
          totalScore: 0,
          scoreCount: 0,
          rank: null as number | null,
        }
      }

      const avgTechnical = participantScores.reduce(
        (sum, s) => sum + (s.technical_score || 0), 0
      ) / scoreCount

      const avgPerformance = participantScores.reduce(
        (sum, s) => sum + (s.performance_score || 0), 0
      ) / scoreCount

      const totalScore = participantScores.reduce(
        (sum, s) => sum + (s.total_score || 0), 0
      ) / scoreCount

      return {
        memberId: member?.id,
        memberName: member?.full_name,
        nickname: member?.nickname,
        country: member?.country,
        playOrder: participant.play_order,
        avgTechnical: Math.round(avgTechnical * 100) / 100,
        avgPerformance: Math.round(avgPerformance * 100) / 100,
        totalScore: Math.round(totalScore * 100) / 100,
        scoreCount,
        rank: null as number | null,
      }
    })

    // Sort by total score and assign ranks
    leaderboard.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
    
    let currentRank = 1
    leaderboard.forEach((entry, index) => {
      if (entry.scoreCount > 0) {
        // Handle ties
        if (index > 0 && entry.totalScore === leaderboard[index - 1].totalScore) {
          entry.rank = leaderboard[index - 1].rank
        } else {
          entry.rank = currentRank
        }
        currentRank++
      }
    })

    return NextResponse.json({
      division,
      leaderboard,
      lastUpdated: new Date().toISOString(),
      scoresHidden: false,
    })
  } catch (error) {
    console.error('Leaderboard API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
