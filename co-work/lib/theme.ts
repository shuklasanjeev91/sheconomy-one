import { useMemo } from 'react'
import { Platform } from 'react-native'
import { useThemeName } from 'tamagui'

import { brandColors, sheconomyDark, sheconomyLight } from '~/config/brand-colors'

export type CoWorkUiTokens = {
  pageBg: string
  pageBgAlt: string
  surface: string
  surfaceElevated: string
  surfaceMuted: string
  border: string
  borderSoft: string
  borderAccent: string
  glass: string
  glassElevated: string
  glassBorder: string
  text: string
  textSecondary: string
  textMuted: string
  brand: string
  brandDark: string
  brandLight: string
  brandMuted: string
  brandGlow: string
  coral: string
  coralMuted: string
  live: string
  liveMuted: string
  success: string
  warning: string
  warningMuted: string
  danger: string
  dangerMuted: string
  tileBg: string
  tileBorder: string
  controlsBg: string
  controlsDock: string
  headerBg: string
  panelHeader: string
  chatBubbleSelf: string
  chatBubbleOther: string
  chipBg: string
  radius: {
    tile: number
    control: number
    dock: number
    panel: number
    chip: number
    card: number
  }
}

export type CoWorkGradients = {
  page: string
  header: string
  activeControl: string
  dangerControl: string
  recording: string
  heroOrb: string
}

export type CoWorkShadows = {
  dock: string
  panel: string
  card: string
  tile: string
}

const coworkRadius = {
  tile: 18,
  control: 16,
  dock: 28,
  panel: 20,
  chip: 999,
  card: 22,
} as const

const coworkUiDark: CoWorkUiTokens = {
  pageBg: sheconomyDark.sheconomy1,
  pageBgAlt: sheconomyDark.sheconomy3,
  surface: sheconomyDark.sheconomy3,
  surfaceElevated: sheconomyDark.sheconomy4,
  surfaceMuted: sheconomyDark.sheconomy5,
  border: sheconomyDark.sheconomy6,
  borderSoft: 'rgba(255, 255, 255, 0.1)',
  borderAccent: 'rgba(246, 99, 158, 0.5)',
  glass: 'rgba(28, 15, 20, 0.88)',
  glassElevated: 'rgba(36, 17, 24, 0.96)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  text: sheconomyDark.sheconomy12,
  textSecondary: '#f0d4e0',
  textMuted: '#d9b8c8',
  brand: brandColors.primary,
  brandDark: brandColors.primaryDark,
  brandLight: brandColors.primaryLight,
  brandMuted: 'rgba(208, 16, 96, 0.18)',
  brandGlow: 'rgba(208, 16, 96, 0.4)',
  coral: brandColors.coral,
  coralMuted: 'rgba(248, 120, 64, 0.16)',
  live: '#34d399',
  liveMuted: 'rgba(52, 211, 153, 0.16)',
  success: '#4ade9a',
  warning: '#fbbf24',
  warningMuted: 'rgba(251, 191, 36, 0.14)',
  danger: '#f43f68',
  dangerMuted: 'rgba(244, 63, 104, 0.18)',
  tileBg: sheconomyDark.sheconomy3,
  tileBorder: sheconomyDark.sheconomy6,
  controlsBg: 'rgba(22, 12, 16, 0.88)',
  controlsDock: 'rgba(28, 15, 20, 0.94)',
  headerBg: 'rgba(22, 12, 16, 0.82)',
  panelHeader: 'rgba(30, 16, 22, 0.96)',
  chatBubbleSelf: 'rgba(208, 16, 96, 0.22)',
  chatBubbleOther: 'rgba(255, 255, 255, 0.06)',
  chipBg: 'rgba(208, 16, 96, 0.12)',
  radius: coworkRadius,
}

const coworkUiLight: CoWorkUiTokens = {
  pageBg: sheconomyLight.sheconomy2,
  pageBgAlt: sheconomyLight.sheconomy3,
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  surfaceMuted: sheconomyLight.sheconomy3,
  border: sheconomyLight.sheconomy5,
  borderSoft: 'rgba(26, 10, 18, 0.08)',
  borderAccent: 'rgba(208, 16, 96, 0.28)',
  glass: 'rgba(255, 255, 255, 0.88)',
  glassElevated: 'rgba(255, 255, 255, 0.96)',
  glassBorder: 'rgba(26, 10, 18, 0.1)',
  text: '#1a0a12',
  textSecondary: '#5c3d4d',
  textMuted: '#8f7380',
  brand: brandColors.primary,
  brandDark: brandColors.primaryDark,
  brandLight: brandColors.primaryLight,
  brandMuted: 'rgba(208, 16, 96, 0.1)',
  brandGlow: 'rgba(208, 16, 96, 0.2)',
  coral: brandColors.coral,
  coralMuted: 'rgba(248, 120, 64, 0.12)',
  live: '#059669',
  liveMuted: 'rgba(5, 150, 105, 0.12)',
  success: '#258635',
  warning: '#d97706',
  warningMuted: 'rgba(217, 119, 6, 0.12)',
  danger: '#dc2626',
  dangerMuted: 'rgba(220, 38, 38, 0.1)',
  tileBg: sheconomyLight.sheconomy3,
  tileBorder: sheconomyLight.sheconomy5,
  controlsBg: 'rgba(255, 255, 255, 0.94)',
  controlsDock: 'rgba(255, 255, 255, 0.98)',
  headerBg: 'rgba(255, 255, 255, 0.92)',
  panelHeader: 'rgba(255, 255, 255, 0.98)',
  chatBubbleSelf: 'rgba(208, 16, 96, 0.12)',
  chatBubbleOther: sheconomyLight.sheconomy3,
  chipBg: 'rgba(208, 16, 96, 0.08)',
  radius: coworkRadius,
}

export function getCoWorkUi(scheme: 'light' | 'dark'): CoWorkUiTokens {
  return scheme === 'dark' ? coworkUiDark : coworkUiLight
}

export function useCoWorkUi(): CoWorkUiTokens {
  const themeName = useThemeName()
  return getCoWorkUi(themeName === 'dark' ? 'dark' : 'light')
}

export function getCoWorkGradients(scheme: 'light' | 'dark', ui: CoWorkUiTokens): CoWorkGradients {
  if (scheme === 'dark') {
    return {
      page: `radial-gradient(ellipse 80% 50% at 20% -10%, rgba(208,16,96,0.18) 0%, transparent 55%),
    radial-gradient(ellipse 60% 40% at 90% 10%, rgba(248,120,64,0.1) 0%, transparent 50%),
    linear-gradient(165deg, ${sheconomyDark.sheconomy1} 0%, ${sheconomyDark.sheconomy3} 48%, #12080d 100%)`,
      header: 'linear-gradient(90deg, rgba(208,16,96,0.14) 0%, transparent 55%)',
      activeControl: `linear-gradient(145deg, ${brandColors.primaryLight} 0%, ${brandColors.primary} 55%, ${brandColors.primaryDark} 100%)`,
      dangerControl: `linear-gradient(145deg, #ff5c7a 0%, ${ui.danger} 100%)`,
      recording: `linear-gradient(135deg, #f43f68 0%, ${brandColors.primaryDark} 100%)`,
      heroOrb: 'radial-gradient(circle, rgba(208,16,96,0.35) 0%, transparent 70%)',
    }
  }

  return {
    page: `radial-gradient(ellipse 80% 50% at 20% -10%, rgba(208,16,96,0.08) 0%, transparent 55%),
    radial-gradient(ellipse 60% 40% at 90% 10%, rgba(248,120,64,0.06) 0%, transparent 50%),
    linear-gradient(165deg, ${sheconomyLight.sheconomy2} 0%, #ffffff 48%, ${sheconomyLight.sheconomy3} 100%)`,
    header: 'linear-gradient(90deg, rgba(208,16,96,0.08) 0%, transparent 55%)',
    activeControl: `linear-gradient(145deg, ${brandColors.primaryLight} 0%, ${brandColors.primary} 55%, ${brandColors.primaryDark} 100%)`,
    dangerControl: `linear-gradient(145deg, #ef4444 0%, ${ui.danger} 100%)`,
    recording: `linear-gradient(135deg, #ef4444 0%, ${brandColors.primaryDark} 100%)`,
    heroOrb: 'radial-gradient(circle, rgba(208,16,96,0.18) 0%, transparent 70%)',
  }
}

export function getCoWorkShadows(scheme: 'light' | 'dark'): CoWorkShadows {
  if (scheme === 'dark') {
    return {
      dock: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
      panel: '0 16px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
      card: '0 8px 32px rgba(0,0,0,0.28)',
      tile: '0 12px 40px rgba(0,0,0,0.35)',
    }
  }

  return {
    dock: '0 16px 48px rgba(208, 16, 96, 0.12), 0 0 0 1px rgba(26, 10, 18, 0.06)',
    panel: '0 12px 40px rgba(208, 16, 96, 0.1), 0 0 0 1px rgba(26, 10, 18, 0.06)',
    card: '0 4px 24px rgba(208, 16, 96, 0.08)',
    tile: '0 8px 32px rgba(208, 16, 96, 0.1)',
  }
}

export function useCoWorkTheme() {
  const themeName = useThemeName()
  const scheme = themeName === 'dark' ? 'dark' : 'light'
  const ui = useCoWorkUi()
  const gradients = useMemo(() => getCoWorkGradients(scheme, ui), [scheme, ui])
  const shadows = useMemo(() => getCoWorkShadows(scheme), [scheme])
  return { ui, gradients, shadows, scheme }
}

/** @deprecated Use `useCoWorkUi()` or `useCoWorkTheme()` for theme-aware tokens. */
export const COWORK_UI = coworkUiDark

/** @deprecated Use `useCoWorkTheme().gradients` for theme-aware gradients. */
export const COWORK_GRADIENTS = getCoWorkGradients('dark', coworkUiDark)

/** @deprecated Use `useCoWorkTheme().shadows` for theme-aware shadows. */
export const COWORK_SHADOWS = getCoWorkShadows('dark')

export function coworkGlassStyle(ui: CoWorkUiTokens, elevated = false) {
  const bg = elevated ? ui.glassElevated : ui.glass
  return Platform.select({
    web: {
      backgroundColor: bg,
      backdropFilter: 'blur(22px) saturate(150%)',
      WebkitBackdropFilter: 'blur(22px) saturate(150%)',
      borderColor: ui.glassBorder,
    },
    default: {
      backgroundColor: elevated ? ui.surfaceElevated : ui.surface,
      borderColor: ui.borderSoft,
    },
  })
}
