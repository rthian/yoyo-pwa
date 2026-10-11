/**
 * Home Page
 * Logged-out visitors see the marketing site; signed-in users get a role dashboard.
 */

export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import RoleDashboard from '@/components/dashboard/RoleDashboard'
import MarketingShell from '@/components/marketing/MarketingShell'
import MarketingHome from '@/components/marketing/MarketingHome'

export const metadata: Metadata = {
  title: 'YoYo League — Compete. Score. Rank.',
  description:
    'Event ops, floor judging with offline support, live leaderboards, and season rankings for competitive yo-yo.',
}

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <MarketingShell>
        <MarketingHome />
      </MarketingShell>
    )
  }

  return <RoleDashboard />
}
