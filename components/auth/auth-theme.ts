import { useThemeName } from 'tamagui'

import { brandColors, sheconomyDark, sheconomyLight } from '~/config/brand-colors'

export type AuthUiTokens = {
  heroGradient: string
  heroMesh: string
  pageGradient: string
  cardRadius: number
  inputRadius: number
  pillRadius: number
  stepActive: string
  stepInactive: string
  stepText: string
  trustText: string
  trustMuted: string
  chipBg: string
  chipBorder: string
  chipIcon: string
  chipText: string
  glassBg: string
  glassBorder: string
  glassHighlight: string
  formShadow: string
  heroGlow: string
  formBg: string
  formBorder: string
  text: string
  textMuted: string
}

const authUiLight: AuthUiTokens = {
  heroGradient:
    'linear-gradient(155deg, #7a0538 0%, #9d0844 28%, #D01060 58%, #e84a8a 100%)',
  heroMesh:
    'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(255,255,255,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 85% 80%, rgba(248,120,64,0.22) 0%, transparent 55%)',
  pageGradient: 'linear-gradient(180deg, #fef5f9 0%, #ffffff 42%, #fefcfd 100%)',
  cardRadius: 24,
  inputRadius: 16,
  pillRadius: 999,
  stepActive: brandColors.primary,
  stepInactive: '#e8d4dc',
  stepText: '#8f7380',
  trustText: 'rgba(255,255,255,0.88)',
  trustMuted: 'rgba(255,255,255,0.68)',
  chipBg: 'rgba(208, 16, 96, 0.08)',
  chipBorder: 'rgba(208, 16, 96, 0.14)',
  chipIcon: brandColors.primary,
  chipText: '#9d0844',
  glassBg: 'rgba(255,255,255,0.14)',
  glassBorder: 'rgba(255,255,255,0.22)',
  glassHighlight: 'rgba(255,255,255,0.28)',
  formShadow: '0 24px 64px rgba(26, 10, 18, 0.08), 0 8px 24px rgba(26, 10, 18, 0.04)',
  heroGlow: '0 0 120px rgba(232, 74, 138, 0.35)',
  formBg: '#ffffff',
  formBorder: sheconomyLight.sheconomy5,
  text: '#1a0a12',
  textMuted: '#8f7380',
}

const authUiDark: AuthUiTokens = {
  heroGradient:
    'linear-gradient(155deg, #4a0320 0%, #7a0538 28%, #9d0844 58%, #D01060 100%)',
  heroMesh:
    'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(255,255,255,0.1) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 85% 80%, rgba(248,120,64,0.14) 0%, transparent 55%)',
  pageGradient: `linear-gradient(180deg, ${sheconomyDark.sheconomy1} 0%, ${sheconomyDark.sheconomy2} 42%, ${sheconomyDark.sheconomy1} 100%)`,
  cardRadius: 24,
  inputRadius: 16,
  pillRadius: 999,
  stepActive: brandColors.primaryLight,
  stepInactive: sheconomyDark.sheconomy5,
  stepText: sheconomyDark.sheconomy10,
  trustText: 'rgba(255,255,255,0.92)',
  trustMuted: 'rgba(255,255,255,0.72)',
  chipBg: 'rgba(208, 16, 96, 0.16)',
  chipBorder: 'rgba(208, 16, 96, 0.28)',
  chipIcon: brandColors.primaryLight,
  chipText: sheconomyDark.sheconomy12,
  glassBg: 'rgba(255,255,255,0.08)',
  glassBorder: 'rgba(255,255,255,0.14)',
  glassHighlight: 'rgba(255,255,255,0.18)',
  formShadow: '0 24px 64px rgba(0, 0, 0, 0.35), 0 8px 24px rgba(0, 0, 0, 0.2)',
  heroGlow: '0 0 120px rgba(208, 16, 96, 0.25)',
  formBg: sheconomyDark.sheconomy2,
  formBorder: sheconomyDark.sheconomy5,
  text: sheconomyDark.sheconomy12,
  textMuted: sheconomyDark.sheconomy10,
}

export function getAuthUi(scheme: 'light' | 'dark'): AuthUiTokens {
  return scheme === 'dark' ? authUiDark : authUiLight
}

export function useAuthUi(): AuthUiTokens {
  const themeName = useThemeName()
  return getAuthUi(themeName === 'dark' ? 'dark' : 'light')
}

/** @deprecated Use `useAuthUi()` for theme-aware tokens. */
export const AUTH_UI = authUiLight
