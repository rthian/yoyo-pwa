import WelcomeHero from '@/components/marketing/WelcomeHero'
import AudienceSection from '@/components/marketing/AudienceSection'
import FeatureChapters from '@/components/marketing/FeatureChapters'
import MarketingCta from '@/components/marketing/MarketingCta'

/** Logged-out marketing homepage body (used at `/`). */
export default function MarketingHome() {
  return (
    <>
      <WelcomeHero />
      <AudienceSection />
      <FeatureChapters />
      <MarketingCta />
    </>
  )
}
