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
  pageBg: '#f3f2ef',
  cardBg: '#ffffff',
  border: '#e0e0e0',
  borderLight: '#ebebeb',
  text: 'rgba(0,0,0,0.9)',
  textMuted: 'rgba(0,0,0,0.6)',
  textSubtle: 'rgba(0,0,0,0.45)',
  divider: 'rgba(0,0,0,0.08)',
  bannerGradient: 'linear-gradient(180deg, #004182 0%, #0a66c2 100%)',
  cardRadius: 12,
  cardShadow: '0 0 0 1px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.05)',
  reactionBarShadow: '0 8px 28px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.05)',
  inputBg: '#ffffff',
  inputBorder: '#c8c8c8',
  hoverBg: 'rgba(0,0,0,0.04)',
  accentMuted: 'rgba(10, 102, 194, 0.1)',
}

const communityUiDark: CommunityUiTokens = {
  brand: '#70b5f9',
  brandHover: '#9ccbfb',
  brandLight: brandColors.primaryLight,
  pageBg: sheconomyDark.sheconomy1,
  cardBg: sheconomyDark.sheconomy2,
  border: sheconomyDark.sheconomy5,
  borderLight: sheconomyDark.sheconomy4,
  text: sheconomyDark.sheconomy12,
  textMuted: sheconomyDark.sheconomy11,
  textSubtle: sheconomyDark.sheconomy9,
  divider: 'rgba(255,255,255,0.08)',
  bannerGradient: `linear-gradient(180deg, ${sheconomyDark.sheconomy3} 0%, ${brandColors.primaryDark} 100%)`,
  cardRadius: 12,
  cardShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 8px 28px rgba(0,0,0,0.38)',
  reactionBarShadow: '0 12px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
  inputBg: sheconomyDark.sheconomy3,
  inputBorder: sheconomyDark.sheconomy6,
  hoverBg: sheconomyDark.sheconomy4,
  accentMuted: 'rgba(208, 16, 96, 0.16)',
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
