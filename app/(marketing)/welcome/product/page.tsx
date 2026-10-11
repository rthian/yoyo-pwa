import type { Metadata } from 'next'
import ProductSummary from '@/components/marketing/ProductSummary'
import MarketingCta from '@/components/marketing/MarketingCta'

export const metadata: Metadata = {
  title: 'Product — YoYo League',
  description:
    'What YoYo League includes today for organizers, judges, competitors, and fans — and what is coming next.',
}

export default function WelcomeProductPage() {
  return (
    <>
      <ProductSummary />
      <MarketingCta
        title="Ready to use it?"
        body="Sign in if you already have an account, or create one to register, judge, or organize."
      />
    </>
  )
}
