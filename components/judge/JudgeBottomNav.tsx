/**
 * Judge Bottom Navigation
 * Mobile-optimized bottom navigation bar for judge interface
 */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Home, List, Clock, CheckCircle } from 'lucide-react'

const navItems = [
  { href: '/judge', label: 'Home', icon: Home },
  { href: '/judge/divisions', label: 'Divisions', icon: List },
  { href: '/judge/queue', label: 'Queue', icon: Clock },
  { href: '/judge/completed', label: 'Done', icon: CheckCircle },
]

export default function JudgeBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href ||
            (item.href !== '/judge' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-16',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
