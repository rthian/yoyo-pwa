/**
 * Real-time Leaderboard Hook
 * Fetches and subscribes to leaderboard updates
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LeaderboardEntry {
  memberId: string
  memberName: string
  nickname: string | null
  country: string | null
  playOrder: number
  avgTechnical: number
  avgPerformance: number
  totalScore: number
  scoreCount: number
  rank: number | null
}

interface DivisionWithEvent {
  id: string
  name: string
  event: { id: string; name: string; status: string }
}

interface LeaderboardData {
  division: DivisionWithEvent
  leaderboard: LeaderboardEntry[]
  lastUpdated: string
  scoresHidden?: boolean
}

interface UseLeaderboardOptions {
  divisionId: string
  token?: string | null
  autoRefresh?: boolean
  refreshInterval?: number
}

export function useLeaderboard({
  divisionId,
  token,
  autoRefresh = true,
  refreshInterval = 10000,
}: UseLeaderboardOptions) {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeaderboard = useCallback(async () => {
    try {
      const url = token
        ? `/api/leaderboard/${divisionId}?token=${token}`
        : `/api/leaderboard/${divisionId}`

      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load leaderboard')
      }

      const leaderboardData = await response.json()
      setData(leaderboardData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }, [divisionId, token])

  // Initial fetch
  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  // Auto-refresh polling
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchLeaderboard, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchLeaderboard])

  // Supabase Realtime subscription for score changes
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`leaderboard-${divisionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores',
          filter: `division_id=eq.${divisionId}`,
        },
        () => {
          // Refetch leaderboard when scores change
          fetchLeaderboard()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [divisionId, fetchLeaderboard])

  return {
    data,
    loading,
    error,
    refresh: fetchLeaderboard,
  }
}
