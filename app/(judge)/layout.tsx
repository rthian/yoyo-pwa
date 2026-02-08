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
    <div className="min-h-screen bg-background pb-16">
      <JudgeHeader member={member} />
      <OfflineIndicator />
      <main className="p-4">
        {children}
      </main>
      <JudgeBottomNav />
    </div>
  )
}
