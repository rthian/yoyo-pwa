/**
 * Offline Indicator Component
 * Shows sync status and pending scores
 */
'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Wifi, 
  WifiOff, 
  Cloud, 
  CloudOff, 
  RefreshCw,
  Loader2 
} from 'lucide-react'
import { 
  subscribeSyncStatus, 
  attemptSync, 
  initSyncManager,
  type SyncStatus 
} from '@/lib/offline/sync-manager'
import { toast } from 'sonner'

export default function OfflineIndicator() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    pendingCount: 0,
    lastSyncTime: null,
    isSyncing: false,
  })

  useEffect(() => {
    // Initialize sync manager
    const cleanup = initSyncManager()
    
    // Subscribe to status changes
    const unsubscribe = subscribeSyncStatus(setStatus)

    return () => {
      cleanup?.()
      unsubscribe()
    }
  }, [])

  const handleManualSync = async () => {
    if (!status.isOnline) {
      toast.error('Cannot sync while offline')
      return
    }
    
    toast.promise(attemptSync(), {
      loading: 'Syncing scores...',
      success: 'Scores synced!',
      error: 'Sync failed',
    })
  }

  // Don't show anything if online and no pending scores
  if (status.isOnline && status.pendingCount === 0 && !status.isSyncing) {
    return null
  }

  return (
    <div className="fixed top-14 left-0 right-0 z-40 px-4 py-2 bg-background/95 backdrop-blur border-b">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          {status.isOnline ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-yellow-500" />
          )}
          
          <span className="text-sm">
            {status.isOnline ? 'Online' : 'Offline'}
          </span>

          {status.pendingCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {status.pendingCount} pending
            </Badge>
          )}
        </div>

        {status.pendingCount > 0 && status.isOnline && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualSync}
            disabled={status.isSyncing}
          >
            {status.isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
