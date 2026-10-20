import WelcomeHero from '@/components/marketing/WelcomeHero'
import LiveTicker from '@/components/marketing/LiveTicker'
import AudienceSection from '@/components/marketing/AudienceSection'
import FeatureChapters from '@/components/marketing/FeatureChapters'
import MarketingCta from '@/components/marketing/MarketingCta'

/** Logged-out marketing homepage body (used at `/`). */
export default function MarketingHome() {
  return (
    <>
      <WelcomeHero />
      <LiveTicker />
      <FeatureChapters />
      <AudienceSection />
      <MarketingCta />
    </>
  )
}
