/**
 * Lock Division Button + soft-lock TypeSafe cue.
 * Caller: app/(judge)/judge/divisions/[id]/page.tsx (~line 139).
 * Fetches GET /api/divisions/:id/lock-readiness (advisory). Hard lock stays PATCH …/lock.
 * User: "yes please"
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Lock, Unlock, Loader2, AlertTriangle, CheckCircle2, PauseCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface LockDivisionButtonProps {
  divisionId: string
  scoringLocked: boolean
  isHeadJudgeOrAdmin: boolean
}

type LockCue = 'ready' | 'caution' | 'wait'

interface ReadinessPayload {
  configured: boolean
  cue: LockCue
  confidence: number
  headline: string
  reasons: string[]
  facts?: {
    submittedRatio: number
    missingScoreCount: number
    draftScoreCount: number
    outlierCount: number
  }
}

export default function LockDivisionButton({
  divisionId,
  scoringLocked,
  isHeadJudgeOrAdmin,
}: LockDivisionButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [cueLoading, setCueLoading] = useState(false)
  const [readiness, setReadiness] = useState<ReadinessPayload | null>(null)

  const loadCue = useCallback(async (signal?: AbortSignal) => {
    if (scoringLocked) {
      setReadiness(null)
      return
    }
    setCueLoading(true)
    try {
      const res = await fetch(`/api/divisions/${divisionId}/lock-readiness`, { signal })
      const data = await res.json()
      if (signal?.aborted) return
      if (!res.ok) throw new Error(data.error || 'Failed to load lock cue')
      setReadiness(data)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      console.error(e)
      setReadiness(null)
    } finally {
      if (!signal?.aborted) setCueLoading(false)
    }
  }, [divisionId, scoringLocked])

  useEffect(() => {
    if (!isHeadJudgeOrAdmin) return
    const ac = new AbortController()
    loadCue(ac.signal)
    return () => ac.abort()
  }, [isHeadJudgeOrAdmin, loadCue])

  if (!isHeadJudgeOrAdmin) return null

  const handleToggle = async () => {
    if (!scoringLocked && readiness?.cue === 'wait') {
      const ok = confirm(
        `${readiness.headline}\n\n${readiness.reasons.join('\n')}\n\nLock anyway?`
      )
      if (!ok) return
    } else if (!scoringLocked && readiness?.cue === 'caution') {
      const ok = confirm(
        `${readiness.headline}\n\n${readiness.reasons.join('\n')}\n\nProceed to lock?`
      )
      if (!ok) return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/divisions/${divisionId}/lock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoring_locked: !scoringLocked }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update lock status')
      }

      toast.success(scoringLocked ? 'Division unlocked' : 'Division locked')
      router.refresh()
      if (!scoringLocked) setReadiness(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update')
    } finally {
      setLoading(false)
    }
  }

  const cue = readiness?.cue
  const cueStyles =
    cue === 'wait'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : cue === 'caution'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100'
        : cue === 'ready'
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
          : null

  return (
    <div className="flex flex-col items-end gap-1.5 max-w-[14rem]">
      <Button
        variant={scoringLocked ? 'default' : 'outline'}
        size="sm"
        onClick={handleToggle}
        disabled={loading}
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : scoringLocked ? (
          <>
            <Unlock className="h-4 w-4" />
            Unlock Division
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            Lock Division
          </>
        )}
      </Button>

      {!scoringLocked && (
        <div
          className={cn(
            'w-full rounded-lg border px-2 py-1.5 text-[11px] leading-snug',
            cueStyles ?? 'border-muted bg-muted/40 text-muted-foreground'
          )}
        >
          {cueLoading ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking panel…
            </span>
          ) : readiness ? (
            <div className="space-y-1">
              <p className="font-medium inline-flex items-start gap-1">
                {cue === 'wait' ? (
                  <PauseCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                ) : cue === 'caution' ? (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                )}
                {readiness.headline}
              </p>
              {readiness.reasons.slice(0, 2).map((r) => (
                <p key={r} className="opacity-90 pl-4">
                  {r}
                </p>
              ))}
              {readiness.facts && (
                <p className="opacity-70 pl-4 tabular-nums">
                  {Math.round(readiness.facts.submittedRatio * 100)}% submitted
                  {readiness.facts.outlierCount > 0
                    ? ` · ${readiness.facts.outlierCount} outlier${
                        readiness.facts.outlierCount === 1 ? '' : 's'
                      }`
                    : ''}
                </p>
              )}
              {!readiness.configured && (
                <p className="opacity-60 pl-4">Deterministic cue (TypeSafe off)</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="underline-offset-2 hover:underline"
              onClick={() => loadCue()}
            >
              Check lock readiness
            </button>
          )}
        </div>
      )}
    </div>
  )
}
