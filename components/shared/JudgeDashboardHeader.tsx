/**
 * Judge Dashboard Header Component
 * Navigation header for judge dashboard (shown on homepage, not inside /judge mobile UI)
 */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Home, Gavel, Trophy } from 'lucide-react'
import UserProfileMenu from './UserProfileMenu'

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/judge', label: 'Judge Console', icon: Gavel },
  { href: '/leaderboards', label: 'Leaderboards', icon: Trophy },
]

export default function JudgeDashboardHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold mr-6">
          <span className="text-xl">🪀</span>
          <span className="hidden sm:inline">YoYo Events</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Profile Menu */}
        <UserProfileMenu />
      </div>
    </header>
  )
}
