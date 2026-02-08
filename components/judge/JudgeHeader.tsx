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
