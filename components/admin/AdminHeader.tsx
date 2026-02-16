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
