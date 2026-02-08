/**
 * Home Page
 * Smart homepage that shows role-specific dashboard for authenticated users,
 * or the public landing page for unauthenticated visitors
 */

export const dynamic = 'force-dynamic'

import RoleDashboard from '@/components/dashboard/RoleDashboard'

export default function HomePage() {
  return <RoleDashboard />
}
