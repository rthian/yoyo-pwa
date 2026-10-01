/**
 * Offline Score Queue — durable clientSubmissionId + conflict retention.
 */
import localforage from 'localforage'

const scoreQueue = localforage.createInstance({
  name: 'yoyo-league',
  storeName: 'offline-scores',
})

export type OfflineSyncOutcome =
  | 'accepted'
  | 'duplicate'
  | 'superseded'
  | 'locked'
  | 'unauthorized'
  | 'invalid'
  | 'conflict'
  | 'pending'

export interface OfflineScore {
  clientId: string
  clientSubmissionId: string
  expectedVersion: number | null
  divisionId: string
  divisionMemberId: string
  judgeId: string
  scoreData: Record<string, number>
  timestamp: number
  synced: boolean
  outcome?: OfflineSyncOutcome
  lastError?: string | null
}

export function generateClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export async function saveOfflineScore(
  score: Omit<OfflineScore, 'synced' | 'clientSubmissionId' | 'expectedVersion'> & {
    clientSubmissionId?: string
    expectedVersion?: number | null
  }
): Promise<void> {
  const clientSubmissionId = score.clientSubmissionId || score.clientId
  await scoreQueue.setItem(score.clientId, {
    ...score,
    clientSubmissionId,
    expectedVersion: score.expectedVersion ?? null,
    synced: false,
    outcome: 'pending',
  })
}

export async function getUnsyncedScores(): Promise<OfflineScore[]> {
  const scores: OfflineScore[] = []
  await scoreQueue.iterate((value: OfflineScore) => {
    if (!value.synced) scores.push(value)
  })
  return scores.sort((a, b) => a.timestamp - b.timestamp)
}

export async function getConflictScores(): Promise<OfflineScore[]> {
  const scores: OfflineScore[] = []
  await scoreQueue.iterate((value: OfflineScore) => {
    if (
      value.outcome &&
      ['conflict', 'locked', 'unauthorized', 'invalid', 'superseded'].includes(
        value.outcome
      )
    ) {
      scores.push(value)
    }
  })
  return scores
}

export async function markScoresAsSynced(clientIds: string[]): Promise<void> {
  for (const clientId of clientIds) {
    const score = await scoreQueue.getItem<OfflineScore>(clientId)
    if (score) {
      await scoreQueue.setItem(clientId, {
        ...score,
        synced: true,
        outcome: 'accepted',
        lastError: null,
      })
    }
  }
}

export async function markScoreOutcome(
  clientId: string,
  outcome: OfflineSyncOutcome,
  message?: string,
  scoreVersion?: number
): Promise<void> {
  const score = await scoreQueue.getItem<OfflineScore>(clientId)
  if (!score) return
  const synced = outcome === 'accepted' || outcome === 'duplicate'
  await scoreQueue.setItem(clientId, {
    ...score,
    synced,
    outcome,
    lastError: message ?? null,
    expectedVersion:
      typeof scoreVersion === 'number' ? scoreVersion : score.expectedVersion,
  })
}

export async function clearSyncedScores(): Promise<void> {
  const keysToRemove: string[] = []
  await scoreQueue.iterate((value: OfflineScore, key: string) => {
    if (value.synced && (value.outcome === 'accepted' || value.outcome === 'duplicate')) {
      keysToRemove.push(key)
    }
  })
  for (const key of keysToRemove) {
    await scoreQueue.removeItem(key)
  }
}

export async function getPendingCount(): Promise<number> {
  let count = 0
  await scoreQueue.iterate((value: OfflineScore) => {
    if (!value.synced) count++
  })
  return count
}

export async function syncPendingScores(): Promise<{
  success: number
  failed: number
}> {
  const scores = await getUnsyncedScores()
  if (scores.length === 0) return { success: 0, failed: 0 }

  try {
    const response = await fetch('/api/scores/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scores: scores.map((s) => ({
          clientId: s.clientId,
          clientSubmissionId: s.clientSubmissionId,
          expectedVersion: s.expectedVersion,
          divisionId: s.divisionId,
          divisionMemberId: s.divisionMemberId,
          scoreData: s.scoreData,
          timestamp: s.timestamp,
        })),
      }),
    })

    if (!response.ok) throw new Error('Sync failed')

    const result = await response.json()
    const rows = (result.results ?? []) as Array<{
      clientId: string
      outcome: OfflineSyncOutcome
      scoreVersion?: number
      message?: string
    }>

    let success = 0
    let failed = 0
    for (const row of rows) {
      await markScoreOutcome(
        row.clientId,
        row.outcome,
        row.message,
        row.scoreVersion
      )
      if (row.outcome === 'accepted' || row.outcome === 'duplicate') success++
      else failed++
    }

    await clearSyncedScores()
    return { success, failed }
  } catch (error) {
    console.error('Sync error:', error)
    return { success: 0, failed: scores.length }
  }
}
