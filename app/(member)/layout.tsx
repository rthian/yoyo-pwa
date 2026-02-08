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
