import { brandColors, sheconomyDark, sheconomyLight } from '~/config/brand-colors'

export type AppUiTokens = {
  brand: string
  brandDark: string
  brandLight: string
  coral: string
  coralLight: string
  roseTint: string
  roseSurface: string
  text: string
  textSecondary: string
  textMuted: string
  background: string
  surface: string
  surfaceMuted: string
  surfaceHover: string
  border: string
  borderSubtle: string
  chip: string
  chipHover: string
  icon: string
  iconActive: string
  danger: string
  error: string
  notification: string
  shadowSoft: string
  shadowCard: string
  imagePlaceholder: string
  panelBg: string
  panelBorder: string
  digitalBg: string
  digitalText: string
  deliveryBg: string
  deliveryText: string
  onBrand: string
  success: string
  starFill: string
  starEmpty: string
  link: string
  overlayDot: string
  overlayDotActive: string
  badgeBrandBg: string
  badgeBrandText: string
  badgeAccentBg: string
  badgeAccentText: string
  badgeSuccessBg: string
  badgeSuccessText: string
  badgeInfoBg: string
  badgeInfoText: string
  badgeNeutralBg: string
  badgeNeutralText: string
  navHover: string
  inputBorder: string
  inputText: string
  inputBackground: string
  inputPlaceholder: string
  focusRing: string
  chromeBg: string
  elevatedSurface: string
}

export const appUiLight: AppUiTokens = {
  brand: brandColors.primary,
  brandDark: brandColors.primaryDark,
  brandLight: brandColors.primaryLight,
  coral: brandColors.coral,
  coralLight: brandColors.coralLight,
  roseTint: brandColors.roseTint,
  roseSurface: brandColors.roseSurface,
  text: '#1a0a12',
  textSecondary: '#5c3d4d',
  textMuted: '#8f7380',
  background: sheconomyLight.sheconomy2,
  surface: '#ffffff',
  surfaceMuted: sheconomyLight.sheconomy3,
  surfaceHover: sheconomyLight.sheconomy4,
  border: sheconomyLight.sheconomy5,
  borderSubtle: sheconomyLight.sheconomy4,
  chip: sheconomyLight.sheconomy3,
  chipHover: sheconomyLight.sheconomy4,
  icon: '#8f7380',
  iconActive: brandColors.primary,
  danger: brandColors.primary,
  error: '#b91c1c',
  notification: brandColors.primary,
  shadowSoft: '0 1px 2px rgba(208, 16, 96, 0.06)',
  shadowCard: '0 4px 24px rgba(208, 16, 96, 0.08)',
  imagePlaceholder: '#f4f4f0',
  panelBg: '#fafaf8',
  panelBorder: '#e1e3df',
  digitalBg: '#eef6ff',
  digitalText: '#1d4ed8',
  deliveryBg: 'rgba(255, 255, 255, 0.95)',
  deliveryText: '#1a0a12',
  onBrand: '#ffffff',
  success: '#258635',
  starFill: '#f59e0b',
  starEmpty: '#d1d5db',
  link: brandColors.primary,
  overlayDot: 'rgba(255, 255, 255, 0.85)',
  overlayDotActive: '#1a0a12',
  badgeBrandBg: 'rgba(208, 16, 96, 0.92)',
  badgeBrandText: '#ffffff',
  badgeAccentBg: 'rgba(17, 24, 39, 0.88)',
  badgeAccentText: '#ffffff',
  badgeSuccessBg: 'rgba(37, 134, 53, 0.92)',
  badgeSuccessText: '#ffffff',
  badgeInfoBg: 'rgba(255, 255, 255, 0.96)',
  badgeInfoText: '#1f2937',
  badgeNeutralBg: 'rgba(255, 255, 255, 0.96)',
  badgeNeutralText: '#374151',
  navHover: '#f4f4f0',
  inputBorder: '#d8cdd2',
  inputText: '#1a0a12',
  inputBackground: '#ffffff',
  inputPlaceholder: '#8f7380',
  focusRing: 'rgba(208, 16, 96, 0.35)',
  chromeBg: 'rgba(255, 255, 255, 0.92)',
  elevatedSurface: '#ffffff',
}

export const appUiDark: AppUiTokens = {
  brand: brandColors.primary,
  brandDark: brandColors.primaryLight,
  brandLight: brandColors.primaryDark,
  coral: brandColors.coral,
  coralLight: sheconomyDark.sheconomy4,
  roseTint: sheconomyDark.sheconomy3,
  roseSurface: sheconomyDark.sheconomy4,
  text: sheconomyDark.sheconomy12,
  textSecondary: sheconomyDark.sheconomy11,
  textMuted: '#c4a3b3',
  background: sheconomyDark.sheconomy1,
  surface: sheconomyDark.sheconomy2,
  surfaceMuted: sheconomyDark.sheconomy3,
  surfaceHover: sheconomyDark.sheconomy4,
  border: sheconomyDark.sheconomy5,
  borderSubtle: sheconomyDark.sheconomy4,
  chip: sheconomyDark.sheconomy3,
  chipHover: sheconomyDark.sheconomy4,
  icon: sheconomyDark.sheconomy11,
  iconActive: brandColors.primaryLight,
  danger: brandColors.primaryLight,
  error: '#f87171',
  notification: brandColors.primary,
  shadowSoft: '0 1px 2px rgba(0, 0, 0, 0.35)',
  shadowCard: '0 4px 24px rgba(0, 0, 0, 0.4)',
  imagePlaceholder: sheconomyDark.sheconomy3,
  panelBg: sheconomyDark.sheconomy2,
  panelBorder: sheconomyDark.sheconomy5,
  digitalBg: sheconomyDark.sheconomy3,
  digitalText: '#93c5fd',
  deliveryBg: 'rgba(36, 17, 24, 0.95)',
  deliveryText: sheconomyDark.sheconomy12,
  onBrand: '#ffffff',
  success: '#4ade80',
  starFill: '#fbbf24',
  starEmpty: sheconomyDark.sheconomy6,
  link: brandColors.primaryLight,
  overlayDot: 'rgba(255, 255, 255, 0.55)',
  overlayDotActive: '#ffffff',
  badgeBrandBg: 'rgba(208, 16, 96, 0.94)',
  badgeBrandText: '#ffffff',
  badgeAccentBg: 'rgba(252, 221, 234, 0.16)',
  badgeAccentText: sheconomyDark.sheconomy12,
  badgeSuccessBg: 'rgba(74, 222, 128, 0.2)',
  badgeSuccessText: '#bbf7d0',
  badgeInfoBg: 'rgba(252, 221, 234, 0.12)',
  badgeInfoText: sheconomyDark.sheconomy12,
  badgeNeutralBg: 'rgba(252, 221, 234, 0.1)',
  badgeNeutralText: sheconomyDark.sheconomy11,
  navHover: sheconomyDark.sheconomy4,
  inputBorder: sheconomyDark.sheconomy6,
  inputText: sheconomyDark.sheconomy12,
  inputBackground: sheconomyDark.sheconomy3,
  inputPlaceholder: sheconomyDark.sheconomy9,
  focusRing: 'rgba(208, 16, 96, 0.45)',
  chromeBg: 'rgba(28, 15, 20, 0.88)',
  elevatedSurface: sheconomyDark.sheconomy2,
}

/** @deprecated Use `useAppUi()` for theme-aware tokens. */
export const appUi = appUiLight

export function getAppUi(scheme: 'light' | 'dark'): AppUiTokens {
  return scheme === 'dark' ? appUiDark : appUiLight
}

export { APP_LAYOUT } from '~/lib/layout/constants'
