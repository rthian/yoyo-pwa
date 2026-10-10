/**
 * Organizer layout — event staff (Prompt 16). Not global-admin-only.
 * 1. Callers: Next.js App Router for /organize/*
 * 2. Glob: no prior app/(organizer)/
 * 3. Session: { id, email, full_name, role, is_active }
 * 4. User: "ok let do Prompt 16"
 */
import { requireOrganizeLayoutAccess } from '@/lib/organize/access'
import OrganizerHeader from '@/components/organizer/OrganizerHeader'

export default async function OrganizerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { member } = await requireOrganizeLayoutAccess()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <OrganizerHeader member={member} />
      <main className="container mx-auto flex-1 px-4 py-6">{children}</main>
      <footer className="text-center text-xs text-muted-foreground py-4 border-t">
        © {new Date().getFullYear()} YoYo League · Event ops
      </footer>
    </div>
  )
}
