/**
 * POST|DELETE|GET /api/admin/events/[id]/finalize — award/revoke season points.
 * Caller: components/admin/FinalizeEventPanel.tsx (fetch this path).
 * GET includes soft TypeSafe finalize cue (advisory); hard blockers still gate POST.
 * Writes ranking_points rows; may set events.status='completed'. Dates: event_date YYYY-MM-DD.
 * User: "yes please"
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  finalizeEventPoints,
  getFinalizeBlockers,
  unfinalizeEventPoints,
} from '@/lib/rankings/finalize'
import { assessFinalizeReadiness } from '@/lib/typesafe/lock-readiness'
import {
  computeParticipantPanelStats,
  computeOutliers,
} from '@/lib/utils/judge-analytics'
import type { VisualiserScore } from '@/lib/types/visualiser'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

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
  return { supabaseAdmin }
}

async function gatherFinalizeSoftFacts(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  eventId: string,
  blockers: { code: string; message: string }[]
) {
  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, name')
    .eq('id', eventId)
    .single()

  const { data: divisions } = await supabaseAdmin
    .from('divisions')
    .select('id, name, category_id, scoring_locked')
    .eq('event_id', eventId)

  const ranked = (divisions ?? []).filter((d) => d.category_id)
  const unlocked = ranked.filter((d) => !d.scoring_locked)
  const locked = ranked.filter((d) => d.scoring_locked)

  let totalOutliersAcrossLocked = 0
  let excludedJudgeCount = 0

  for (const div of locked) {
    const { data: judgesRows } = await supabaseAdmin
      .from('division_judges')
      .select('member_id, judge_type, scores_included_in_leaderboard')
      .eq('division_id', div.id)

    const countingIds = new Set(
      (judgesRows ?? [])
        .filter(
          (j) =>
            j.judge_type !== 'shadow' && j.scores_included_in_leaderboard !== false
        )
        .map((j) => j.member_id)
    )
    excludedJudgeCount += (judgesRows ?? []).filter(
      (j) => j.judge_type !== 'shadow' && j.scores_included_in_leaderboard === false
    ).length

    const { data: participants } = await supabaseAdmin
      .from('division_members')
      .select('id, member:members(full_name)')
      .eq('division_id', div.id)

    const { data: scoresRows } = await supabaseAdmin
      .from('scores')
      .select(
        'id, division_member_id, judge_id, total_score, technical_score, performance_score, is_submitted'
      )
      .eq('division_id', div.id)

    const scores: VisualiserScore[] = (scoresRows ?? [])
      .filter((s) => countingIds.has(s.judge_id))
      .map((s) => ({
        id: s.id,
        division_member_id: s.division_member_id,
        judge_id: s.judge_id,
        judge_name: 'Judge',
        total_score: Number(s.total_score),
        technical_score: Number(s.technical_score),
        performance_score: Number(s.performance_score),
        is_submitted: s.is_submitted,
      }))

    const names = new Map<string, string>()
    for (const p of participants ?? []) {
      const raw = p.member as { full_name: string } | { full_name: string }[] | null
      const m = Array.isArray(raw) ? raw[0] : raw
      names.set(p.id, m?.full_name ?? 'Unknown')
    }
    const stats = computeParticipantPanelStats(scores)
    totalOutliersAcrossLocked += computeOutliers(scores, stats, names).length
  }

  return assessFinalizeReadiness({
    eventName: event?.name ?? 'Event',
    divisionCount: ranked.length,
    lockedDivisionCount: locked.length,
    unlockedDivisionNames: unlocked.map((d) => d.name),
    totalOutliersAcrossLocked,
    excludedJudgeCount,
    hardBlockers: blockers,
  })
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error

    const blockers = await getFinalizeBlockers(auth.supabaseAdmin!, id)
    const { count } = await auth.supabaseAdmin!
      .from('ranking_points')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)

    const soft = await gatherFinalizeSoftFacts(auth.supabaseAdmin!, id, blockers).catch(
      (err) => {
        console.error('Finalize soft cue failed:', err)
        return null
      }
    )

    return NextResponse.json({
      blockers,
      canFinalize: blockers.length === 0,
      awardsCount: count ?? 0,
      isFinalized: (count ?? 0) > 0,
      softCue: soft
        ? {
            configured: soft.configured,
            cue: soft.cue,
            confidence: soft.confidence,
            headline: soft.headline,
            reasons: soft.reasons,
            integrityRisk: soft.integrityRisk,
          }
        : null,
    })
  } catch (error) {
    console.error('Finalize status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error

    const result = await finalizeEventPoints(auth.supabaseAdmin!, id)
    if (!result.ok) {
      return NextResponse.json(
        { error: 'Cannot finalize', blockers: result.blockers },
        { status: 409 }
      )
    }
    return NextResponse.json({
      message: 'Season points awarded',
      awardsWritten: result.awardsWritten,
    })
  } catch (error) {
    console.error('Finalize error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error

    await unfinalizeEventPoints(auth.supabaseAdmin!, id)
    return NextResponse.json({ message: 'Season points revoked for this event' })
  } catch (error) {
    console.error('Unfinalize error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
