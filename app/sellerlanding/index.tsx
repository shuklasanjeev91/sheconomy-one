import { useCallback } from 'react'
import { Platform } from 'react-native'

import { SellerApplicationForm } from '~/components/seller-landing/SellerApplicationForm'
import { BenefitsSection } from '~/components/seller-landing/sections/BenefitsSection'
import { CallToActionSection } from '~/components/seller-landing/sections/CallToActionSection'
import { EligibilitySection } from '~/components/seller-landing/sections/EligibilitySection'
import { FAQSection } from '~/components/seller-landing/sections/FAQSection'
import { HeroSection } from '~/components/seller-landing/sections/HeroSection'
import { HowItWorksSection } from '~/components/seller-landing/sections/HowItWorksSection'
import { IntroductionSection } from '~/components/seller-landing/sections/IntroductionSection'
import { ReadyToSellSection } from '~/components/seller-landing/sections/ReadyToSellSection'
import { TestimonialsSection } from '~/components/seller-landing/sections/TestimonialsSection'
import { TrustSection } from '~/components/seller-landing/sections/TrustSection'
import { YStack } from '~/components/ui'

export default function SellerLandingPage() {
  const scrollToForm = useCallback(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document
        .getElementById('seller-application-form')
        ?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  return (
    <YStack>
      <HeroSection onScrollToForm={scrollToForm} />
      <IntroductionSection />
      <BenefitsSection />
      <ReadyToSellSection onScrollToForm={scrollToForm} />
      <EligibilitySection />
      <HowItWorksSection onScrollToForm={scrollToForm} />
      <TestimonialsSection />
      <TrustSection />
      <CallToActionSection onScrollToForm={scrollToForm} />
      <FAQSection />
      <SellerApplicationForm />
    </YStack>
  )
}
