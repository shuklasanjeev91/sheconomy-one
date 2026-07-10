import type { LucideIcon } from '@tamagui/lucide-icons'
import { Calendar, Radio, ShieldCheck, Sparkles, Store, Users } from '@tamagui/lucide-icons'

import { BRAND_NAME } from '~/config/brand'

export type AuthBenefitSlide = {
  icon: LucideIcon
  title: string
  body: string
  /** Show SHEconomy brand mark instead of the Lucide icon. */
  brandLogo?: boolean
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
    title: 'Learn with Classes',
    body: 'Watch video programs and listen to audio sessions from experts in the community.',
  },
  {
    icon: Calendar,
    title: 'Join community events',
    body: 'RSVP to workshops, meetups, and live sessions tailored for women entrepreneurs.',
  },
]

/** Full-screen mobile onboarding slides (welcome + key benefits). */
export const AUTH_ONBOARDING_SLIDES: AuthBenefitSlide[] = [
  {
    icon: Sparkles,
    title: `Welcome to ${BRAND_NAME}`,
    body: 'Where women shop, sell, learn, and grow together — one platform for commerce, community, and more.',
    brandLogo: true,
  },
  ...AUTH_BENEFIT_SLIDES.slice(0, 4),
]
