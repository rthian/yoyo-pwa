/**
 * Role Dashboard Component
 * Client-side wrapper that renders the appropriate dashboard based on the user's role.
 * Logged-out visitors are handled by `app/page.tsx` (marketing home).
 */
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { Loader2 } from 'lucide-react'
import AdminDashboardView from './AdminDashboardView'
import JudgeDashboardView from './JudgeDashboardView'
import MemberDashboardView from './MemberDashboardView'

export default function RoleDashboard() {
  const { user, member, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || !member)) {
      router.replace('/')
    }
  }, [loading, user, member, router])

  if (loading || !user || !member) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  switch (member.role) {
    case 'admin':
      return <AdminDashboardView member={member} />
    case 'judge':
      return <JudgeDashboardView member={member} />
    case 'member':
    default:
      return <MemberDashboardView member={member} />
  }
}
