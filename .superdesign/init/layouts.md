# Layout Components

Three role shells: admin (sidebar), judge (bottom nav), member (top header). Root layout provides fonts, AuthProvider, Toaster.

## app/layout.tsx
- Path: `app/layout.tsx`
```tsx
/**
 * Root Layout
 * Main layout component with PWA metadata and providers
 */
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/lib/auth/context'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'YoYo League',
  description: 'YoYo League — Event Management, Judging, and Ranking for Yo-Yo Competitions',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'YoYo League',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
```

## app/(admin)/layout.tsx
- Path: `app/(admin)/layout.tsx`
```tsx
/**
 * Admin Layout
 * Wraps all admin pages with navigation and auth protection
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminHeader from '@/components/admin/AdminHeader'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login?redirect=/admin')
  }

  // WORKAROUND: Use service role to bypass RLS for role check
  // TODO: Fix RLS policies to avoid infinite recursion
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabaseAdmin = createAdminClient()

  // Get member details using service role (bypasses RLS)
  const { data: member } = await supabaseAdmin
    .from('members')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!member || member.role !== 'admin') {
    redirect('/unauthorized')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AdminHeader member={member} />
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-1 p-6 flex flex-col">
          <div className="flex-1">{children}</div>
          <footer className="text-center text-xs text-muted-foreground py-4 mt-6 border-t">
            © {new Date().getFullYear()} YoYo League. Created by <a href="https://github.com/rthian" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">rthian</a>.
          </footer>
        </main>
      </div>
    </div>
  )
}
```

## app/(judge)/layout.tsx
- Path: `app/(judge)/layout.tsx`
```tsx
/**
 * Judge Layout
 * Mobile-first layout for judge interface with PWA support
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import JudgeHeader from '@/components/judge/JudgeHeader'
import JudgeBottomNav from '@/components/judge/JudgeBottomNav'
import OfflineIndicator from '@/components/judge/OfflineIndicator'

export default async function JudgeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login?redirect=/judge')
  }

  // WORKAROUND: Use service role to bypass RLS for role check
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabaseAdmin = createAdminClient()

  // Get member details using service role (bypasses RLS)
  const { data: member } = await supabaseAdmin
    .from('members')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!member || (member.role !== 'judge' && member.role !== 'admin')) {
    redirect('/unauthorized')
  }

  return (
    <div className="min-h-screen bg-background pb-16 flex flex-col">
      <JudgeHeader member={member} />
      <OfflineIndicator />
      <main className="p-4 flex-1">
        {children}
      </main>
      <footer className="text-center text-xs text-muted-foreground py-3 safe-area-bottom">
        © {new Date().getFullYear()} YoYo League. Created by <a href="https://github.com/rthian" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">rthian</a>.
      </footer>
      <JudgeBottomNav />
    </div>
  )
}
```

## app/(member)/layout.tsx
- Path: `app/(member)/layout.tsx`
```tsx
/**
 * Member Layout
 * Protects member routes, provides shared header navigation
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MemberLayoutClient from '@/components/shared/MemberLayoutClient'

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <MemberLayoutClient>{children}</MemberLayoutClient>
}
```

## components/admin/AdminHeader.tsx
- Path: `components/admin/AdminHeader.tsx`
```tsx
/**
 * Admin Header Component
 * Top navigation bar for admin interface
 */
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Menu, User, LogOut } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import type { Member } from '@/lib/types/database'

interface AdminHeaderProps {
  member: Member
}

export default function AdminHeader({ member }: AdminHeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 md:px-6">
        {/* Mobile menu trigger */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <nav className="flex flex-col gap-2 mt-4">
              <Link href="/admin" className="px-3 py-2 rounded-lg hover:bg-accent">
                Dashboard
              </Link>
              <Link href="/admin/events" className="px-3 py-2 rounded-lg hover:bg-accent">
                Events
              </Link>
              <Link href="/admin/members" className="px-3 py-2 rounded-lg hover:bg-accent">
                Members
              </Link>
              <Link href="/admin/judges" className="px-3 py-2 rounded-lg hover:bg-accent">
                Judges
              </Link>
              <Link href="/admin/reports" className="px-3 py-2 rounded-lg hover:bg-accent">
                Reports
              </Link>
              <Link href="/admin/settings" className="px-3 py-2 rounded-lg hover:bg-accent">
                Settings
              </Link>
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link href="/admin" className="flex items-center gap-2 font-semibold ml-2 md:ml-0">
          <span className="text-xl">🪀</span>
          <span className="hidden sm:inline">YoYo League Admin</span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <span className="hidden sm:inline">{member.full_name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{member.full_name}</span>
                <span className="text-xs text-muted-foreground">{member.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
```

## components/admin/AdminSidebar.tsx
- Path: `components/admin/AdminSidebar.tsx`
```tsx
/**
 * Admin Sidebar Navigation
 * Desktop-optimized navigation for admin interface
 */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Calendar,
  Users,
  Trophy,
  BarChart3,
  Settings,
  Home,
  BookOpen,
} from 'lucide-react'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: Home },
  { href: '/admin/events', label: 'Events', icon: Calendar },
  { href: '/admin/members', label: 'Members', icon: Users },
  { href: '/admin/judges', label: 'Judges', icon: Trophy },
  { href: '/admin/rules', label: 'Rules', icon: BookOpen },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-card min-h-[calc(100vh-64px)]">
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || 
            (item.href !== '/admin' && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

## components/judge/JudgeHeader.tsx
- Path: `components/judge/JudgeHeader.tsx`
```tsx
/**
 * Judge Header Component
 * Mobile-optimized header for judge interface with initials avatar
 */
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, Wifi, WifiOff, Home, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Member } from '@/lib/types/database'
import { formatCountryWithFlag } from '@/lib/utils/country-flags'

interface JudgeHeaderProps {
  member: Member
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function JudgeHeader({ member }: JudgeHeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isOnline, setIsOnline] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = getInitials(member.full_name)
  const countryDisplay = formatCountryWithFlag(member.country)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        {/* Logo */}
        <Link href="/judge" className="flex items-center gap-2 font-semibold">
          <span className="text-xl">🪀</span>
          <span>Judge Console</span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Back to Dashboard */}
        <Link href="/" className="mr-2">
          <Button variant="ghost" size="sm" className="flex items-center gap-1 text-muted-foreground">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Dashboard</span>
          </Button>
        </Link>

        {/* Online status indicator */}
        <div className="mr-2">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-yellow-500" />
          )}
        </div>

        {/* User menu with initials avatar - only mount after hydration to avoid Radix ID mismatch */}
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-semibold text-sm"
              >
                {initials}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{member.full_name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{member.email}</p>
                  {countryDisplay && (
                    <p className="text-xs leading-none text-muted-foreground mt-1">{countryDisplay}</p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/')}>
                <Home className="h-4 w-4 mr-2" />
                Back to Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/member/profile')}>
                <User className="h-4 w-4 mr-2" />
                Edit Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="ghost"
            className="relative h-9 w-9 rounded-full bg-primary text-primary-foreground font-semibold text-sm"
          >
            {initials}
          </Button>
        )}
      </div>
    </header>
  )
}
```

## components/judge/JudgeBottomNav.tsx
- Path: `components/judge/JudgeBottomNav.tsx`
```tsx
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
```

## components/judge/OfflineIndicator.tsx
- Path: `components/judge/OfflineIndicator.tsx`
```tsx
/**
 * Offline Indicator Component
 * Shows sync status and pending scores
 */
'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Wifi, 
  WifiOff, 
  Cloud, 
  CloudOff, 
  RefreshCw,
  Loader2 
} from 'lucide-react'
import { 
  subscribeSyncStatus, 
  attemptSync, 
  initSyncManager,
  type SyncStatus 
} from '@/lib/offline/sync-manager'
import { toast } from 'sonner'

export default function OfflineIndicator() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    pendingCount: 0,
    lastSyncTime: null,
    isSyncing: false,
  })

  useEffect(() => {
    // Initialize sync manager
    const cleanup = initSyncManager()
    
    // Subscribe to status changes
    const unsubscribe = subscribeSyncStatus(setStatus)

    return () => {
      cleanup?.()
      unsubscribe()
    }
  }, [])

  const handleManualSync = async () => {
    if (!status.isOnline) {
      toast.error('Cannot sync while offline')
      return
    }
    
    toast.promise(attemptSync(), {
      loading: 'Syncing scores...',
      success: 'Scores synced!',
      error: 'Sync failed',
    })
  }

  // Don't show anything if online and no pending scores
  if (status.isOnline && status.pendingCount === 0 && !status.isSyncing) {
    return null
  }

  return (
    <div className="fixed top-14 left-0 right-0 z-40 px-4 py-2 bg-background/95 backdrop-blur border-b">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          {status.isOnline ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-yellow-500" />
          )}
          
          <span className="text-sm">
            {status.isOnline ? 'Online' : 'Offline'}
          </span>

          {status.pendingCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {status.pendingCount} pending
            </Badge>
          )}
        </div>

        {status.pendingCount > 0 && status.isOnline && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualSync}
            disabled={status.isSyncing}
          >
            {status.isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
```

## components/shared/MemberLayoutClient.tsx
- Path: `components/shared/MemberLayoutClient.tsx`
```tsx
/**
 * Member Layout Client Wrapper
 * Client component that wraps member pages with header navigation
 */
'use client'

import MemberHeader from './MemberHeader'

export default function MemberLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MemberHeader />
      <main className="min-h-screen bg-gradient-to-b from-background to-muted">
        {children}
      </main>
    </>
  )
}
```

## components/shared/MemberHeader.tsx
- Path: `components/shared/MemberHeader.tsx`
```tsx
/**
 * Member Header Component
 * Navigation header for player/member pages with profile menu
 */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Calendar, Trophy, Home } from 'lucide-react'
import UserProfileMenu from './UserProfileMenu'

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/member/events', label: 'Events', icon: Calendar },
  { href: '/leaderboards', label: 'Leaderboards', icon: Trophy },
]

export default function MemberHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold mr-6">
          <span className="text-xl">🪀</span>
          <span className="hidden sm:inline">YoYo League</span>
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
```

## components/shared/JudgeDashboardHeader.tsx
- Path: `components/shared/JudgeDashboardHeader.tsx`
```tsx
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
          <span className="hidden sm:inline">YoYo League</span>
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
```

## components/shared/UserProfileMenu.tsx
- Path: `components/shared/UserProfileMenu.tsx`
```tsx
/**
 * User Profile Menu Component
 * Displays user initials as avatar with dropdown menu for profile & logout
 * Shared across player and judge dashboards
 */
'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User } from 'lucide-react'
import { formatCountryWithFlag } from '@/lib/utils/country-flags'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface UserProfileMenuProps {
  /** Override profile edit link (defaults to /member/profile) */
  profileHref?: string
}

export default function UserProfileMenu({ profileHref = '/member/profile' }: UserProfileMenuProps) {
  const router = useRouter()
  const { member, signOut } = useAuth()

  if (!member) return null

  const initials = getInitials(member.full_name)
  const countryDisplay = formatCountryWithFlag(member.country)

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  const handleEditProfile = () => {
    router.push(profileHref)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-semibold text-sm"
        >
          {initials}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{member.full_name}</p>
            <p className="text-xs leading-none text-muted-foreground">{member.email}</p>
            {countryDisplay && (
              <p className="text-xs leading-none text-muted-foreground mt-1">{countryDisplay}</p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleEditProfile}>
          <User className="h-4 w-4 mr-2" />
          My Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

## components/landing/LandingPage.tsx
- Path: `components/landing/LandingPage.tsx`
```tsx
/**
 * Landing Page Component
 * Public-facing landing page for unauthenticated users
 */
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Gavel, Trophy, Users } from 'lucide-react'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">🪀</div>
        <h1 className="text-4xl font-bold mb-4">YoYo League</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Event management, judging, and ranking system for competitive yo-yo events
        </p>
        
        <div className="flex gap-4 justify-center flex-wrap">
          <Button asChild size="lg">
            <Link href="/login">
              Sign In
            </Link>
          </Button>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8">Features</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="h-full">
            <CardHeader>
              <Shield className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Admin Portal</CardTitle>
              <CardDescription>
                Manage events, divisions, members, and judges all in one place
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="h-full">
            <CardHeader>
              <Gavel className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Mobile Judging</CardTitle>
              <CardDescription>
                Mobile-optimized interface for judges to score competitors on the go
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Link href="/leaderboards">
            <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
              <CardHeader>
                <Trophy className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Live Leaderboards</CardTitle>
                <CardDescription>
                  Real-time scoring updates with shareable public leaderboard links
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          
          <Card className="h-full">
            <CardHeader>
              <Users className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Member Profiles</CardTitle>
              <CardDescription>
                Track participant history, rankings, and event participation
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>YoYo League — Event Management & Judging</p>
          <p className="text-sm mt-2">Built with Next.js, Supabase, and shadcn/ui</p>
          <p className="text-xs mt-2">© {new Date().getFullYear()} YoYo League. Created by <a href="https://github.com/rthian" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">rthian</a>.</p>
        </div>
      </footer>
    </main>
  )
}
```

