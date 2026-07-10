import { Platform } from 'react-native'
import { useThemeName } from 'tamagui'

import { radius } from '~/config/tokens'
import { sheconomyDark, sheconomyLight } from '~/config/brand-colors'

/** Cross-platform auth layout tokens — web CSS + native fallbacks. */
export type AuthLayoutTokens = {
  heroGradient: string
  heroMesh: string
  pageGradient: string
  trustText: string
  trustMuted: string
  glassBg: string
  glassBorder: string
  marketingGlow: string
  formShadow: string
}

const light: AuthLayoutTokens = {
  heroGradient:
    'linear-gradient(155deg, #7a0538 0%, #9d0844 28%, #D01060 58%, #e84a8a 100%)',
  heroMesh:
    'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(255,255,255,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 85% 80%, rgba(248,120,64,0.22) 0%, transparent 55%)',
  pageGradient: 'linear-gradient(180deg, #fef5f9 0%, #ffffff 42%, #fefcfd 100%)',
  trustText: 'rgba(255,255,255,0.92)',
  trustMuted: 'rgba(255,255,255,0.72)',
  glassBg: 'rgba(255,255,255,0.16)',
  glassBorder: 'rgba(255,255,255,0.24)',
  marketingGlow: '0 0 120px rgba(232, 74, 138, 0.35)',
  formShadow: '0 24px 64px rgba(26, 10, 18, 0.08), 0 8px 24px rgba(26, 10, 18, 0.04)',
}

const dark: AuthLayoutTokens = {
  heroGradient:
    'linear-gradient(155deg, #4a0320 0%, #7a0538 28%, #9d0844 58%, #D01060 100%)',
  heroMesh:
    'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(255,255,255,0.1) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 85% 80%, rgba(248,120,64,0.14) 0%, transparent 55%)',
  pageGradient: `linear-gradient(180deg, ${sheconomyDark.sheconomy1} 0%, ${sheconomyDark.sheconomy2} 42%, ${sheconomyDark.sheconomy1} 100%)`,
  trustText: 'rgba(255,255,255,0.94)',
  trustMuted: 'rgba(255,255,255,0.74)',
  glassBg: 'rgba(255,255,255,0.1)',
  glassBorder: 'rgba(255,255,255,0.16)',
  marketingGlow: '0 0 120px rgba(208, 16, 96, 0.25)',
  formShadow: '0 24px 64px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.06)',
}

export const AUTH_LAYOUT = {
  cardRadius: radius.surface,
  inputRadius: radius.chip,
  pillRadius: radius.pill,
  stepInactive: sheconomyLight.sheconomy5,
  stepInactiveDark: sheconomyDark.sheconomy5,
} as const

export function getAuthLayout(scheme: 'light' | 'dark'): AuthLayoutTokens {
  return scheme === 'dark' ? dark : light
}

export function useAuthLayout(): AuthLayoutTokens {
  const themeName = useThemeName()
  return getAuthLayout(themeName === 'dark' ? 'dark' : 'light')
}

/** Native-safe marketing panel background (web uses CSS gradients). */
export function authHeroStyle(layout: AuthLayoutTokens, variant: 'mobile' | 'desktop' = 'desktop') {
  return Platform.select({
    web: {
      backgroundImage: `${layout.heroMesh}, ${layout.heroGradient}`,
    },
    default: {
      backgroundColor: '#9d0844',
    },
  })
}

export function authPageStyle(layout: AuthLayoutTokens) {
  return Platform.select({
    web: { backgroundImage: layout.pageGradient },
    default: {},
  })
}

/** Locked full-viewport shell for chromeless auth (desktop split + mobile form). */
export function authViewportStyle() {
  return Platform.select({
    web: {
      width: '100%' as const,
      maxWidth: '100%' as const,
      height: '100dvh' as const,
      minHeight: '100dvh' as const,
      maxHeight: '100dvh' as const,
      overflow: 'hidden' as const,
      display: 'flex' as const,
      flexDirection: 'column' as const,
    },
    default: { flex: 1, width: '100%' as const, maxWidth: '100%' as const },
  })
}
