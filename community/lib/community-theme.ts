import { useThemeName } from 'tamagui'

import { brandColors, sheconomyDark, sheconomyLight } from '~/config/brand-colors'

export type CommunityUiTokens = {
  brand: string
  brandHover: string
  brandLight: string
  pageBg: string
  cardBg: string
  border: string
  borderLight: string
  text: string
  textMuted: string
  textSubtle: string
  divider: string
  bannerGradient: string
  cardRadius: number
  cardShadow: string
  reactionBarShadow: string
  inputBg: string
  inputBorder: string
  hoverBg: string
  accentMuted: string
}

const communityUiLight: CommunityUiTokens = {
  brand: '#0a66c2',
  brandHover: '#004182',
  brandLight: '#70b5f9',
  pageBg: '#f4f2f0',
  cardBg: '#ffffff',
  border: '#e8e4e6',
  borderLight: '#f0ecef',
  text: 'rgba(0,0,0,0.9)',
  textMuted: 'rgba(0,0,0,0.6)',
  textSubtle: 'rgba(0,0,0,0.45)',
  divider: 'rgba(0,0,0,0.08)',
  bannerGradient: 'linear-gradient(180deg, #004182 0%, #0a66c2 100%)',
  cardRadius: 18,
  cardShadow: '0 1px 2px rgba(208, 16, 96, 0.04), 0 8px 24px rgba(16, 12, 14, 0.06)',
  reactionBarShadow: '0 12px 32px rgba(16, 12, 14, 0.12), 0 0 0 1px rgba(0,0,0,0.04)',
  inputBg: '#ffffff',
  inputBorder: '#c8c8c8',
  hoverBg: 'rgba(0,0,0,0.04)',
  accentMuted: 'rgba(10, 102, 194, 0.1)',
}

const communityUiDark: CommunityUiTokens = {
  brand: '#8ec5f7',
  brandHover: '#b3d9fb',
  brandLight: brandColors.primaryLight,
  pageBg: sheconomyDark.sheconomy1,
  cardBg: sheconomyDark.sheconomy3,
  border: sheconomyDark.sheconomy6,
  borderLight: sheconomyDark.sheconomy5,
  text: sheconomyDark.sheconomy12,
  textMuted: '#d9b8c8',
  textSubtle: '#c4a3b3',
  divider: 'rgba(255,255,255,0.1)',
  bannerGradient: `linear-gradient(180deg, ${sheconomyDark.sheconomy3} 0%, ${brandColors.primaryDark} 100%)`,
  cardRadius: 18,
  cardShadow: '0 8px 28px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.07)',
  reactionBarShadow: '0 14px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.1)',
  inputBg: sheconomyDark.sheconomy4,
  inputBorder: sheconomyDark.sheconomy7,
  hoverBg: sheconomyDark.sheconomy5,
  accentMuted: 'rgba(142, 197, 247, 0.14)',
}

export function getCommunityUi(scheme: 'light' | 'dark'): CommunityUiTokens {
  return scheme === 'dark' ? communityUiDark : communityUiLight
}

export function useCommunityUi(): CommunityUiTokens {
  const themeName = useThemeName()
  return getCommunityUi(themeName === 'dark' ? 'dark' : 'light')
}

/** @deprecated Use `useCommunityUi()` for theme-aware tokens. */
export const COMMUNITY_UI = communityUiLight
