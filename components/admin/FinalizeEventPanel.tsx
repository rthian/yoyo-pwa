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
import { Loader2, Trophy, AlertTriangle, CheckCircle2, PauseCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface FinalizeEventPanelProps {
  eventId: string
}

type SoftCue = {
  configured: boolean
  cue: 'ready' | 'caution' | 'wait'
  confidence: number
  headline: string
  reasons: string[]
  integrityRisk: number
}

export default function FinalizeEventPanel({ eventId }: FinalizeEventPanelProps) {
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [canFinalize, setCanFinalize] = useState(false)
  const [isFinalized, setIsFinalized] = useState(false)
  const [awardsCount, setAwardsCount] = useState(0)
  const [blockers, setBlockers] = useState<{ code: string; message: string }[]>([])
  const [softCue, setSoftCue] = useState<SoftCue | null>(null)

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
      setSoftCue(data.softCue ?? null)
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
    if (softCue?.cue === 'caution' || softCue?.cue === 'wait') {
      const ok = confirm(
        `${softCue.headline}\n\n${softCue.reasons.slice(0, 4).join('\n')}\n\nFinalize anyway?`
      )
      if (!ok) return
    }
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

            {!isFinalized && softCue && (
              <div
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm space-y-1',
                  softCue.cue === 'wait'
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : softCue.cue === 'caution'
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100'
                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                )}
              >
                <p className="font-medium inline-flex items-start gap-1.5">
                  {softCue.cue === 'wait' ? (
                    <PauseCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : softCue.cue === 'caution' ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  {softCue.headline}
                </p>
                {softCue.reasons.slice(0, 3).map((r) => (
                  <p key={r} className="text-xs opacity-90 pl-5">
                    {r}
                  </p>
                ))}
                {!softCue.configured && (
                  <p className="text-[11px] opacity-60 pl-5">Deterministic cue (TypeSafe off)</p>
                )}
              </div>
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
