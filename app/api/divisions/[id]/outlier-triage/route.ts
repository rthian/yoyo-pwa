/**
 * Outlier triage API — TypeSafe classifies outliers; code gates exclude.
 * Callers: components/judge/JudgeVisualiser.tsx
 * Auth: head judge or admin (same as visualiser).
 * User: "Lets start" (outlier triage)
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import {
  computeParticipantPanelStats,
  computeOutliers,
  computeJudgeSummaries,
} from '@/lib/utils/judge-analytics'
import {
  triageOutliers,
  mintExcludeApplyToken,
  verifyExcludeApplyToken,
  EXCLUDE_CONFIDENCE_MIN,
  ACT_CONFIDENCE_FLOOR,
} from '@/lib/typesafe/outlier-triage'
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
      error: 'Only head judges or admins can triage outliers',
    }
  }

  return { ok: true as const, supabaseAdmin }
}

async function loadPanelAnalytics(
  divisionId: string,
  supabaseAdmin: ReturnType<typeof createAdminClient>
) {
  const { data: division } = await supabaseAdmin
    .from('divisions')
    .select('id, name, scoring_locked')
    .eq('id', divisionId)
    .single()

  if (!division) return null

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
      id,
      member_id,
      judge_type,
      scores_included_in_leaderboard,
      member:members(id, full_name)
    `)
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
      assignmentId: row.id,
      id: row.member_id,
      full_name: member?.full_name ?? 'Unknown',
      judge_type: row.judge_type,
      scores_included_in_leaderboard: row.scores_included_in_leaderboard !== false,
    }
  })

  const countingJudgeIds = new Set(
    judges
      .filter(
        (j) => j.judge_type !== 'shadow' && j.scores_included_in_leaderboard !== false
      )
      .map((j) => j.id)
  )

  const judgeNameById = new Map(judges.map((j) => [j.id, j.full_name]))

  const { data: scoresRows } = await supabaseAdmin
    .from('scores')
    .select('*')
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

  const participantNames = new Map<string, string>()
  for (const p of participants ?? []) {
    const raw = p.member as
      | { id: string; full_name: string; nickname: string | null }
      | { id: string; full_name: string; nickname: string | null }[]
      | null
    const member = Array.isArray(raw) ? raw[0] : raw
    participantNames.set(p.id, member?.full_name ?? 'Unknown')
  }

  const countingScores = scores.filter((s) => countingJudgeIds.has(s.judge_id))
  const panelStats = computeParticipantPanelStats(countingScores)
  const outliers = computeOutliers(countingScores, panelStats, participantNames)
  const judgeSummaries = computeJudgeSummaries(countingScores, panelStats)

  return {
    division,
    judges,
    outliers,
    judgeSummaries,
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: divisionId } = await params
    const auth = await assertHeadOrAdmin(divisionId)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action === 'apply' ? 'apply' : 'evaluate'

    const analytics = await loadPanelAnalytics(divisionId, auth.supabaseAdmin)
    if (!analytics) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 })
    }

    if (action === 'evaluate') {
      const triage = await triageOutliers({
        divisionName: analytics.division.name,
        outliers: analytics.outliers,
        judgeSummaries: analytics.judgeSummaries,
        judges: analytics.judges,
      })

      // One apply token per judge (best exclude confidence), judge-level mutate
      const bestByJudge = new Map<string, (typeof triage.items)[0]>()
      for (const item of triage.items) {
        if (item.decision !== 'exclude') continue
        const prev = bestByJudge.get(item.judgeId)
        if (!prev || item.confidence > prev.confidence) {
          bestByJudge.set(item.judgeId, item)
        }
      }

      const items = triage.items.map((item) => {
        const best = bestByJudge.get(item.judgeId)
        const isBest =
          best &&
          best.key === item.key &&
          (item.canAutoExclude || item.needsConfirmToExclude)
        const applyToken =
          isBest && triage.configured
            ? mintExcludeApplyToken(divisionId, item)
            : null
        return { ...item, applyToken }
      })

      return NextResponse.json({
        configured: triage.configured,
        items,
        thresholds: triage.thresholds,
        outlierCount: analytics.outliers.length,
        scoringLocked: Boolean(analytics.division.scoring_locked),
      })
    }

    // apply — uses evaluate token; does not re-call TypeSafe
    if (!process.env.TYPESAFE_API_KEY?.trim()) {
      return NextResponse.json(
        { error: 'TypeSafe is not configured (TYPESAFE_API_KEY)' },
        { status: 503 }
      )
    }

    if (analytics.division.scoring_locked) {
      return NextResponse.json(
        {
          error:
            'Division is locked. Unlock scoring before changing who counts in results.',
        },
        { status: 409 }
      )
    }

    const judgeId = typeof body.judgeId === 'string' ? body.judgeId : ''
    const applyToken = typeof body.applyToken === 'string' ? body.applyToken : ''
    if (!judgeId || !applyToken) {
      return NextResponse.json(
        { error: 'judgeId and applyToken required' },
        { status: 400 }
      )
    }

    const verified = verifyExcludeApplyToken(applyToken, divisionId, judgeId)
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: 400 })
    }

    const { confidence } = verified.payload
    const confirm = Boolean(body.confirm)

    if (confidence < ACT_CONFIDENCE_FLOOR) {
      return NextResponse.json(
        { error: 'Confidence too low to exclude', confidence },
        { status: 400 }
      )
    }

    if (confidence < EXCLUDE_CONFIDENCE_MIN && !confirm) {
      return NextResponse.json(
        {
          error: 'Confirm required for mid-confidence exclude',
          confidence,
          needsConfirm: true,
          thresholds: {
            excludeConfidenceMin: EXCLUDE_CONFIDENCE_MIN,
            actConfidenceFloor: ACT_CONFIDENCE_FLOOR,
          },
        },
        { status: 409 }
      )
    }

    // Deterministic: judge must still be an outlier on the live panel
    const stillOutlier = analytics.outliers.some((o) => o.judge_id === judgeId)
    if (!stillOutlier) {
      return NextResponse.json(
        { error: 'No current outliers for this judge — refresh and triage again' },
        { status: 400 }
      )
    }

    const judge = analytics.judges.find((j) => j.id === judgeId)
    if (!judge) {
      return NextResponse.json({ error: 'Judge not found' }, { status: 404 })
    }
    if (judge.judge_type === 'shadow') {
      return NextResponse.json(
        { error: 'Shadow judges never count; nothing to exclude' },
        { status: 400 }
      )
    }
    if (judge.scores_included_in_leaderboard === false) {
      return NextResponse.json({ success: true, alreadyExcluded: true })
    }

    const { error } = await auth.supabaseAdmin
      .from('division_judges')
      .update({ scores_included_in_leaderboard: false })
      .eq('id', judge.assignmentId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      judgeId,
      confidence,
      confirmed: confirm || confidence >= EXCLUDE_CONFIDENCE_MIN,
    })
  } catch (error) {
    console.error('Outlier triage API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
