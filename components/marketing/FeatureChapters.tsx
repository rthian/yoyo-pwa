'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import {
  CalendarCog,
  Gavel,
  Radio,
  TrendingUp,
  BarChart3,
  Music2,
  ArrowUpRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const fadeUp = (reduce: boolean | null, delay = 0) => ({
  initial: reduce ? false : { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.45, delay: reduce ? 0 : delay, ease: [0.22, 1, 0.36, 1] as const },
})

/** Mini judge-phone visual — TE counter + POS/NEG pad. */
function JudgingVisual() {
  return (
    <div aria-hidden className="mt-6 grid grid-cols-[1fr_auto] items-end gap-4">
      <div className="rounded-2xl border border-border/70 bg-background p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Net clicks → TE /60
        </p>
        <p className="mt-1 font-mono text-4xl font-bold tabular-nums tracking-tight text-foreground">
          87
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border-2 border-destructive/40 bg-destructive/10 py-2 text-center text-sm font-bold text-destructive">
            − NEG
          </div>
          <div className="rounded-xl bg-primary py-2 text-center text-sm font-bold text-primary-foreground">
            + POS
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 pb-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
          <span className="size-1.5 rounded-full bg-green-500" />
          Queue synced
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
          Draft autosaved
        </span>
      </div>
    </div>
  )
}

/** Mini pipeline visual — Draft → Publish → Active. */
function OpsVisual() {
  const steps = ['Draft', 'Publish', 'Active']
  return (
    <div aria-hidden className="mt-6 flex flex-wrap items-center gap-2">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-semibold',
              i === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            {step}
          </span>
          {i < steps.length - 1 && <span className="h-px w-5 bg-border" />}
        </div>
      ))}
      <span className="ml-auto rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
        Divisions · Staff · Music · Schedule
      </span>
    </div>
  )
}

/** Mini visualiser bars with an outlier. */
function VisualiserVisual() {
  const bars = [42, 55, 38, 61, 24]
  return (
    <div aria-hidden className="mt-6 flex h-20 items-end gap-1.5">
      {bars.map((h, i) => (
        <div
          key={i}
          style={{ height: `${h}%` }}
          className={cn(
            'flex-1 rounded-t-md',
            i === 4 ? 'bg-destructive/70' : 'bg-primary/25'
          )}
        />
      ))}
    </div>
  )
}

/** Mini leaderboard rows with medal tints and a live row. */
function BoardsVisual() {
  const rows = [
    { rank: '1', name: 'Alex Rivera', cls: 'bg-[var(--gold)]/15 text-[var(--gold)]' },
    { rank: '2', name: 'Mei Chen', cls: 'bg-[var(--silver)]/15 text-[var(--silver)]' },
    { rank: '3', name: 'Sam Ortiz', cls: 'bg-[var(--bronze)]/15 text-[var(--bronze)]' },
  ] as const
  return (
    <div aria-hidden className="mt-6 space-y-1.5">
      {rows.map((row, i) => (
        <div
          key={row.rank}
          className={cn(
            'flex items-center gap-2 rounded-lg border border-border/60 bg-background px-2.5 py-1.5',
            i === 0 && 'ring-1 ring-primary/30'
          )}
        >
          <span
            className={cn(
              'flex size-5 items-center justify-center rounded-full text-[10px] font-bold',
              row.cls
            )}
          >
            {row.rank}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
            {row.name}
          </span>
          {i === 0 && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
        </div>
      ))}
    </div>
  )
}

/** Mini podium visual — 2nd, 1st, 3rd. */
function SeasonVisual() {
  const cols = [
    { h: 'h-9', cls: 'bg-[var(--silver)]/40', place: '2' },
    { h: 'h-14', cls: 'bg-[var(--gold)]/50', place: '1' },
    { h: 'h-6', cls: 'bg-[var(--bronze)]/40', place: '3' },
  ] as const
  return (
    <div aria-hidden className="mt-6 flex h-20 items-end justify-center gap-2">
      {cols.map((col) => (
        <div key={col.place} className={cn('flex w-12 flex-col items-center gap-1', col.h)}>
          <span className="text-[10px] font-bold text-muted-foreground">{col.place}</span>
          <div className={cn('w-full flex-1 rounded-t-lg', col.cls)} />
        </div>
      ))}
    </div>
  )
}

/** Mini music-submission row. */
function MusicVisual() {
  return (
    <div aria-hidden className="mt-6">
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2.5">
        <Music2 className="h-4 w-4 shrink-0 text-primary" />
        <div className="flex h-4 flex-1 items-center gap-0.5">
          {[3, 6, 4, 8, 5, 7, 3, 6].map((h, i) => (
            <span key={i} style={{ height: `${h * 12.5}%` }} className="w-0.5 rounded-full bg-primary/40" />
          ))}
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
          Reviewed
        </span>
      </div>
    </div>
  )
}

const CARDS = [
  {
    id: 'judging',
    icon: Gavel,
    title: 'Floor judging that survives weak Wi-Fi',
    body: 'Large-target clicker scoring for TE, sliders for FE, drafts with autosave, and an offline queue that syncs when connectivity returns.',
    visual: JudgingVisual,
    span: 'md:col-span-2',
  },
  {
    id: 'visualiser',
    icon: BarChart3,
    title: 'Panel visualiser',
    body: 'Head judges lock divisions, spot outliers, and toggle whether a judge counts.',
    visual: VisualiserVisual,
    span: '',
  },
  {
    id: 'boards',
    icon: Radio,
    title: 'Live boards, then official results',
    body: 'Realtime leaderboards fans open from a link. Hide scores until complete, then publish official results.',
    href: '/leaderboards',
    linkLabel: 'Browse live boards',
    visual: BoardsVisual,
    span: '',
  },
  {
    id: 'ops',
    icon: CalendarCog,
    title: 'Event ops without the spreadsheet pile',
    body: 'Divisions, staff capabilities, registration with waitlist, music review, schedule, and explicit track advancement in one hub.',
    visual: OpsVisual,
    span: 'md:col-span-2',
  },
  {
    id: 'season',
    icon: TrendingUp,
    title: 'Season continuity',
    body: 'World and national-style races with style and field filters, public player profiles, and a clear how-it-works explainer.',
    href: '/rankings',
    linkLabel: 'View rankings',
    visual: SeasonVisual,
    span: '',
  },
  {
    id: 'music',
    icon: Music2,
    title: 'Music & registration',
    body: 'Competitors register, submit music, and manage linked competitors and guardians from one account.',
    visual: MusicVisual,
    span: '',
  },
] as const

export default function FeatureChapters() {
  const reduce = useReducedMotion()

  return (
    <section id="features" className="bg-background">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-24">
        <motion.div {...fadeUp(reduce)}>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            From registration to season points
          </h2>
          <p className="mt-3 max-w-xl text-pretty text-muted-foreground">
            One stack for the whole contest lifecycle — not five tools stitched together with exports.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {CARDS.map((card, i) => {
            const Icon = card.icon
            const Visual = card.visual
            return (
              <motion.article
                key={card.id}
                id={card.id}
                {...fadeUp(reduce, (i % 3) * 0.06)}
                className={cn(
                  'group pressable flex flex-col rounded-3xl border border-border/60 bg-muted/30 p-5 transition-colors hover:border-primary/30 hover:bg-muted/50',
                  card.span
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    {card.title}
                  </h3>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
                <div className="mt-auto">
                  <Visual />
                </div>
                {'href' in card && card.href ? (
                  <Link
                    href={card.href}
                    className="mt-4 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary hover:underline"
                  >
                    {card.linkLabel}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
