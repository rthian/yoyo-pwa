/**
 * GET soft-lock readiness cue for a division.
 * Callers: components/judge/LockDivisionButton.tsx (fetch `/api/divisions/:id/lock-readiness`).
 * Glob: app/api/divisions/[id]/ has lock, outlier-triage, visualiser — no lock-readiness yet.
 * Auth: head judge or admin. Advisory only — does not mutate lock state.
 * Reads Supabase: divisions, division_members, division_judges, scores.
 * Synthetic response: { cue: "caution", facts: { submittedRatio: 0.92, missingScoreCount: 1 } }
 * User instruction verbatim: yes please
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import {
  computeParticipantPanelStats,
  computeOutliers,
} from '@/lib/utils/judge-analytics'
import { assessLockReadiness } from '@/lib/typesafe/lock-readiness'
import type { VisualiserScore } from '@/lib/types/visualiser'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function assertHeadOrAdmin(divisionId: string) {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false as const, status: 401, error: 'Unauthorized' }

  const { data: currentMember } = await supabaseAdmin
    .from('members')
    .select('role')
    .eq('id', user.id)
    .single()

  if (currentMember?.role === 'admin') {
    return { ok: true as const, supabaseAdmin }
  }

  const { data: assignment } = await supabaseAdmin
    .from('division_judges')
    .select('judge_type')
    .eq('division_id', divisionId)
    .eq('member_id', user.id)
    .single()

  if (!assignment || assignment.judge_type !== 'head') {
    return {
      ok: false as const,
      status: 403,
      error: 'Only head judges or admins can view lock readiness',
    }
  }

  return { ok: true as const, supabaseAdmin }
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: divisionId } = await params
    const auth = await assertHeadOrAdmin(divisionId)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: division } = await auth.supabaseAdmin
      .from('divisions')
      .select('id, name, scoring_locked')
      .eq('id', divisionId)
      .single()

    if (!division) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 })
    }

    const { data: participants } = await auth.supabaseAdmin
      .from('division_members')
      .select('id, member:members(id, full_name)')
      .eq('division_id', divisionId)

    const { data: judgesRows } = await auth.supabaseAdmin
      .from('division_judges')
      .select(
        `
        id,
        member_id,
        judge_type,
        scores_included_in_leaderboard,
        member:members(id, full_name)
      `
      )
      .eq('division_id', divisionId)

    type JudgeRow = {
      id: string
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

    const countingJudges = judges.filter(
      (j) => j.judge_type !== 'shadow' && j.scores_included_in_leaderboard !== false
    )
    const countingJudgeIds = new Set(countingJudges.map((j) => j.id))
    const judgeNameById = new Map(judges.map((j) => [j.id, j.full_name]))

    const { data: scoresRows } = await auth.supabaseAdmin
      .from('scores')
      .select(
        'id, division_member_id, judge_id, total_score, technical_score, performance_score, is_submitted'
      )
      .eq('division_id', divisionId)

    const scores: VisualiserScore[] = (scoresRows ?? []).map(
      (s: {
        id: string
        division_member_id: string
        judge_id: string
        total_score: number
        technical_score: number
        performance_score: number
        is_submitted: boolean
      }) => ({
        id: s.id,
        division_member_id: s.division_member_id,
        judge_id: s.judge_id,
        judge_name: judgeNameById.get(s.judge_id) ?? 'Unknown',
        total_score: Number(s.total_score),
        technical_score: Number(s.technical_score),
        performance_score: Number(s.performance_score),
        is_submitted: s.is_submitted,
      })
    )

    const countingScores = scores.filter((s) => countingJudgeIds.has(s.judge_id))
    const participantIds = (participants ?? []).map((p) => p.id)
    const participantCount = participantIds.length
    const countingJudgeCount = countingJudges.length
    const expectedScoreCells = participantCount * countingJudgeCount

    const submittedPairs = new Set<string>()
    const draftPairs = new Set<string>()
    for (const s of countingScores) {
      const key = `${s.judge_id}:${s.division_member_id}`
      if (s.is_submitted) submittedPairs.add(key)
      else draftPairs.add(key)
    }

    const submittedScoreCount = submittedPairs.size
    const draftScoreCount = [...draftPairs].filter((k) => !submittedPairs.has(k)).length
    const missingScoreCount = Math.max(
      0,
      expectedScoreCells - submittedScoreCount - draftScoreCount
    )
    const submittedRatio =
      expectedScoreCells > 0 ? submittedScoreCount / expectedScoreCells : 0

    const participantNames = new Map<string, string>()
    for (const p of participants ?? []) {
      const raw = p.member as
        | { id: string; full_name: string }
        | { id: string; full_name: string }[]
        | null
      const member = Array.isArray(raw) ? raw[0] : raw
      participantNames.set(p.id, member?.full_name ?? 'Unknown')
    }

    const panelStats = computeParticipantPanelStats(countingScores)
    const outliers = computeOutliers(countingScores, panelStats, participantNames)
    const excludedJudgeCount = judges.filter(
      (j) => j.judge_type !== 'shadow' && j.scores_included_in_leaderboard === false
    ).length

    const result = await assessLockReadiness({
      divisionName: division.name,
      scoringLocked: Boolean(division.scoring_locked),
      participantCount,
      countingJudgeCount,
      expectedScoreCells,
      submittedScoreCount,
      draftScoreCount,
      missingScoreCount,
      outlierCount: outliers.length,
      excludedJudgeCount,
      submittedRatio: Math.round(submittedRatio * 1000) / 1000,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Lock readiness error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
