/**
 * Shared standings computation (same rules as live division leaderboard).
 * Called by: app/api/divisions/[id]/lock/route.ts (snapshot on lock),
 *            lib/rankings/finalize.ts (indirect via division_results).
 * No prior lib/rankings/standings.ts (Glob empty).
 * Writes division_results: { division_id, member_id, placement, total_score, score_count, source: 'auto' }.
 * User: create a branch… plan & build a ranking with point system league leaderboards…
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeagueStandingsRow } from './types'

export async function computeDivisionStandings(
  supabase: SupabaseClient,
  divisionId: string
): Promise<LeagueStandingsRow[]> {
  const { data: participants } = await supabase
    .from('division_members')
    .select('id, member_id, play_order')
    .eq('division_id', divisionId)
    .order('play_order', { ascending: true })

  if (!participants?.length) return []

  const { data: divisionJudges } = await supabase
    .from('division_judges')
    .select('member_id, judge_type, scores_included_in_leaderboard')
    .eq('division_id', divisionId)

  const countingJudgeIds = new Set(
    (divisionJudges ?? [])
      .filter(
        (j: {
          member_id: string
          judge_type: string
          scores_included_in_leaderboard?: boolean
        }) =>
          j.judge_type !== 'shadow' && j.scores_included_in_leaderboard !== false
      )
      .map((j: { member_id: string }) => j.member_id)
  )

  const { data: scores } = await supabase
    .from('scores')
    .select('division_member_id, judge_id, total_score, is_submitted')
    .eq('division_id', divisionId)
    .eq('is_submitted', true)

  const byParticipant = new Map<string, number[]>()
  for (const s of scores ?? []) {
    if (!countingJudgeIds.has(s.judge_id)) continue
    const list = byParticipant.get(s.division_member_id) ?? []
    list.push(Number(s.total_score) || 0)
    byParticipant.set(s.division_member_id, list)
  }

  const rows: LeagueStandingsRow[] = participants.map((p) => {
    const vals = byParticipant.get(p.id) ?? []
    const scoreCount = vals.length
    const totalScore =
      scoreCount > 0 ? vals.reduce((a, b) => a + b, 0) / scoreCount : 0
    return {
      memberId: p.member_id,
      totalScore: Math.round(totalScore * 100) / 100,
      scoreCount,
      placement: null,
    }
  })

  const ranked = [...rows]
    .filter((r) => r.scoreCount > 0)
    .sort((a, b) => b.totalScore - a.totalScore)

  let lastScore: number | null = null
  let lastRank = 0
  ranked.forEach((r, i) => {
    if (lastScore === null || r.totalScore !== lastScore) {
      lastRank = i + 1
      lastScore = r.totalScore
    }
    r.placement = lastRank
  })

  const placementByMember = new Map(ranked.map((r) => [r.memberId, r.placement]))
  return rows.map((r) => ({
    ...r,
    placement: placementByMember.get(r.memberId) ?? null,
  }))
}

export async function snapshotDivisionResults(
  supabase: SupabaseClient,
  divisionId: string
): Promise<number> {
  const standings = await computeDivisionStandings(supabase, divisionId)

  await supabase
    .from('division_results')
    .delete()
    .eq('division_id', divisionId)
    .eq('source', 'auto')

  if (!standings.length) return 0

  const rows = standings.map((s) => ({
    division_id: divisionId,
    member_id: s.memberId,
    placement: s.placement,
    total_score: s.scoreCount > 0 ? s.totalScore : null,
    score_count: s.scoreCount,
    source: 'auto' as const,
  }))

  const { error } = await supabase.from('division_results').upsert(rows, {
    onConflict: 'division_id,member_id',
  })

  if (error) throw new Error(error.message)
  return rows.length
}

export async function clearAutoDivisionResults(
  supabase: SupabaseClient,
  divisionId: string
): Promise<void> {
  const { error } = await supabase
    .from('division_results')
    .delete()
    .eq('division_id', divisionId)
    .eq('source', 'auto')

  if (error) throw new Error(error.message)
}

/** Counting judges × participants must all have submitted scores before lock. */
export async function getPanelLockBlockers(
  supabase: SupabaseClient,
  divisionId: string
): Promise<{ message: string; missing: number }> {
  const { data: participants } = await supabase
    .from('division_members')
    .select('id')
    .eq('division_id', divisionId)

  const { data: judges } = await supabase
    .from('division_judges')
    .select('member_id, judge_type, scores_included_in_leaderboard')
    .eq('division_id', divisionId)

  const counting = (judges ?? []).filter(
    (j) => j.judge_type !== 'shadow' && j.scores_included_in_leaderboard !== false
  )

  if (!participants?.length) {
    return { message: 'No competitors in this division', missing: 1 }
  }
  if (!counting.length) {
    return { message: 'No counting judges assigned', missing: 1 }
  }

  const { data: scores } = await supabase
    .from('scores')
    .select('division_member_id, judge_id')
    .eq('division_id', divisionId)
    .eq('is_submitted', true)

  const have = new Set(
    (scores ?? []).map((s) => `${s.division_member_id}:${s.judge_id}`)
  )

  let missing = 0
  for (const part of participants) {
    for (const j of counting) {
      if (!have.has(`${part.id}:${j.member_id}`)) missing++
    }
  }

  if (!missing) return { message: '', missing: 0 }
  return {
    missing,
    message: `Cannot lock yet — ${missing} submitted score${missing === 1 ? '' : 's'} still missing from counting judges`,
  }
}

