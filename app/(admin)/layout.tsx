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
