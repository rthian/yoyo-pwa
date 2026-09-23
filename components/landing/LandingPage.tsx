/**
 * Landing Page Component
 * Mobile-first public entry — brand, one CTA, then quiet capability rows
 */
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronRight, Gavel, Shield, Trophy, Users } from 'lucide-react'

const capabilities = [
  {
    href: '/login',
    icon: Shield,
    title: 'Admin Portal',
    description: 'Events, divisions, members, and judges',
  },
  {
    href: '/login',
    icon: Gavel,
    title: 'Mobile Judging',
    description: 'Score freestyles with large touch targets',
  },
  {
    href: '/rankings',
    icon: Trophy,
    title: 'League Rankings',
    description: 'Season points by 1A–5A and world → state',
  },
  {
    href: '/leaderboards',
    icon: Trophy,
    title: 'Live Leaderboards',
    description: 'Shareable boards that update in real time',
  },
  {
    href: '/login',
    icon: Users,
    title: 'Member Profiles',
    description: 'History, rankings, and event participation',
  },
] as const

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur safe-area-top">
        <div className="mx-auto flex h-14 max-w-lg items-center px-4">
          <span className="text-xl" aria-hidden>
            🪀
          </span>
          <span className="ml-2 text-base font-semibold tracking-tight">YoYo League</span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-8">
        <section className="flex min-h-[70dvh] flex-col items-center justify-center text-center py-10">
          <div className="mb-6 flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-4xl">
            🪀
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">YoYo League</h1>
          <p className="mt-3 max-w-sm text-base text-muted-foreground leading-relaxed">
            Event management, judging, and live rankings for competitive yo-yo.
          </p>
          <Button asChild size="lg" className="mt-8 h-12 min-w-[200px] rounded-full px-8 text-base">
            <Link href="/login">Sign In</Link>
          </Button>
        </section>

        <section className="space-y-2 pb-6" aria-label="What you can do">
          <h2 className="px-1 text-sm font-medium text-muted-foreground tracking-wide uppercase">
            Explore
          </h2>
          <ul className="overflow-hidden rounded-2xl border bg-card divide-y">
            {capabilities.map(({ href, icon: Icon, title, description }) => (
              <li key={title}>
                <Link
                  href={href}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-accent/80 transition-colors tap-highlight-none"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block font-medium tracking-tight">{title}</span>
                    <span className="block text-sm text-muted-foreground truncate">
                      {description}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-auto border-t pt-6 text-center text-xs text-muted-foreground safe-area-bottom">
          <p>YoYo League — Event Management & Judging</p>
          <p className="mt-2">
            © {new Date().getFullYear()} YoYo League. Created by{' '}
            <a
              href="https://github.com/rthian"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
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
