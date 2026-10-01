/**
 * Offline Score Sync API — durable client_submission_id + version outcomes.
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import {
  computeScores,
  majorDeductionPoints,
  type ScoringConfigLike,
  type ScoreFields,
} from '@/lib/judge/score-math'
import { writeScoreWithRevision, type SyncOutcome } from '@/lib/scores/revisions'

interface OfflineScore {
  clientId: string
  clientSubmissionId?: string
  expectedVersion?: number | null
  divisionId: string
  divisionMemberId: string
  scoreData: Record<string, number>
  timestamp: number
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { scores } = (await request.json()) as { scores: OfflineScore[] }

    if (!Array.isArray(scores) || scores.length === 0) {
      return NextResponse.json({ error: 'No scores to sync' }, { status: 400 })
    }

    const results: {
      clientId: string
      outcome: SyncOutcome
      scoreVersion?: number
      message?: string
    }[] = []

    for (const offlineScore of scores) {
      const clientSubmissionId =
        offlineScore.clientSubmissionId || offlineScore.clientId

      try {
        const { data: assignment } = await supabaseAdmin
          .from('division_judges')
          .select('id')
          .eq('division_id', offlineScore.divisionId)
          .eq('member_id', user.id)
          .maybeSingle()
        if (!assignment) {
          results.push({
            clientId: offlineScore.clientId,
            outcome: 'unauthorized',
            message: 'Not assigned',
          })
          continue
        }

        const { data: division } = await supabaseAdmin
          .from('divisions')
          .select('scoring_locked')
          .eq('id', offlineScore.divisionId)
          .maybeSingle()
        if (!division || division.scoring_locked) {
          results.push({
            clientId: offlineScore.clientId,
            outcome: 'locked',
            message: 'Division locked',
          })
          continue
        }

        const { data: participant } = await supabaseAdmin
          .from('division_members')
          .select('id')
          .eq('id', offlineScore.divisionMemberId)
          .eq('division_id', offlineScore.divisionId)
          .maybeSingle()
        if (!participant) {
          results.push({
            clientId: offlineScore.clientId,
            outcome: 'invalid',
            message: 'Participant not found',
          })
          continue
        }

        const { scoreData } = offlineScore
        const { data: divMeta } = await supabaseAdmin
          .from('divisions')
          .select(`
            round_type,
            event:events(ruleset:rulesets(scoring_config))
          `)
          .eq('id', offlineScore.divisionId)
          .single()

        type EventJoin = {
          ruleset:
            | { scoring_config: ScoringConfigLike }
            | { scoring_config: ScoringConfigLike }[]
            | null
        } | null
        const eventRaw = divMeta?.event as EventJoin | EventJoin[] | undefined
        const event = Array.isArray(eventRaw) ? eventRaw[0] : eventRaw
        const rulesetRaw = event?.ruleset
        const ruleset = Array.isArray(rulesetRaw) ? rulesetRaw[0] : rulesetRaw
        const scoringConfig = (ruleset?.scoring_config ?? null) as ScoringConfigLike | null

        const fields = {
          ex_clicks: scoreData.ex_clicks || 0,
          ex_pv: scoreData.ex_pv || 0,
          ex_ch: scoreData.ex_ch || 0,
          ex_cons: scoreData.ex_cons || 0,
          ex_space: scoreData.ex_space || 0,
          ex_body: scoreData.ex_body || 0,
          ex_showman: scoreData.ex_showman || 0,
          ex_music: scoreData.ex_music || 0,
          ex_construct: scoreData.ex_construct || 0,
          ex_trick_div: scoreData.ex_trick_div || 0,
          md_stop_count: scoreData.md_stop_count || 0,
          md_discard_count: scoreData.md_discard_count || 0,
          md_detach_count: scoreData.md_detach_count || 0,
        } as ScoreFields
        fields.ex_deductions = majorDeductionPoints(fields)
        const computed = computeScores(
          fields,
          scoringConfig,
          divMeta?.round_type ?? 'final'
        )

        const { data: existing } = await supabaseAdmin
          .from('scores')
          .select('*')
          .eq('division_member_id', offlineScore.divisionMemberId)
          .eq('judge_id', user.id)
          .maybeSingle()

        const finalData = {
          division_id: offlineScore.divisionId,
          division_member_id: offlineScore.divisionMemberId,
          judge_id: user.id,
          ...scoreData,
          md_stop_count: fields.md_stop_count,
          md_discard_count: fields.md_discard_count,
          md_detach_count: fields.md_detach_count,
          ex_deductions: fields.ex_deductions,
          technical_score: computed.technical,
          performance_score: computed.performance,
          total_score: computed.total,
          is_submitted: true,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        const write = await writeScoreWithRevision(supabaseAdmin, {
          actorId: user.id,
          payload: finalData,
          existing,
          expectedVersion:
            offlineScore.expectedVersion ?? existing?.score_version ?? null,
          clientSubmissionId,
          clientTimestamp: new Date(offlineScore.timestamp).toISOString(),
          reason: existing?.is_submitted ? 'offline sync overwrite' : null,
          source: 'offline_sync',
          overwriteSubmitted: true,
        })

        results.push({
          clientId: offlineScore.clientId,
          outcome: write.outcome,
          scoreVersion:
            write.outcome === 'accepted'
              ? (write.score.score_version as number)
              : existing?.score_version,
          message: write.outcome === 'accepted' ? undefined : write.message,
        })
      } catch (err) {
        console.error('Failed to sync score:', offlineScore.clientId, err)
        results.push({
          clientId: offlineScore.clientId,
          outcome: 'invalid',
          message: err instanceof Error ? err.message : 'sync error',
        })
      }
    }

    const accepted = results.filter((r) =>
      ['accepted', 'duplicate'].includes(r.outcome)
    )
    const failed = results.filter(
      (r) => !['accepted', 'duplicate'].includes(r.outcome)
    )

    return NextResponse.json({
      message: 'Sync complete',
      synced: accepted.length,
      failed: failed.length,
      results,
    })
  } catch (error) {
    console.error('Sync API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
