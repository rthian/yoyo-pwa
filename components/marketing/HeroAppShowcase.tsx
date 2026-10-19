'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

type Beat = {
  net: number
  te: string
  pos: number
  score: string
  judges: number
  flash: 'pos' | null
  boardPulse: boolean
}

/** Choreography: judge clicks → same competitor’s live board updates. */
const BEATS: Beat[] = [
  { net: 84, te: '8.4', pos: 96, score: '76.10', judges: 4, flash: null, boardPulse: false },
  { net: 85, te: '8.5', pos: 97, score: '76.10', judges: 4, flash: 'pos', boardPulse: false },
  { net: 86, te: '8.6', pos: 98, score: '76.10', judges: 4, flash: 'pos', boardPulse: false },
  { net: 87, te: '8.7', pos: 99, score: '77.25', judges: 5, flash: null, boardPulse: true },
  { net: 87, te: '8.7', pos: 99, score: '78.40', judges: 5, flash: null, boardPulse: true },
  { net: 87, te: '8.7', pos: 99, score: '78.40', judges: 5, flash: null, boardPulse: false },
]

const STATIC: Beat = BEATS[BEATS.length - 1]!

/** Decorative product UI for the marketing hero — not interactive. */
export default function HeroAppShowcase({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  const [beatIndex, setBeatIndex] = useState(0)
  const beat = reduce ? STATIC : (BEATS[beatIndex] ?? STATIC)

  useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => {
      setBeatIndex((i) => (i + 1) % BEATS.length)
    }, 900)
    return () => window.clearInterval(id)
  }, [reduce])

  const boardRows = [
    {
      rank: 1,
      name: 'Alex Rivera',
      meta: `JP · ${beat.judges} judges`,
      score: beat.score,
      live: true,
    },
    { rank: 2, name: 'Mei Chen', meta: 'TW · 5 judges', score: '76.15', live: false },
    { rank: 3, name: 'Sam Ortiz', meta: 'US · 5 judges', score: '74.90', live: false },
    { rank: 4, name: 'Yuki Tanaka', meta: 'JP · 4 judges', score: '71.20', live: false },
    { rank: 5, name: 'Jordan Lee', meta: 'KR · 4 judges', score: '69.85', live: false },
  ] as const

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none relative flex h-full w-full select-none items-stretch gap-3 sm:gap-4',
        className
      )}
    >
      {/* Judge phone — own column so it never covers board names */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-[38%] max-w-[200px] shrink-0 self-end sm:max-w-[220px] md:w-[42%] md:max-w-[240px]"
        style={{ height: 'min(92%, 420px)' }}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border-[3px] border-foreground/90 bg-background">
          <div className="flex shrink-0 items-center justify-between px-3 pb-1 pt-2.5 sm:px-4 sm:pt-3">
            <span className="text-[10px] font-medium tabular-nums text-foreground">9:41</span>
            <div className="h-3.5 w-14 rounded-full bg-foreground/90 sm:w-16" />
            <span className="text-[10px] font-medium text-foreground">100%</span>
          </div>

          <div className="shrink-0 border-b border-border/60 px-3 py-2">
            <p className="text-[10px] font-medium text-primary">Judge · Live TE</p>
            <p className="truncate text-sm font-bold tracking-tight text-foreground">
              Alex Rivera
            </p>
            <p className="text-[11px] text-muted-foreground">1A Final · Open</p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 px-2.5 py-2.5 sm:px-3 sm:py-3">
            <div className="shrink-0 rounded-2xl border border-border bg-card px-2.5 py-2.5 sm:px-3">
              <p className="text-center text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                Net clicks → TE /60
              </p>
              <p className="text-center font-mono text-4xl font-bold tabular-nums tracking-tight text-foreground sm:text-5xl">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={beat.net}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="inline-block"
                  >
                    {beat.net}
                  </motion.span>
                </AnimatePresence>
              </p>
              <p className="text-center text-xs tabular-nums text-muted-foreground">
                TE {beat.te} / 60
              </p>
              <div className="mt-1.5 grid grid-cols-4 gap-1 text-center text-[10px]">
                <div>
                  <p className="font-semibold tabular-nums text-destructive">−12</p>
                  <p className="text-muted-foreground">Neg</p>
                </div>
                <div>
                  <p className="font-semibold tabular-nums text-primary">+{beat.pos}</p>
                  <p className="text-muted-foreground">Pos</p>
                </div>
                <div>
                  <p className="font-semibold tabular-nums text-destructive">1</p>
                  <p className="text-muted-foreground">Stop</p>
                </div>
                <div>
                  <p className="font-semibold tabular-nums text-[var(--chart-5)]">0</p>
                  <p className="text-muted-foreground">Cut</p>
                </div>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-destructive/40 bg-destructive/10">
                <span className="text-2xl font-bold leading-none text-destructive sm:text-3xl">−</span>
                <span className="mt-1 text-[10px] font-bold tracking-wide text-destructive">
                  NEG
                </span>
              </div>
              <div
                className={cn(
                  'flex flex-col items-center justify-center rounded-2xl border-2 border-primary/50 bg-primary text-primary-foreground transition-shadow duration-200',
                  beat.flash === 'pos' && 'ring-4 ring-primary/50'
                )}
              >
                <span className="text-2xl font-bold leading-none sm:text-3xl">+</span>
                <span className="mt-1 text-[10px] font-bold tracking-wide opacity-90">POS</span>
              </div>
            </div>
          </div>

          <div className="mt-auto flex shrink-0 items-center justify-around border-t border-border/60 bg-muted/40 px-2 py-2">
            {['Score', 'Division', 'Board'].map((label, i) => (
              <div key={label} className="flex flex-col items-center gap-0.5 px-1.5">
                <div
                  className={cn('h-1 w-7 rounded-full', i === 0 ? 'bg-primary' : 'bg-transparent')}
                />
                <span
                  className={cn(
                    'text-[10px]',
                    i === 0 ? 'font-semibold text-primary' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Live board — full name column always in view */}
      <motion.div
        initial={reduce ? false : { opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        className="relative min-w-0 flex-1 self-stretch py-[4%]"
      >
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card sm:rounded-l-3xl sm:rounded-r-none sm:border-r-0">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-muted/50 px-3 py-3 sm:px-4 sm:py-3.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                1A Final · Open
              </p>
              <p className="text-xs text-muted-foreground">Live as judges score</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary">
              <motion.span
                className="size-1.5 rounded-full bg-primary"
                animate={reduce ? undefined : { opacity: [1, 0.35, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              Live
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden p-2 sm:gap-2 sm:p-3">
            {boardRows.map((row, i) => (
              <div
                key={row.name}
                className={cn(
                  'grid min-h-10 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-2 py-1.5 transition-[box-shadow,background-color] duration-300 sm:min-h-12 sm:gap-3 sm:px-3 sm:py-2',
                  i >= 3 && 'hidden sm:grid',
                  i >= 4 && 'sm:hidden md:grid',
                  row.rank === 1 && 'border-[var(--gold)]/30 bg-[var(--gold)]/10',
                  row.rank === 2 && 'border-[var(--silver)]/30 bg-[var(--silver)]/10',
                  row.rank === 3 && 'border-[var(--bronze)]/30 bg-[var(--bronze)]/10',
                  row.rank > 3 && 'border-border/70 bg-background/80',
                  row.live &&
                    beat.boardPulse &&
                    'border-primary/35 bg-primary/10 ring-2 ring-primary/45'
                )}
              >
                <span
                  className={cn(
                    'text-center text-sm font-bold tabular-nums',
                    row.rank === 1 && 'text-[var(--gold)]',
                    row.rank === 2 && 'text-[var(--silver)]',
                    row.rank === 3 && 'text-[var(--bronze)]',
                    row.rank > 3 && 'text-muted-foreground'
                  )}
                >
                  {row.rank}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                    {row.name}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{row.meta}</p>
                </div>
                <AnimatePresence mode="popLayout">
                  <motion.p
                    key={row.live ? row.score : `${row.name}-static`}
                    initial={reduce || !row.live ? false : { opacity: 0.35, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={cn(
                      'w-[3.25rem] text-right font-mono text-sm font-bold tabular-nums sm:w-14 sm:text-base',
                      row.live && beat.boardPulse ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {row.score}
                  </motion.p>
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
