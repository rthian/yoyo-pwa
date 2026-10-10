/**
 * Prompt 16: lightweight chrome for /organize.
 * 1. Callers: app/(organizer)/layout.tsx
 * 2. Glob: no prior components/organizer/*
 * 3. Sample member: { full_name: "Ada", role: "member" }
 * 4. User: "ok let do Prompt 16"
 */
import Link from 'next/link'
import { signOut } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import type { Member } from '@/lib/types/database'

export default function OrganizerHeader({
  member,
}: {
  member: Pick<Member, 'full_name' | 'role'>
}) {
  return (
    <header className="border-b bg-background">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href="/organize" className="font-semibold tracking-tight">
            Organize
          </Link>
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/organize" className="hover:text-foreground">
              My events
            </Link>
            {member.role === 'admin' && (
              <Link href="/admin/events" className="hover:text-foreground">
                Admin
              </Link>
            )}
            {(member.role === 'judge' || member.role === 'admin') && (
              <Link href="/judge" className="hover:text-foreground">
                Judge
              </Link>
            )}
            <Link href="/member" className="hover:text-foreground">
              Member
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {member.full_name}
          </span>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
