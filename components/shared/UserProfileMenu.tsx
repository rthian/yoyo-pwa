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
