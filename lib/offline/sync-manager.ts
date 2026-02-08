/**
 * Sync Manager
 * Handles automatic syncing when coming back online
 */
import { syncPendingScores, getPendingCount } from './queue'

let syncInProgress = false
let listeners: ((status: SyncStatus) => void)[] = []

export interface SyncStatus {
  isOnline: boolean
  pendingCount: number
  lastSyncTime: Date | null
  isSyncing: boolean
}

let currentStatus: SyncStatus = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingCount: 0,
  lastSyncTime: null,
  isSyncing: false,
}

/**
 * Subscribe to sync status changes
 */
export function subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
  listeners.push(listener)
  listener(currentStatus)
  
  return () => {
    listeners = listeners.filter(l => l !== listener)
  }
}

/**
 * Notify all listeners of status change
 */
function notifyListeners() {
  listeners.forEach(listener => listener(currentStatus))
}

/**
 * Update the sync status
 */
async function updateStatus(partial: Partial<SyncStatus>) {
  currentStatus = { ...currentStatus, ...partial }
  notifyListeners()
}

/**
 * Attempt to sync pending scores
 */
export async function attemptSync(): Promise<void> {
  if (syncInProgress || !currentStatus.isOnline) {
    return
  }

  syncInProgress = true
  await updateStatus({ isSyncing: true })

  try {
    const result = await syncPendingScores()
    const pendingCount = await getPendingCount()
    
    await updateStatus({
      pendingCount,
      lastSyncTime: new Date(),
      isSyncing: false,
    })

    if (result.success > 0) {
      console.log(`Synced ${result.success} scores`)
    }
    if (result.failed > 0) {
      console.warn(`Failed to sync ${result.failed} scores`)
    }
  } catch (error) {
    console.error('Sync attempt failed:', error)
    await updateStatus({ isSyncing: false })
  } finally {
    syncInProgress = false
  }
}

/**
 * Initialize the sync manager
 */
export function initSyncManager() {
  if (typeof window === 'undefined') return

  // Update online status
  const handleOnline = async () => {
    await updateStatus({ isOnline: true })
    // Attempt sync when coming back online
    attemptSync()
  }

  const handleOffline = () => {
    updateStatus({ isOnline: false })
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Initial status check
  updateStatus({ isOnline: navigator.onLine })

  // Update pending count periodically
  const updatePendingCount = async () => {
    const count = await getPendingCount()
    if (count !== currentStatus.pendingCount) {
      await updateStatus({ pendingCount: count })
    }
  }

  updatePendingCount()
  const interval = setInterval(updatePendingCount, 5000)

  // Auto-sync when online
  const autoSync = setInterval(() => {
    if (currentStatus.isOnline && currentStatus.pendingCount > 0) {
      attemptSync()
    }
  }, 30000) // Every 30 seconds

  // Cleanup function
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    clearInterval(interval)
    clearInterval(autoSync)
  }
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return currentStatus
}
