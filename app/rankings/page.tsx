/**
 * /rankings — season standings with WCA-style filters.
 * Next.js route entry. Wraps RankingsClient in Suspense for useSearchParams.
 * User: rankings filter better like WCA; gender; search
 */
import { Suspense } from 'react'
import Link from 'next/link'
import RankingsClient from '@/components/rankings/RankingsClient'

export const metadata = {
  title: 'League Rankings | YoYo League',
  description: 'Season points rankings by category, region, and division',
}

export default function RankingsPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-100 via-background to-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              YoYo League
            </p>
            <h1 className="text-xl font-bold tracking-tight">Rankings</h1>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/rankings/how-it-works" className="text-muted-foreground hover:text-foreground">
              How it works
            </Link>
            <Link href="/leaderboards" className="text-muted-foreground hover:text-foreground">
              Live boards
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <RankingsClient />
        </Suspense>
      </main>
    </div>
  )
}
