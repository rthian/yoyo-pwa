'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import HeroAppShowcase from '@/components/marketing/HeroAppShowcase'

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
            'radial-gradient(90% 70% at 78% 42%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 62%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-10 size-[min(65vw,480px)] rounded-full blur-3xl"
        style={{
          backgroundColor: 'color-mix(in oklab, var(--accent) 55%, transparent)',
        }}
      />

      {/* Single showcase: stacked on mobile, right plane on md+ (names stay clear of copy fade) */}
      <div className="pointer-events-none relative mx-auto w-full max-w-5xl px-4 pt-8 sm:px-6 md:absolute md:inset-y-0 md:right-0 md:mx-0 md:h-full md:max-w-none md:w-[58%] md:px-0 md:pr-0 md:pt-0 lg:w-[60%]">
        <div className="relative h-[min(48svh,400px)] w-full md:absolute md:inset-y-6 md:right-0 md:left-2 md:h-auto lg:left-4">
          <HeroAppShowcase className="absolute inset-0" />
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-background from-30% via-background/90 via-42% to-transparent to-55% md:block"
      />

      <div className="relative mx-auto flex min-h-0 max-w-5xl flex-col px-4 pb-16 pt-2 sm:px-6 sm:pb-24 md:min-h-[calc(100svh-4rem)] md:justify-center md:pb-20 md:pt-24">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-md lg:max-w-xl"
        >
          <h1 className="text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl md:text-7xl">
            YoYo League
          </h1>
          <p className="mt-4 text-pretty text-xl font-medium tracking-tight text-primary sm:text-2xl">
            Compete. Score. Rank.
          </p>
          <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Score on the floor — the live board updates as clicks land. Offline-ready judging, then
            season rankings, in one PWA.
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
