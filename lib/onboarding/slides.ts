import type { LucideIcon } from '~/components/ui/icons'
import { Calendar, MessageCircle, Radio, Sparkles, Store, Users } from '~/components/ui/icons'
import { BRAND_NAME } from '~/config/brand'

export type AppOnboardingSlide = {
  icon: LucideIcon
  title: string
  body: string
  brandLogo?: boolean
}

/**
 * Native first-launch + auth intro slides — short headlines, benefit-led copy,
 * same tone as top consumer apps.
 */
export const NATIVE_APP_ONBOARDING_SLIDES: AppOnboardingSlide[] = [
  {
    icon: Sparkles,
    title: `Welcome to ${BRAND_NAME}`,
    body: 'Shop, sell, learn, and grow with women-led brands and founders — all in one place.',
    brandLogo: true,
  },
  {
    icon: Store,
    title: 'Marketplace built for her',
    body: 'Discover thoughtfully made products, follow shops you love, and check out with confidence.',
  },
  {
    icon: Users,
    title: 'Community that lifts you',
    body: 'Share updates, celebrate wins, and build real connections with people on the same path.',
  },
  {
    icon: MessageCircle,
    title: 'Chat & Co-Work',
    body: 'Message members, hop on calls, and join live meetings when you need to collaborate.',
  },
  {
    icon: Radio,
    title: 'Learn anytime with Class',
    body: 'Browse video and audio programs designed for women entrepreneurs — watch when it suits you.',
  },
  {
    icon: Calendar,
    title: 'Events & opportunities',
    body: 'RSVP to workshops and meetups, explore jobs, and take the next step in your journey.',
  },
]

/** Alias used by AuthOnboarding / AuthShell. */
export const AUTH_ONBOARDING_SLIDES = NATIVE_APP_ONBOARDING_SLIDES
