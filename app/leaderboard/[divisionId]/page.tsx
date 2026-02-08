/**
 * Public Leaderboard Page
 * Accessible via shareable link with token
 * Includes real-time updates via Supabase Realtime
 */
'use client'

import { use, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSearchParams } from 'next/navigation'
import { Loader2, Trophy, Medal, Award, RefreshCw, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLeaderboard } from '@/lib/hooks/use-leaderboard'

interface PageProps {
  params: Promise<{ divisionId: string }>
}

export default function PublicLeaderboardPage({ params }: PageProps) {
  const { divisionId } = use(params)
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [autoRefresh, setAutoRefresh] = useState(true)
  
  const { data, loading, error, refresh } = useLeaderboard({
    divisionId,
    token,
    autoRefresh,
    refreshInterval: 10000,
  })

  const getRankIcon = (rank: number | null) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />
    if (rank === 3) return <Award className="h-5 w-5 text-orange-500" />
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-8">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={refresh}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const { division, leaderboard, lastUpdated } = data

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-1">
            {division.event.name}
          </p>
          <h1 className="text-2xl font-bold">{division.name}</h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge variant={division.event.status === 'active' ? 'default' : 'secondary'}>
              {division.event.status}
            </Badge>
          </div>
        </div>

        {/* Refresh Controls */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Radio className="h-3 w-3 text-green-500 animate-pulse" />
            <span>Live • Updated: {new Date(lastUpdated).toLocaleTimeString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh
            </label>
          </div>
        </div>

        {/* Leaderboard */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No scores yet
              </p>
            ) : (
              <div className="space-y-2">
                {leaderboard
                  .filter(entry => entry.scoreCount > 0)
                  .map((entry) => (
                  <div
                    key={entry.memberId}
                    className={`flex items-center gap-4 p-3 rounded-lg border ${
                      entry.rank === 1 ? 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200' :
                      entry.rank === 2 ? 'bg-gray-50 dark:bg-gray-900/30 border-gray-200' :
                      entry.rank === 3 ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200' :
                      ''
                    }`}
                  >
                    {/* Rank */}
                    <div className="w-8 text-center">
                      {getRankIcon(entry.rank) || (
                        <span className="text-lg font-bold text-muted-foreground">
                          {entry.rank}
                        </span>
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">
                        {entry.memberName}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {entry.nickname && `"${entry.nickname}" • `}
                        {entry.country || 'No country'}
                      </p>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <p className="text-xl font-bold">
                        {entry.totalScore.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.scoreCount} judge{entry.scoreCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                ))}
                
                {/* Unscored participants */}
                {leaderboard.some(e => e.scoreCount === 0) && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">
                      Awaiting Scores
                    </p>
                    {leaderboard
                      .filter(entry => entry.scoreCount === 0)
                      .map((entry) => (
                      <div
                        key={entry.memberId}
                        className="flex items-center gap-4 p-2 opacity-60"
                      >
                        <div className="w-8 text-center text-muted-foreground">
                          #{entry.playOrder}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{entry.memberName}</p>
                        </div>
                        <Badge variant="outline">Pending</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground py-4">
          <p>YoYo Events Management System</p>
        </div>
      </div>
    </div>
  )
}
