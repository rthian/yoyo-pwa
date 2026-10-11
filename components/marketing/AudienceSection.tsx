'use client'

import { motion, useReducedMotion } from 'framer-motion'

const audiences = [
  {
    title: 'Organizers & staff',
    body: 'Publish events, run registration and music, lock scores, publish official results, and finalize season points — with capability-scoped /organize panels.',
  },
  {
    title: 'Judges',
    body: 'Phone-first TE/FE scoring with drafts, overwrite confirm, offline queue, and head-judge lock plus panel visualiser.',
  },
  {
    title: 'Competitors & guardians',
    body: 'Register, submit music, manage linked competitors, and follow boards and season standing from one account.',
  },
  {
    title: 'Fans',
    body: 'Open shareable live leaderboards and season rankings with no login required.',
  },
] as const

export default function AudienceSection() {
  const reduce = useReducedMotion()

  return (
    <section id="audiences" className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built for the whole contest
          </h2>
          <p className="mt-3 max-w-xl text-pretty text-muted-foreground">
            Same product, role-aware surfaces — from stage ops to the phone in a judge’s hand.
          </p>
        </motion.div>

        <ul className="mt-12 divide-y divide-border/70 border-y border-border/70">
          {audiences.map(({ title, body }, i) => (
            <motion.li
              key={title}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{
                duration: 0.35,
                delay: reduce ? 0 : i * 0.05,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="grid gap-2 py-8 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-10"
            >
              <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
              <p className="text-base leading-relaxed text-muted-foreground">{body}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}
