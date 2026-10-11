'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'

export default function WelcomeHero() {
  const reduce = useReducedMotion()

  return (
    <section className="relative isolate min-h-[calc(100svh-4rem)] overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(120% 80% at 72% 18%, color-mix(in oklab, var(--primary) 24%, transparent), transparent 58%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-20 size-[min(70vw,520px)] rounded-full blur-3xl"
        style={{
          backgroundColor: 'color-mix(in oklab, var(--accent) 60%, transparent)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 bottom-0 size-[min(50vw,360px)] rounded-full blur-3xl"
        style={{
          backgroundColor: 'color-mix(in oklab, var(--secondary) 70%, transparent)',
        }}
      />

      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-5xl flex-col justify-end px-4 pb-16 pt-24 sm:px-6 sm:pb-24">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl"
        >
          <h1 className="text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl md:text-7xl">
            YoYo League
          </h1>
          <p className="mt-4 text-pretty text-xl font-medium tracking-tight text-primary sm:text-2xl">
            Compete. Score. Rank.
          </p>
          <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            One PWA for event ops, floor judging that works offline, live boards, and season
            rankings.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="min-h-12 rounded-full px-8 text-base">
              <Link href="/signup">Create account</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-12 rounded-full bg-card/60 px-8 text-base"
            >
              <Link href="/leaderboards">Live boards</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
