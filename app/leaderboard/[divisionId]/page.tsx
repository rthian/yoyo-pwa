/**
 * Public Leaderboard Page
 * Accessible via shareable link with token
 * Includes real-time updates via Supabase Realtime
 * Podium-style top 3 + animated list
 */
'use client'

import { use, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
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
    <div className="min-h-screen bg-background pb-8 safe-area-bottom">
      <div className="mx-auto max-w-lg">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur px-4 pt-3 pb-3 safe-area-top">
          <p className="text-xs text-muted-foreground tracking-tight truncate">
            {division.event.name}
          </p>
          <div className="mt-0.5 flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold tracking-tight leading-tight">{division.name}</h1>
            <Badge
              variant={division.event.status === 'active' ? 'default' : 'secondary'}
              className="shrink-0 rounded-full"
            >
              {division.event.status}
            </Badge>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              <span>Live</span>
              <span className="text-xs font-normal text-muted-foreground">
                {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                onClick={refresh}
                aria-label="Refresh leaderboard"
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
              <label className="flex min-h-11 items-center gap-2 px-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="size-4 rounded"
                />
                Auto
              </label>
            </div>
          </div>
        </header>

        <div className="space-y-4 px-4 pt-4">

        {/* Podium - Top 3 */}
        {top3.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Podium entries={top3} className="mb-2" />
          </motion.div>
        )}

        <section className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Trophy className="h-5 w-5 text-primary" />
            <h2 className="font-semibold tracking-tight">Leaderboard</h2>
          </div>
          <div className="p-2">
            {scored.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground">No scores yet</p>
            ) : (
              <div className="space-y-1.5">
                <AnimatePresence mode="popLayout">
                  {rest.map((entry, index) => (
                    <LeaderboardRow
                      key={entry.memberId}
                      entry={entry}
                      index={index}
                    />
                  ))}
                </AnimatePresence>

                {unscored.length > 0 && (
                  <div className="pt-3 mt-2 border-t border-border px-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2 px-2 uppercase tracking-wide">
                      Awaiting scores
                    </p>
                    {unscored.map((entry) => (
                      <div
                        key={entry.memberId}
                        className="flex min-h-14 items-center gap-3 px-2 py-2 opacity-70"
                      >
                        <div className="w-8 text-center text-muted-foreground font-mono tabular-nums text-sm">
                          #{entry.playOrder}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{entry.memberName}</p>
                        </div>
                        <Badge variant="outline" className="rounded-full">
                          Pending
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="text-center text-xs text-muted-foreground py-4">
          <p>YoYo League</p>
          <p className="mt-1">
            © {new Date().getFullYear()} YoYo League. Created by{' '}
            <a
              href="https://github.com/rthian"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              rthian
            </a>
            .
          </p>
        </div>
        </div>
      </div>
    </div>
  )
}
