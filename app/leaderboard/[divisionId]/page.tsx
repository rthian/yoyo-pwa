/**
 * Public Leaderboard Page
 * Accessible via shareable link with token
 * Includes real-time updates via Supabase Realtime
 * Podium-style top 3 + animated list
 */
'use client'

import { use, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSearchParams } from 'next/navigation'
import { Loader2, Trophy, RefreshCw, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLeaderboard } from '@/lib/hooks/use-leaderboard'
import Podium from '@/components/leaderboard/Podium'
import LeaderboardRow from '@/components/leaderboard/LeaderboardRow'

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

  const { division, leaderboard, lastUpdated, scoresHidden } = data

  if (scoresHidden) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-1 tracking-tight">
              {division.event.name}
            </p>
            <h1 className="text-2xl font-bold tracking-tight">{division.name}</h1>
          </div>
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground text-lg">
                Scoring in progress. Results will be shown when the division is complete.
              </p>
            </CardContent>
          </Card>
          <div className="text-center text-sm text-muted-foreground py-4">
            <p>YoYo League</p>
            <p className="text-xs mt-1">© {new Date().getFullYear()} YoYo League. Created by <a href="https://github.com/rthian" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">rthian</a>.</p>
          </div>
        </div>
      </div>
    )
  }

  const scored = leaderboard.filter((e) => e.scoreCount > 0)
  const top3 = scored.filter((e) => e.rank !== null && e.rank <= 3) as Array<(typeof scored)[0] & { rank: number }>
  const rest = scored.filter((e) => e.rank === null || e.rank > 3)
  const unscored = leaderboard.filter((e) => e.scoreCount === 0)

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-1 tracking-tight">
            {division.event.name}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{division.name}</h1>
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
            <Button variant="ghost" size="sm" onClick={refresh}>
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

        {/* Podium - Top 3 */}
        {top3.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Podium entries={top3} className="mb-4" />
          </motion.div>
        )}

        {/* Leaderboard - Rest of ranked */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 tracking-tight">
              <Trophy className="h-5 w-5" />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scored.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No scores yet
              </p>
            ) : (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {rest.map((entry, index) => (
                    <LeaderboardRow
                      key={entry.memberId}
                      entry={entry}
                      index={index}
                    />
                  ))}
                </AnimatePresence>

                {/* Unscored participants */}
                {unscored.length > 0 && (
                  <div className="pt-4 border-t border-border mt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Awaiting Scores
                    </p>
                    {unscored.map((entry) => (
                      <div
                        key={entry.memberId}
                        className="flex items-center gap-4 p-2 opacity-60"
                      >
                        <div className="w-8 text-center text-muted-foreground font-mono tabular-nums">
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
          <p>YoYo League</p>
          <p className="text-xs mt-1">© {new Date().getFullYear()} YoYo League. Created by <a href="https://github.com/rthian" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">rthian</a>.</p>
        </div>
      </div>
    </div>
  )
}
