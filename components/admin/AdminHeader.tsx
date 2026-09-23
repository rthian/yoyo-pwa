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
import { Menu, User, LogOut, ExternalLink } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { formatCountryWithFlag } from '@/lib/utils/country-flags'
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
              <Link href="/admin/profile" className="px-3 py-2 rounded-lg hover:bg-accent">
                My Profile
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="px-3 py-2 rounded-lg hover:bg-accent text-left text-destructive"
              >
                Sign out
              </button>
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
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-semibold text-sm"
              aria-label="Account menu"
            >
              {member.full_name
                .split(' ')
                .map((part) => part.charAt(0))
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <span className="text-sm font-medium leading-none">{member.full_name}</span>
                <span className="text-xs leading-none text-muted-foreground">{member.email}</span>
                {formatCountryWithFlag(member.country) && (
                  <span className="text-xs leading-none text-muted-foreground">
                    {formatCountryWithFlag(member.country)}
                  </span>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/admin/profile')}>
              <User className="h-4 w-4 mr-2" />
              My Profile
            </DropdownMenuItem>
            {member.public_id && (
              <DropdownMenuItem onClick={() => router.push(`/players/${member.public_id}`)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Public profile
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
