import type { Metadata } from 'next'
import MarketingShell from '@/components/marketing/MarketingShell'

export const metadata: Metadata = {
  title: 'YoYo League — Compete. Score. Rank.',
  description:
    'Event ops, floor judging with offline support, live leaderboards, and season rankings for competitive yo-yo.',
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>
}
