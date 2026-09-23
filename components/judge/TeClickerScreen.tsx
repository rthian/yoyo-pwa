/**
 * Live TE clicker UI — Offset-style Pos/Neg + major shortcuts.
 * IYYF: majors bump MD counters (not TE negatives). AP: into negatives.
 * Callers: components/judge/ScoringForm.tsx
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useHaptics } from '@/lib/hooks/use-haptics'
import { cn } from '@/lib/utils'
import {
  DEFAULT_TE_KEYS,
  MAJOR_DETACH,
  MAJOR_DISCARD,
  MAJOR_STOP,
  addNegative,
  addPositive,
  applyMajorIntoNegatives,
  bumpMajor,
  resetMajors,
  resetTeState,
  teNet,
  type MajorDeductionState,
  type MajorKind,
  type TeClickerState,
} from '@/lib/judge/te-clicker'

interface TeClickerScreenProps {
  state: TeClickerState
  majors: MajorDeductionState
  /** separate = IYYF (after E.Total); integrated = AP (into TE negatives) */
  majorMode: 'separate' | 'integrated'
  onTeChange: (next: TeClickerState) => void
  onMajorsChange: (next: MajorDeductionState) => void
  onContinueToEvaluation: () => void
  className?: string
}

export default function TeClickerScreen({
  state,
  majors,
  majorMode,
  onTeChange,
  onMajorsChange,
  onContinueToEvaluation,
  className,
}: TeClickerScreenProps) {
  const { triggerClick } = useHaptics()
  const [flash, setFlash] = useState<'pos' | 'neg' | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef(state)
  const majorsRef = useRef(majors)
  stateRef.current = state
  majorsRef.current = majors

  const bumpFlash = useCallback((kind: 'pos' | 'neg') => {
    setFlash(kind)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 120)
  }, [])

  const doPositive = useCallback(() => {
    triggerClick()
    bumpFlash('pos')
    onTeChange(addPositive(stateRef.current))
  }, [bumpFlash, onTeChange, triggerClick])

  const doNegative = useCallback(() => {
    triggerClick()
    bumpFlash('neg')
    onTeChange(addNegative(stateRef.current))
  }, [bumpFlash, onTeChange, triggerClick])

  const doMajor = useCallback(
    (kind: MajorKind) => {
      triggerClick()
      bumpFlash('neg')
      if (majorMode === 'integrated') {
        const next = applyMajorIntoNegatives(
          stateRef.current,
          majorsRef.current,
          kind
        )
        onTeChange(next.te)
        onMajorsChange(next.majors)
      } else {
        onMajorsChange(bumpMajor(majorsRef.current, kind))
      }
    },
    [bumpFlash, majorMode, onMajorsChange, onTeChange, triggerClick]
  )

  const handlersRef = useRef({ doPositive, doNegative })
  handlersRef.current = { doPositive, doNegative }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if ((DEFAULT_TE_KEYS.negative as readonly string[]).includes(e.key)) {
        e.preventDefault()
        handlersRef.current.doNegative()
        return
      }
      if ((DEFAULT_TE_KEYS.positive as readonly string[]).includes(e.key)) {
        e.preventDefault()
        handlersRef.current.doPositive()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [])

  const net = teNet(state)

  return (
    <div className={cn('space-y-3', className)}>
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Technical execution (TE)
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-sm mx-4">
              <AlertDialogHeader>
                <AlertDialogTitle>Reset TE & majors?</AlertDialogTitle>
                <AlertDialogDescription>
                  Clears clicker counts and Stop / Discard / Detach counters.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row gap-2">
                <AlertDialogCancel className="flex-1 m-0">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="flex-1 m-0"
                  onClick={() => {
                    onTeChange(resetTeState())
                    onMajorsChange(resetMajors())
                  }}
                >
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Net clicks → TE /60
          </p>
          <p
            className={cn(
              'text-5xl font-bold tabular-nums font-mono tracking-tight',
              net < 0 && 'text-destructive'
            )}
          >
            {net}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            TE {Math.min(60, Math.max(0, net * 0.1)).toFixed(1)} / 60
          </p>
        </div>

        <div className="grid grid-cols-5 gap-1 text-center text-xs">
          <div>
            <p className="font-semibold tabular-nums text-destructive">-{state.negatives}</p>
            <p className="text-[10px] text-muted-foreground">Neg</p>
          </div>
          <div>
            <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              +{state.positives}
            </p>
            <p className="text-[10px] text-muted-foreground">Pos</p>
          </div>
          <div>
            <p className="font-semibold tabular-nums text-destructive">{majors.stopCount}</p>
            <p className="text-[10px] text-muted-foreground">Stop</p>
          </div>
          <div>
            <p className="font-semibold tabular-nums text-orange-600 dark:text-orange-400">
              {majors.discardCount}
            </p>
            <p className="text-[10px] text-muted-foreground">Discard</p>
          </div>
          <div>
            <p className="font-semibold tabular-nums text-orange-600 dark:text-orange-400">
              {majors.detachCount}
            </p>
            <p className="text-[10px] text-muted-foreground">Cut</p>
          </div>
        </div>

        <p className="text-[10px] text-center text-muted-foreground">
          {majorMode === 'separate'
            ? 'Stop / Discard / Cut are major deductions after E.Total (not TE)'
            : 'Stop / Discard / Cut add to negative clicks (AP-style)'}
        </p>
        <p className="text-[10px] text-center text-muted-foreground hidden sm:block">
          Keys: Z / ← negative · / / → positive
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-14 flex-col gap-0.5 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={() => doMajor('stop')}
        >
          <span className="text-sm font-bold">STOP</span>
          <span className="text-[10px] opacity-80">−{MAJOR_STOP}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-14 flex-col gap-0.5 rounded-xl border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
          onClick={() => doMajor('discard')}
        >
          <span className="text-sm font-bold">DISCARD</span>
          <span className="text-[10px] opacity-80">−{MAJOR_DISCARD}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-14 flex-col gap-0.5 rounded-xl border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
          onClick={() => doMajor('detach')}
        >
          <span className="text-sm font-bold">CUT</span>
          <span className="text-[10px] opacity-80">−{MAJOR_DETACH}</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 min-h-[200px] sm:min-h-[320px]">
        <button
          type="button"
          onClick={doNegative}
          className={cn(
            'relative flex flex-col items-center justify-center gap-2 sm:gap-3 rounded-2xl border-2 border-destructive/50',
            'bg-destructive/15 text-destructive touch-manipulation select-none',
            'active:scale-[0.98] transition-transform min-h-[180px] sm:min-h-full',
            flash === 'neg' && 'ring-4 ring-destructive/60 bg-destructive/25'
          )}
          aria-label="Negative click"
        >
          <Minus className="h-12 w-12 sm:h-20 sm:w-20" strokeWidth={2.5} />
          <span className="text-sm sm:text-xl font-bold tracking-wide">NEGATIVE</span>
          <span className="text-xs opacity-70 hidden sm:inline">Z · ←</span>
        </button>

        <button
          type="button"
          onClick={doPositive}
          className={cn(
            'relative flex flex-col items-center justify-center gap-2 sm:gap-3 rounded-2xl border-2 border-emerald-500/50',
            'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 touch-manipulation select-none',
            'active:scale-[0.98] transition-transform min-h-[180px] sm:min-h-full',
            flash === 'pos' && 'ring-4 ring-emerald-500/60 bg-emerald-500/25'
          )}
          aria-label="Positive click"
        >
          <Plus className="h-12 w-12 sm:h-20 sm:w-20" strokeWidth={2.5} />
          <span className="text-sm sm:text-xl font-bold tracking-wide">POSITIVE</span>
          <span className="text-xs opacity-70 hidden sm:inline">/ · →</span>
        </button>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full h-12 rounded-full"
        onClick={onContinueToEvaluation}
      >
        Continue to Freestyle Evaluation
      </Button>
    </div>
  )
}
