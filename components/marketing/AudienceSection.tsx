'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { CalendarCog, Gavel, UserRound, Eye } from 'lucide-react'

const audiences = [
  {
    icon: CalendarCog,
    title: 'Organizers & staff',
    body: 'Publish events, run registration and music, lock scores, publish official results, and finalize season points.',
  },
  {
    icon: Gavel,
    title: 'Judges',
    body: 'Phone-first TE/FE scoring with drafts, overwrite confirm, offline queue, and head-judge lock plus panel visualiser.',
  },
  {
    icon: UserRound,
    title: 'Competitors & guardians',
    body: 'Register, submit music, manage linked competitors, and follow boards and season standing from one account.',
  },
  {
    icon: Eye,
    title: 'Fans',
    body: 'Open shareable live leaderboards and season rankings with no login required.',
  },
] as const

export default function AudienceSection() {
  const reduce = useReducedMotion()

  return (
    <section id="audiences" className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-24">
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

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{
                duration: 0.35,
                delay: reduce ? 0 : i * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="pressable rounded-3xl border border-border/60 bg-background p-5 transition-colors hover:border-primary/30"
            >
              <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
