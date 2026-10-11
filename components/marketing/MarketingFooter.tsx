import Link from 'next/link'

export default function MarketingFooter() {
  return (
    <footer className="border-t border-border/70 bg-muted/40 safe-area-bottom">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="text-base font-semibold tracking-tight text-foreground">YoYo League</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Event ops, floor judging, live boards, and season rankings for competitive yo-yo.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Footer">
          <Link
            href="/welcome/product"
            className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground"
          >
            Product
          </Link>
          <Link
            href="/rankings"
            className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground"
          >
            Rankings
          </Link>
          <Link
            href="/leaderboards"
            className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground"
          >
            Live boards
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground"
          >
            App home
          </Link>
        </nav>
      </div>
      <div className="border-t border-border/60">
        <p className="mx-auto max-w-5xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} YoYo League
        </p>
      </div>
    </footer>
  )
}
