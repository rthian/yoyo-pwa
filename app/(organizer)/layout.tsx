/**
 * Prompt 16: organizer self-service layout (event staff — not global admin nav).
 * Callers: Next.js wraps all /organize/* pages
 * Glob: no prior app/(organizer)/**
 * Auth: signed-in + admin OR any active event_staff_roles
 * User: "ok continue next"
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { canAccessOrganizeArea } from '@/lib/organize/access'
import { ClipboardList } from 'lucide-react'

export default async function OrganizerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/organize')
  }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()

  const allowed = await canAccessOrganizeArea(admin, user.id)
  if (!allowed) {
    redirect('/unauthorized')
  }

  const { data: member } = await admin
    .from('members')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center justify-between gap-4 px-4">
          <Link
            href="/organize"
            className="inline-flex items-center gap-2 font-semibold"
          >
            <ClipboardList className="h-5 w-5" />
            Event ops
          </Link>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="truncate max-w-[12rem]">
              {member?.full_name || 'Staff'}
            </span>
            {member?.role === 'admin' && (
              <Link
                href="/admin/events"
                className="underline hover:text-foreground"
              >
                Admin
              </Link>
            )}
            <Link href="/" className="underline hover:text-foreground">
              Home
            </Link>
          </div>
        </div>
      </header>
      <main className="container mx-auto flex-1 px-4 py-6">{children}</main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Event staff tools — scoped to events you are assigned to
      </footer>
    </div>
  )
}
