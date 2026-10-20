'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Smartphone, WifiOff, Eye } from 'lucide-react'

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
    <section className="px-4 py-20 sm:px-6 sm:py-24">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative isolate mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-primary px-6 py-14 text-primary-foreground sm:px-12 sm:py-16"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(80% 120% at 85% 0%, rgba(255,255,255,0.18), transparent 60%)',
          }}
        />
        <div className="relative">
          <h2 className="max-w-xl text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h2>
          <p className="mt-3 max-w-lg text-pretty text-base text-primary-foreground/85">
            {body}
          </p>
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
          <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2">
            {[
              { icon: Smartphone, label: 'Install-free PWA' },
              { icon: WifiOff, label: 'Offline judging' },
              { icon: Eye, label: 'Fan-friendly links' },
            ].map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-1.5 text-xs font-medium text-primary-foreground/75"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </section>
  )
}
