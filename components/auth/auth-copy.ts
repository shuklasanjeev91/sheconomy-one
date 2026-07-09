import { BRAND_NAME } from '~/config/brand'

/** Shared copy for passwordless OTP auth (sign-in + auto-registration). */
export const AUTH_COPY = {
  title: `Welcome to ${BRAND_NAME}`,
  subtitle: 'Sign in or create your account with a secure one-time code — no password required.',
  heroHeadline: 'Where women shop, sell, learn, and grow together.',
  heroSubline: 'One verification unlocks commerce, community, classes, and more.',
  footerLegal:
    'By continuing, you agree to receive a one-time verification code. Standard SMS or data rates may apply.',
  welcomeBack: `Welcome back to ${BRAND_NAME}`,
  welcomeNew: `Welcome to ${BRAND_NAME} — your account is ready`,
  trustBadges: ['Passwordless', 'Secure OTP', 'Built for women'] as const,
} as const
