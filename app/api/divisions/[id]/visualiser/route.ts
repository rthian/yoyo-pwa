/**
 * Head Judge Visualiser API
 * Returns all division scores (submitted + drafts) and analytics for head judges only
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import {
  computeParticipantPanelStats,
  computeOutliers,
  computeJudgeSummaries,
} from '@/lib/utils/judge-analytics'
import type { VisualiserScore } from '@/lib/types/visualiser'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: divisionId } = await params
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: currentMember } = await supabaseAdmin
      .from('members')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = currentMember?.role === 'admin'

    if (!isAdmin) {
      const { data: assignment } = await supabaseAdmin
        .from('division_judges')
        .select('judge_type')
        .eq('division_id', divisionId)
        .eq('member_id', user.id)
        .single()

      if (!assignment || assignment.judge_type !== 'head') {
        return NextResponse.json(
          { error: 'Only head judges or admins can view the visualiser' },
          { status: 403 }
        )
      }
    }

    const { data: division } = await supabaseAdmin
      .from('divisions')
      .select('id, name')
      .eq('id', divisionId)
      .single()

    if (!division) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 })
    }

    const { data: participants } = await supabaseAdmin
      .from('division_members')
      .select(`
        id,
        play_order,
        member:members(id, full_name, nickname)
      `)
      .eq('division_id', divisionId)
      .order('play_order', { ascending: true })

    const { data: judgesRows } = await supabaseAdmin
      .from('division_judges')
      .select(`
        member_id,
        judge_type,
        scores_included_in_leaderboard,
        member:members(id, full_name)
      `)
      .eq('division_id', divisionId)

    type JudgeRow = {
      member_id: string
      judge_type: string
      scores_included_in_leaderboard?: boolean
      member: { id: string; full_name: string } | { id: string; full_name: string }[] | null
    }
    const judges = (judgesRows ?? []).map((row: JudgeRow) => {
      const member = Array.isArray(row.member) ? row.member[0] : row.member
      return {
        id: row.member_id,
        full_name: member?.full_name ?? 'Unknown',
        judge_type: row.judge_type,
        scores_included_in_leaderboard: row.scores_included_in_leaderboard !== false,
      }
    })

    const countingJudgeIds = new Set(
      judges
        .filter(
          (j) =>
            j.judge_type !== 'shadow' &&
            j.scores_included_in_leaderboard !== false
        )
        .map((j) => j.id)
    )

    const judgeNameById = new Map(judges.map((j) => [j.id, j.full_name]))

    const { data: scoresRows } = await supabaseAdmin
      .from('scores')
      .select('*')
      .eq('division_id', divisionId)
      .order('division_member_id')
      .order('judge_id')

    const scores: VisualiserScore[] = (scoresRows ?? []).map(
      (s: {
        id: string
        division_member_id: string
        judge_id: string
        total_score: number
        technical_score: number
        performance_score: number
        is_submitted: boolean
        ex_clicks?: number
        ex_pv?: number
        ex_ch?: number
        ex_cons?: number
        ex_space?: number
        ex_body?: number
        ex_showman?: number
        ex_music?: number
        ex_construct?: number
        ex_trick_div?: number
        ex_deductions?: number
      }) => ({
        id: s.id,
        division_member_id: s.division_member_id,
        judge_id: s.judge_id,
        judge_name: judgeNameById.get(s.judge_id) ?? 'Unknown',
        total_score: Number(s.total_score),
        technical_score: Number(s.technical_score),
        performance_score: Number(s.performance_score),
        is_submitted: s.is_submitted,
        ex_clicks: s.ex_clicks,
        ex_pv: s.ex_pv,
        ex_ch: s.ex_ch,
        ex_cons: s.ex_cons,
        ex_space: s.ex_space,
        ex_body: s.ex_body,
        ex_showman: s.ex_showman,
        ex_music: s.ex_music,
        ex_construct: s.ex_construct,
        ex_trick_div: s.ex_trick_div,
        ex_deductions: s.ex_deductions,
      })
    )

    const participantNames = new Map<string, string>()
    for (const p of participants ?? []) {
      const raw = p.member as { id: string; full_name: string; nickname: string | null } | { id: string; full_name: string; nickname: string | null }[] | null
      const member = Array.isArray(raw) ? raw[0] : raw
      participantNames.set(p.id, member?.full_name ?? 'Unknown')
    }

    const countingScores = scores.filter((s) => countingJudgeIds.has(s.judge_id))
    const panelStats = computeParticipantPanelStats(countingScores)
    const outliers = computeOutliers(countingScores, panelStats, participantNames)
    const judgeSummaries = computeJudgeSummaries(countingScores, panelStats)

    return NextResponse.json({
      division: { id: division.id, name: division.name },
      participants: participants ?? [],
      judges,
      scores,
      panelStats: Array.from(panelStats.values()),
      outliers,
      judgeSummaries,
    })
  } catch (error) {
    console.error('Visualiser API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
