import type { LucideIcon } from '~/components/ui/icons'
import { Calendar, Radio, ShieldCheck, Store, Users } from '~/components/ui/icons'

import { BRAND_NAME } from '~/config/brand'
import type { AppOnboardingSlide } from '~/lib/onboarding/slides'

export type AuthBenefitSlide = AppOnboardingSlide & {
  icon: LucideIcon
}

export const AUTH_BENEFIT_SLIDES: AuthBenefitSlide[] = [
  {
    icon: ShieldCheck,
    title: 'Secure, passwordless sign-in',
    body: 'Verify with email or mobile — no passwords to remember, no separate sign-up flow.',
  },
  {
    icon: Store,
    title: 'Shop and sell in one place',
    body: `Discover women-led brands or open your own shop and reach customers across ${BRAND_NAME}.`,
  },
  {
    icon: Users,
    title: 'Grow your network',
    body: 'Connect with founders, follow inspiring profiles, and build meaningful relationships.',
  },
  {
    icon: Radio,
    title: 'Watch Class',
    body: 'Browse recorded video and audio — tap to play anytime, like a media library built into SHEconomy.',
  },
  {
    icon: Calendar,
    title: 'Join community events',
    body: 'RSVP to workshops, meetups, and live sessions tailored for women entrepreneurs.',
  },
]

export { AUTH_ONBOARDING_SLIDES, NATIVE_APP_ONBOARDING_SLIDES } from '~/lib/onboarding/slides'
