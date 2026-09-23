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
  /** Flat SHEconomy meeting UI (live room + pre-join preview). */
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
  tile: 12,
  control: 10,
  dock: 12,
  panel: 12,
  chip: 999,
  card: 16,
} as const

export const SHECONOMY_MEETING_COLORS = {
  primary: brandColors.primary,
  primaryHover: brandColors.primaryDark,
  primaryLight: brandColors.primaryLight,
  coral: brandColors.coral,
  coralHover: '#E86A30',
  schedule: '#992855',
  scheduleHover: '#742444',
  share: brandColors.primary,
  shareHover: brandColors.primaryDark,
  green: '#10B981',
  red: '#E02828',
  redHover: '#C51E1E',
  darkBg: '#180D14',
  darkCanvas: '#10070D',
  darkToolbar: '#20111B',
  darkCard: '#271521',
  darkControl: '#361D2E',
  darkBorder: '#4E2138',
  darkText: '#FFFFFF',
  darkTextSecondary: '#E8D4DE',
  darkTextMuted: '#A48293',
  lightBg: '#FDF7FA',
  lightCard: '#FFFFFF',
  lightBorder: '#F5D7E4',
  lightText: '#230B17',
  lightTextSecondary: '#6E3350',
  lightTextMuted: '#9E6882',
} as const

/** @deprecated Use SHECONOMY_MEETING_COLORS directly */
export const SHECONOMY_COLORS = SHECONOMY_MEETING_COLORS

const coworkUiDark: CoWorkUiTokens = {
  pageBg: SHECONOMY_MEETING_COLORS.darkBg,
  pageBgAlt: SHECONOMY_MEETING_COLORS.darkCanvas,
  surface: SHECONOMY_MEETING_COLORS.darkCard,
  surfaceElevated: SHECONOMY_MEETING_COLORS.darkControl,
  surfaceMuted: SHECONOMY_MEETING_COLORS.darkToolbar,
  border: SHECONOMY_MEETING_COLORS.darkBorder,
  borderSoft: 'rgba(255, 255, 255, 0.1)',
  borderAccent: brandColors.primary,
  glass: 'rgba(24, 13, 20, 0.94)',
  glassElevated: 'rgba(39, 21, 33, 0.98)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  text: SHECONOMY_MEETING_COLORS.darkText,
  textSecondary: SHECONOMY_MEETING_COLORS.darkTextSecondary,
  textMuted: SHECONOMY_MEETING_COLORS.darkTextMuted,
  brand: brandColors.primary,
  brandDark: brandColors.primaryDark,
  brandLight: brandColors.primaryLight,
  brandMuted: 'rgba(216, 27, 96, 0.18)',
  brandGlow: 'rgba(216, 27, 96, 0.38)',
  coral: brandColors.coral,
  coralMuted: 'rgba(255, 140, 66, 0.18)',
  live: SHECONOMY_MEETING_COLORS.green,
  liveMuted: 'rgba(16, 185, 129, 0.16)',
  success: SHECONOMY_MEETING_COLORS.green,
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.16)',
  danger: SHECONOMY_MEETING_COLORS.red,
  dangerMuted: 'rgba(224, 40, 40, 0.18)',
  tileBg: '#22111C',
  tileBorder: '#3C1A2B',
  controlsBg: SHECONOMY_MEETING_COLORS.darkToolbar,
  controlsDock: SHECONOMY_MEETING_COLORS.darkToolbar,
  headerBg: SHECONOMY_MEETING_COLORS.darkToolbar,
  panelHeader: SHECONOMY_MEETING_COLORS.darkCard,
  chatBubbleSelf: brandColors.primary,
  chatBubbleOther: SHECONOMY_MEETING_COLORS.darkControl,
  chipBg: 'rgba(216, 27, 96, 0.18)',
  meetingBar: SHECONOMY_MEETING_COLORS.darkToolbar,
  meetingBarElevated: '#2E1727',
  meetingControl: SHECONOMY_MEETING_COLORS.darkControl,
  meetingControlActive: brandColors.primary,
  meetingIconMuted: SHECONOMY_MEETING_COLORS.darkTextMuted,
  radius: coworkRadius,
}

const coworkUiLight: CoWorkUiTokens = {
  pageBg: SHECONOMY_MEETING_COLORS.lightBg,
  pageBgAlt: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#FAF0F5',
  border: SHECONOMY_MEETING_COLORS.lightBorder,
  borderSoft: 'rgba(216, 27, 96, 0.08)',
  borderAccent: brandColors.primary,
  glass: 'rgba(255, 255, 255, 0.94)',
  glassElevated: 'rgba(255, 255, 255, 0.98)',
  glassBorder: 'rgba(216, 27, 96, 0.1)',
  text: SHECONOMY_MEETING_COLORS.lightText,
  textSecondary: SHECONOMY_MEETING_COLORS.lightTextSecondary,
  textMuted: SHECONOMY_MEETING_COLORS.lightTextMuted,
  brand: brandColors.primary,
  brandDark: brandColors.primaryDark,
  brandLight: brandColors.primaryLight,
  brandMuted: 'rgba(216, 27, 96, 0.1)',
  brandGlow: 'rgba(216, 27, 96, 0.22)',
  coral: brandColors.coral,
  coralMuted: 'rgba(255, 140, 66, 0.12)',
  live: SHECONOMY_MEETING_COLORS.green,
  liveMuted: 'rgba(16, 185, 129, 0.12)',
  success: SHECONOMY_MEETING_COLORS.green,
  warning: '#D97706',
  warningMuted: 'rgba(217, 119, 6, 0.12)',
  danger: SHECONOMY_MEETING_COLORS.red,
  dangerMuted: 'rgba(224, 40, 40, 0.1)',
  tileBg: '#FAF0F5',
  tileBorder: SHECONOMY_MEETING_COLORS.lightBorder,
  controlsBg: '#FFFFFF',
  controlsDock: '#FFFFFF',
  headerBg: '#FFFFFF',
  panelHeader: '#FFFFFF',
  chatBubbleSelf: brandColors.primary,
  chatBubbleOther: '#FAF0F5',
  chipBg: 'rgba(216, 27, 96, 0.1)',
  meetingBar: SHECONOMY_MEETING_COLORS.lightBg,
  meetingBarElevated: '#FFFFFF',
  meetingControl: '#F7E8F0',
  meetingControlActive: brandColors.primary,
  meetingIconMuted: SHECONOMY_MEETING_COLORS.lightTextMuted,
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
      page: `linear-gradient(180deg, #180D14 0%, #10070D 100%)`,
      header: 'linear-gradient(180deg, rgba(32, 17, 27, 0.98) 0%, rgba(24, 13, 20, 0.95) 100%)',
      activeControl: `linear-gradient(145deg, ${brandColors.primary} 0%, ${brandColors.primaryDark} 100%)`,
      dangerControl: `linear-gradient(145deg, #E02828 0%, #C51E1E 100%)`,
      recording: `linear-gradient(135deg, #E02828 0%, #B91C1C 100%)`,
      heroOrb: `radial-gradient(circle, rgba(216, 27, 96, 0.28) 0%, transparent 70%)`,
    }
  }

  return {
    page: `linear-gradient(180deg, #FDF7FA 0%, #FFFFFF 100%)`,
    header: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(253, 247, 250, 0.95) 100%)',
    activeControl: `linear-gradient(145deg, ${brandColors.primary} 0%, ${brandColors.primaryDark} 100%)`,
    dangerControl: `linear-gradient(145deg, #E02828 0%, #C51E1E 100%)`,
    recording: `linear-gradient(135deg, #E02828 0%, #B91C1C 100%)`,
    heroOrb: `radial-gradient(circle, rgba(216, 27, 96, 0.15) 0%, transparent 70%)`,
  }
}

export function getCoWorkShadows(scheme: 'light' | 'dark'): CoWorkShadows {
  if (scheme === 'dark') {
    return {
      dock: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(216, 27, 96, 0.15)',
      panel: '0 12px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(216, 27, 96, 0.12)',
      card: '0 4px 16px rgba(0, 0, 0, 0.35)',
      tile: '0 8px 24px rgba(0, 0, 0, 0.45)',
    }
  }

  return {
    dock: '0 4px 16px rgba(216, 27, 96, 0.08), 0 0 0 1px rgba(216, 27, 96, 0.08)',
    panel: '0 8px 24px rgba(216, 27, 96, 0.08), 0 0 0 1px rgba(216, 27, 96, 0.08)',
    card: '0 2px 12px rgba(216, 27, 96, 0.06)',
    tile: '0 4px 16px rgba(216, 27, 96, 0.08)',
  }
}

/** Flat meeting UI (no heavy glass blur) for live room bars. */
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
