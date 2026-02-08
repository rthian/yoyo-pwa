/**
 * Offline Score Queue
 * Handles storing and syncing scores when offline
 */
import localforage from 'localforage'

// Initialize localforage store
const scoreQueue = localforage.createInstance({
  name: 'yoyo-pwa',
  storeName: 'offline-scores',
})

export interface OfflineScore {
  clientId: string
  divisionId: string
  divisionMemberId: string
  judgeId: string
  scoreData: Record<string, number>
  timestamp: number
  synced: boolean
}

/**
 * Generate a unique client ID for offline scores
 */
export function generateClientId(): string {
  return `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Save a score to the offline queue
 */
export async function saveOfflineScore(score: Omit<OfflineScore, 'synced'>): Promise<void> {
  await scoreQueue.setItem(score.clientId, {
    ...score,
    synced: false,
  })
}

/**
 * Get all unsynced scores
 */
export async function getUnsyncedScores(): Promise<OfflineScore[]> {
  const scores: OfflineScore[] = []
  
  await scoreQueue.iterate((value: OfflineScore) => {
    if (!value.synced) {
      scores.push(value)
    }
  })
  
  return scores.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Mark scores as synced
 */
export async function markScoresAsSynced(clientIds: string[]): Promise<void> {
  for (const clientId of clientIds) {
    const score = await scoreQueue.getItem<OfflineScore>(clientId)
    if (score) {
      await scoreQueue.setItem(clientId, { ...score, synced: true })
    }
  }
}

/**
 * Remove synced scores from queue
 */
export async function clearSyncedScores(): Promise<void> {
  const keysToRemove: string[] = []
  
  await scoreQueue.iterate((value: OfflineScore, key: string) => {
    if (value.synced) {
      keysToRemove.push(key)
    }
  })
  
  for (const key of keysToRemove) {
    await scoreQueue.removeItem(key)
  }
}

/**
 * Get the count of pending scores
 */
export async function getPendingCount(): Promise<number> {
  let count = 0
  
  await scoreQueue.iterate((value: OfflineScore) => {
    if (!value.synced) {
      count++
    }
  })
  
  return count
}

/**
 * Sync all pending scores with the server
 */
export async function syncPendingScores(): Promise<{
  success: number
  failed: number
}> {
  const scores = await getUnsyncedScores()
  
  if (scores.length === 0) {
    return { success: 0, failed: 0 }
  }

  try {
    const response = await fetch('/api/scores/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scores }),
    })

    if (!response.ok) {
      throw new Error('Sync failed')
    }

    const result = await response.json()
    
    // Mark successful scores as synced
    if (result.results?.success?.length > 0) {
      await markScoresAsSynced(result.results.success)
    }

    // Clean up synced scores
    await clearSyncedScores()

    return {
      success: result.synced || 0,
      failed: result.failed || 0,
    }
  } catch (error) {
    console.error('Sync error:', error)
    return { success: 0, failed: scores.length }
  }
}
