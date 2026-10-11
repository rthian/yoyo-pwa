import Link from 'next/link'
import { Button } from '@/components/ui/button'

const nav = [
  { href: '/welcome/product', label: 'Product' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/leaderboards', label: 'Live boards' },
] as const

export default function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md safe-area-top">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-lg font-bold tracking-tight text-foreground"
        >
          YoYo League
        </Link>
        <nav className="hidden items-center gap-1 sm:flex" aria-label="Marketing">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden min-h-11 sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="min-h-11 rounded-full px-4">
            <Link href="/signup">Create account</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
