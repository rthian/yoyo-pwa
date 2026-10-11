'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'

const chapters = [
  {
    id: 'ops',
    title: 'Event ops without the spreadsheet pile',
    body: 'Draft → publish → active. Divisions, staff capabilities, registration with waitlist, music review, schedule, tracks with explicit advancement, and day-of check-in live in one hub.',
  },
  {
    id: 'judging',
    title: 'Floor judging that survives weak Wi‑Fi',
    body: 'Large-target clicker scoring, drafts, and an offline queue that syncs when connectivity returns. Head judges lock divisions and inspect panel consistency in the visualiser.',
  },
  {
    id: 'boards',
    title: 'Live boards, then official results',
    body: 'Realtime leaderboards fans can open from a link. Hide scores until complete when you need it. Publish official results separately — then finalize for season ranking points.',
    href: '/leaderboards',
    linkLabel: 'Browse live boards',
  },
  {
    id: 'season',
    title: 'Season continuity',
    body: 'World and national-style races, filters by style and field, public player profiles, and a clear how-it-works explainer so standings are understandable.',
    href: '/rankings',
    linkLabel: 'View rankings',
  },
] as const

export default function FeatureChapters() {
  const reduce = useReducedMotion()

  return (
    <section id="features" className="bg-background">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          From registration to season points
        </h2>
        <p className="mt-3 max-w-xl text-pretty text-muted-foreground">
          One stack for the contest lifecycle — not five tools stitched with exports.
        </p>

        <div className="mt-14 space-y-16">
          {chapters.map((chapter, i) => (
            <motion.article
              key={chapter.id}
              id={chapter.id}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{
                duration: 0.4,
                delay: reduce ? 0 : (i % 2) * 0.04,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="max-w-2xl"
            >
              <p className="text-sm font-medium tracking-wide text-primary">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {chapter.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">{chapter.body}</p>
              {'href' in chapter && chapter.href ? (
                <Link
                  href={chapter.href}
                  className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
                >
                  {chapter.linkLabel}
                </Link>
              ) : null}
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
