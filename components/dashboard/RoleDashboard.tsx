/**
 * Role Dashboard Component
 * Client-side wrapper that renders the appropriate dashboard based on the user's role
 */
'use client'

import { useAuth } from '@/lib/auth/context'
import { Loader2 } from 'lucide-react'
import AdminDashboardView from './AdminDashboardView'
import JudgeDashboardView from './JudgeDashboardView'
import MemberDashboardView from './MemberDashboardView'
import LandingPage from '@/components/landing/LandingPage'

export default function RoleDashboard() {
  const { user, member, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Not authenticated - show landing page
  if (!user || !member) {
    return <LandingPage />
  }

  // Render role-specific dashboard
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
