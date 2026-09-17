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
  /** Zoom-style flat meeting chrome (live room + pre-join preview). */
  meetingBar: string
  meetingBarElevated: string
  meetingControl: string
  meetingControlActive: string
  meetingIconMuted: string
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
  control: 12,
  dock: 16,
  panel: 16,
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
  brandMuted: 'rgba(216, 27, 96, 0.18)',
  brandGlow: 'rgba(216, 27, 96, 0.4)',
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
  controlsBg: 'rgba(26, 26, 26, 0.94)',
  controlsDock: 'rgba(36, 36, 36, 0.98)',
  headerBg: 'rgba(26, 26, 26, 0.92)',
  panelHeader: 'rgba(32, 32, 32, 0.98)',
  chatBubbleSelf: 'rgba(216, 27, 96, 0.22)',
  chatBubbleOther: 'rgba(255, 255, 255, 0.06)',
  chipBg: 'rgba(216, 27, 96, 0.12)',
  meetingBar: '#242424',
  meetingBarElevated: '#2e2e2e',
  meetingControl: '#3a3a3a',
  meetingControlActive: brandColors.primary,
  meetingIconMuted: '#c4c4c4',
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
  borderAccent: 'rgba(216, 27, 96, 0.28)',
  glass: 'rgba(255, 255, 255, 0.88)',
  glassElevated: 'rgba(255, 255, 255, 0.96)',
  glassBorder: 'rgba(26, 10, 18, 0.1)',
  text: '#1a0a12',
  textSecondary: '#5c3d4d',
  textMuted: '#8f7380',
  brand: brandColors.primary,
  brandDark: brandColors.primaryDark,
  brandLight: brandColors.primaryLight,
  brandMuted: 'rgba(216, 27, 96, 0.1)',
  brandGlow: 'rgba(216, 27, 96, 0.2)',
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
  controlsBg: 'rgba(245, 245, 245, 0.96)',
  controlsDock: 'rgba(255, 255, 255, 0.98)',
  headerBg: 'rgba(250, 250, 250, 0.96)',
  panelHeader: 'rgba(255, 255, 255, 0.98)',
  chatBubbleSelf: 'rgba(216, 27, 96, 0.12)',
  chatBubbleOther: sheconomyLight.sheconomy3,
  chipBg: 'rgba(216, 27, 96, 0.08)',
  meetingBar: '#f4f4f4',
  meetingBarElevated: '#ffffff',
  meetingControl: '#e8e8e8',
  meetingControlActive: brandColors.primary,
  meetingIconMuted: '#6b6b6b',
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
      page: `radial-gradient(ellipse 80% 50% at 20% -10%, rgba(216, 27, 96,0.18) 0%, transparent 55%),
    radial-gradient(ellipse 60% 40% at 90% 10%, rgba(248,120,64,0.1) 0%, transparent 50%),
    linear-gradient(165deg, ${sheconomyDark.sheconomy1} 0%, ${sheconomyDark.sheconomy3} 48%, #12080d 100%)`,
      header: 'linear-gradient(180deg, rgba(36, 36, 36, 0.98) 0%, rgba(26, 26, 26, 0.92) 100%)',
      activeControl: `linear-gradient(145deg, ${brandColors.primary} 0%, ${brandColors.primaryDark} 100%)`,
      dangerControl: `linear-gradient(145deg, #ff5c7a 0%, ${ui.danger} 100%)`,
      recording: `linear-gradient(135deg, #f43f68 0%, ${brandColors.primaryDark} 100%)`,
      heroOrb: 'radial-gradient(circle, rgba(216, 27, 96,0.35) 0%, transparent 70%)',
    }
  }

  return {
    page: `radial-gradient(ellipse 80% 50% at 20% -10%, rgba(216, 27, 96,0.08) 0%, transparent 55%),
    radial-gradient(ellipse 60% 40% at 90% 10%, rgba(248,120,64,0.06) 0%, transparent 50%),
    linear-gradient(165deg, ${sheconomyLight.sheconomy2} 0%, #ffffff 48%, ${sheconomyLight.sheconomy3} 100%)`,
    header: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 244, 244, 0.94) 100%)',
    activeControl: `linear-gradient(145deg, ${brandColors.primary} 0%, ${brandColors.primaryDark} 100%)`,
    dangerControl: `linear-gradient(145deg, #ef4444 0%, ${ui.danger} 100%)`,
    recording: `linear-gradient(135deg, #ef4444 0%, ${brandColors.primaryDark} 100%)`,
    heroOrb: 'radial-gradient(circle, rgba(216, 27, 96,0.18) 0%, transparent 70%)',
  }
}

export function getCoWorkShadows(scheme: 'light' | 'dark'): CoWorkShadows {
  if (scheme === 'dark') {
    return {
      dock: '0 8px 28px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
      panel: '0 12px 36px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
      card: '0 8px 32px rgba(0,0,0,0.28)',
      tile: '0 12px 40px rgba(0,0,0,0.35)',
    }
  }

  return {
    dock: '0 6px 20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(26, 10, 18, 0.06)',
    panel: '0 10px 28px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(26, 10, 18, 0.06)',
    card: '0 4px 24px rgba(216, 27, 96, 0.08)',
    tile: '0 8px 32px rgba(216, 27, 96, 0.1)',
  }
}

/** Flat meeting chrome (no heavy glass blur) for live room bars. */
export function meetingBarStyle(ui: CoWorkUiTokens, elevated = false) {
  return {
    backgroundColor: elevated ? ui.meetingBarElevated : ui.meetingBar,
    borderColor: ui.glassBorder,
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
