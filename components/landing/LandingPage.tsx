/**
 * Landing Page Component
 * Mobile-first public entry — brand, one CTA, then quiet capability rows
 */
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'

const capabilities = [
  {
    href: '/rankings',
    title: 'League Rankings',
    description: 'Season points by 1A–5A and world → state',
  },
  {
    href: '/leaderboards',
    title: 'Live Leaderboards',
    description: 'Shareable boards that update in real time',
  },
  {
    href: '/login',
    title: 'Member hub',
    description: 'Profiles, registrations, and music',
  },
  {
    href: '/login',
    title: 'Judging & admin',
    description: 'Sign in for scoring and event ops',
  },
] as const

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur safe-area-top">
        <div className="mx-auto flex h-14 max-w-lg items-center px-4">
          <span className="text-base font-semibold tracking-tight text-foreground">
            YoYo League
          </span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-8">
        <section className="flex min-h-[60dvh] flex-col items-center justify-center text-center py-10">
          <p className="text-sm font-medium tracking-wide text-primary">YoYo League</p>
          <h1 className="mt-2 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Compete. Score. Rank.
          </h1>
          <p className="mt-3 max-w-sm text-pretty text-base text-muted-foreground leading-relaxed">
            Event management, judging, and live rankings for competitive yo-yo.
          </p>
          <Button asChild size="lg" className="mt-8 min-w-[200px] rounded-full px-8 text-base">
            <Link href="/login">Sign In</Link>
          </Button>
        </section>

        <section className="space-y-2 pb-6" aria-label="What you can do">
          <h2 className="px-1 text-sm font-medium text-muted-foreground tracking-wide">
            Explore
          </h2>
          <ul className="overflow-hidden rounded-2xl bg-muted divide-y divide-border/70">
            {capabilities.map(({ href, title, description }) => (
              <li key={title}>
                <Link
                  href={href}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 active:bg-accent/80 transition-colors tap-highlight-none"
                >
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block font-medium tracking-tight text-foreground">{title}</span>
                    <span className="block text-sm text-muted-foreground truncate">
                      {description}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-auto border-t border-border/80 pt-6 text-center text-xs text-muted-foreground safe-area-bottom">
          <p>YoYo League — Event Management & Judging</p>
          <p className="mt-2">
            © {new Date().getFullYear()} YoYo League. Created by{' '}
            <a
              href="https://github.com/rthian"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center underline hover:text-foreground"
            >
              rthian
            </a>
            .
          </p>
        </footer>
      </div>
    </main>
  )
}
