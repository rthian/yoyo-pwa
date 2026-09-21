/**
 * Admin panel to finalize event → season ranking points.
 * Caller: app/(admin)/admin/events/[id]/page.tsx mounts <FinalizeEventPanel />.
 * Glob: no FinalizeEventPanel.tsx yet.
 * Calls GET/POST/DELETE /api/admin/events/:id/finalize.
 * User: "create a branch for this, plan & build a ranking with point system league leaderboards..."
 */
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Trophy } from 'lucide-react'
import { toast } from 'sonner'

interface FinalizeEventPanelProps {
  eventId: string
}

export default function FinalizeEventPanel({ eventId }: FinalizeEventPanelProps) {
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [canFinalize, setCanFinalize] = useState(false)
  const [isFinalized, setIsFinalized] = useState(false)
  const [awardsCount, setAwardsCount] = useState(0)
  const [blockers, setBlockers] = useState<{ code: string; message: string }[]>([])

  const refresh = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/events/${eventId}/finalize`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load finalize status')
      setCanFinalize(data.canFinalize)
      setIsFinalized(data.isFinalized)
      setAwardsCount(data.awardsCount ?? 0)
      setBlockers(data.blockers ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const finalize = async () => {
    setActing(true)
    try {
      const res = await fetch(`/api/admin/events/${eventId}/finalize`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Finalize failed')
        if (data.blockers) setBlockers(data.blockers)
        return
      }
      toast.success(`Awarded points to ${data.awardsWritten ?? 0} player-category rows`)
      await refresh()
    } finally {
      setActing(false)
    }
  }

  const unfinalize = async () => {
    if (!confirm('Revoke season points for this event?')) return
    setActing(true)
    try {
      const res = await fetch(`/api/admin/events/${eventId}/finalize`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Revoke failed')
        return
      }
      toast.success('Season points revoked')
      await refresh()
    } finally {
      setActing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5" />
          League points
        </CardTitle>
        <CardDescription>
          After all category divisions are scoring-locked, finalize to write season
          ranking points (one award per player per category).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            {isFinalized ? (
              <p className="text-sm text-muted-foreground">
                Finalized — {awardsCount} award row{awardsCount === 1 ? '' : 's'} on the
                season board.
              </p>
            ) : blockers.length > 0 ? (
              <ul className="list-inside list-disc text-sm text-amber-700 dark:text-amber-400">
                {blockers.map((b) => (
                  <li key={b.code + b.message}>{b.message}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Ready to award season points.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {!isFinalized && (
                <Button onClick={finalize} disabled={!canFinalize || acting}>
                  {acting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Finalize & award points
                </Button>
              )}
              {isFinalized && (
                <Button variant="outline" onClick={unfinalize} disabled={acting}>
                  Revoke points
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
