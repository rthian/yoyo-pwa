'use client'

import { useReducedMotion } from 'framer-motion'

const ITEMS = [
  'Offline-ready judging',
  'Live leaderboards',
  'Season rankings',
  'Music submission',
  'Waitlist registration',
  'Panel visualiser',
  'Public player profiles',
  'QR check-in receipts',
] as const

/** Seamless capability marquee between hero and content. */
export default function LiveTicker() {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <div className="border-y border-border/60 bg-muted/30">
        <ul className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
          {ITEMS.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 text-sm font-medium tracking-wide text-muted-foreground"
            >
              <span className="size-1.5 rounded-full bg-primary/50" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const row = [...ITEMS, ...ITEMS]

  return (
    <div
      aria-hidden
      className="overflow-hidden border-y border-border/60 bg-muted/30 py-4"
    >
      <div className="flex w-max animate-[ticker-scroll_30s_linear_infinite]">
        {row.map((item, i) => (
          <span key={`${item}-${i}`} className="flex items-center whitespace-nowrap">
            <span className="text-sm font-medium tracking-wide text-muted-foreground">
              {item}
            </span>
            <span className="mx-6 size-1.5 rounded-full bg-primary/40" />
          </span>
        ))}
      </div>
    </div>
  )
}
