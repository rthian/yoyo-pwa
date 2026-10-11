'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'

type MarketingCtaProps = {
  title?: string
  body?: string
}

export default function MarketingCta({
  title = 'Run your next contest here',
  body = 'Create an account to register, judge, or organize — or jump straight into public boards and rankings.',
}: MarketingCtaProps) {
  const reduce = useReducedMotion()

  return (
    <section className="border-t border-border/60 bg-primary text-primary-foreground">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20"
      >
        <h2 className="max-w-xl text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 max-w-lg text-pretty text-base text-primary-foreground/85">{body}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            asChild
            size="lg"
            className="min-h-12 rounded-full bg-card px-8 text-foreground hover:bg-card/90"
          >
            <Link href="/signup">Create account</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="min-h-12 rounded-full border-primary-foreground/40 bg-transparent px-8 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </motion.div>
    </section>
  )
}
