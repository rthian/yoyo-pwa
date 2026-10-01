/**
 * Shared score write path with revisions + optimistic concurrency.
 * Callers: app/api/scores, app/api/scores/sync
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type SyncOutcome =
  | 'accepted'
  | 'duplicate'
  | 'superseded'
  | 'locked'
  | 'unauthorized'
  | 'invalid'
  | 'conflict'

export type ScoreWriteResult =
  | { outcome: 'accepted'; score: Record<string, unknown>; revisionId?: string }
  | { outcome: Exclude<SyncOutcome, 'accepted'>; message: string; score?: Record<string, unknown> }

export async function appendScoreRevision(
  supabase: SupabaseClient,
  args: {
    scoreId: string
    divisionId: string
    divisionMemberId: string
    judgeId: string
    scoreVersion: number
    previousPayload: Record<string, unknown> | null
    newPayload: Record<string, unknown>
    actorAccountId: string
    reason?: string | null
    source: 'online' | 'offline_sync' | 'admin' | 'system'
    clientSubmissionId?: string | null
    clientTimestamp?: string | null
    syncOutcome?: SyncOutcome | null
  }
) {
  const { data, error } = await supabase
    .from('score_revisions')
    .insert({
      score_id: args.scoreId,
      division_id: args.divisionId,
      division_member_id: args.divisionMemberId,
      judge_id: args.judgeId,
      score_version: args.scoreVersion,
      previous_payload: args.previousPayload,
      new_payload: args.newPayload,
      actor_account_id: args.actorAccountId,
      reason: args.reason ?? null,
      source: args.source,
      client_submission_id: args.clientSubmissionId ?? null,
      client_timestamp: args.clientTimestamp ?? null,
      sync_outcome: args.syncOutcome ?? 'accepted',
    })
    .select('id')
    .single()
  if (error) throw error
  return data
}

export async function writeScoreWithRevision(
  supabase: SupabaseClient,
  args: {
    actorId: string
    payload: Record<string, unknown>
    existing?: {
      id: string
      is_submitted?: boolean
      score_version?: number
      client_submission_id?: string | null
      updated_at?: string
      [key: string]: unknown
    } | null
    expectedVersion?: number | null
    clientSubmissionId?: string | null
    clientTimestamp?: string | null
    reason?: string | null
    source: 'online' | 'offline_sync' | 'admin' | 'system'
    overwriteSubmitted?: boolean
  }
): Promise<ScoreWriteResult> {
  const {
    actorId,
    payload,
    existing,
    expectedVersion,
    clientSubmissionId,
    clientTimestamp,
    reason,
    source,
    overwriteSubmitted,
  } = args

  if (clientSubmissionId) {
    const { data: byClient } = await supabase
      .from('scores')
      .select('*')
      .eq('client_submission_id', clientSubmissionId)
      .maybeSingle()
    if (byClient) {
      await appendScoreRevision(supabase, {
        scoreId: byClient.id,
        divisionId: byClient.division_id as string,
        divisionMemberId: byClient.division_member_id as string,
        judgeId: byClient.judge_id as string,
        scoreVersion: (byClient.score_version as number) ?? 1,
        previousPayload: null,
        newPayload: byClient as Record<string, unknown>,
        actorAccountId: actorId,
        reason: 'duplicate client_submission_id',
        source,
        clientSubmissionId,
        clientTimestamp,
        syncOutcome: 'duplicate',
      }).catch(() => null)
      return { outcome: 'duplicate', message: 'Already accepted', score: byClient }
    }
  }

  if (existing?.is_submitted && payload.is_submitted && !overwriteSubmitted) {
    if (!reason) {
      return {
        outcome: 'invalid',
        message: 'Reason required when overwriting a submitted score',
      }
    }
  }

  if (existing && expectedVersion != null) {
    const current = existing.score_version ?? 1
    if (expectedVersion !== current) {
      return {
        outcome: 'conflict',
        message: `Version conflict: expected ${expectedVersion}, found ${current}`,
        score: existing,
      }
    }
  }

  const nextVersion = existing ? (existing.score_version ?? 1) + 1 : 1
  const writePayload = {
    ...payload,
    score_version: nextVersion,
    ...(clientSubmissionId ? { client_submission_id: clientSubmissionId } : {}),
  }

  let score: Record<string, unknown>
  if (existing) {
    const { data, error } = await supabase
      .from('scores')
      .update(writePayload)
      .eq('id', existing.id)
      .eq('score_version', existing.score_version ?? 1)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return {
        outcome: 'conflict',
        message: 'Optimistic lock failed',
        score: existing,
      }
    }
    score = data
  } else {
    const { data, error } = await supabase
      .from('scores')
      .insert(writePayload)
      .select('*')
      .single()
    if (error) {
      if (clientSubmissionId && error.code === '23505') {
        return { outcome: 'duplicate', message: 'Duplicate submission' }
      }
      throw error
    }
    score = data
  }

  const revision = await appendScoreRevision(supabase, {
    scoreId: score.id as string,
    divisionId: score.division_id as string,
    divisionMemberId: score.division_member_id as string,
    judgeId: score.judge_id as string,
    scoreVersion: nextVersion,
    previousPayload: existing ? (existing as Record<string, unknown>) : null,
    newPayload: score,
    actorAccountId: actorId,
    reason: reason ?? null,
    source,
    clientSubmissionId,
    clientTimestamp,
    syncOutcome: 'accepted',
  })

  return { outcome: 'accepted', score, revisionId: revision.id }
}
