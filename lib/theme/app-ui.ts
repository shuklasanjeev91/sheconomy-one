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
  textMuted: '#6b4f5c',
  background: sheconomyLight.sheconomy2,
  surface: '#ffffff',
  surfaceMuted: '#f8f5f7',
  surfaceHover: sheconomyLight.sheconomy4,
  border: sheconomyLight.sheconomy5,
  borderSubtle: sheconomyLight.sheconomy4,
  chip: sheconomyLight.sheconomy3,
  chipHover: sheconomyLight.sheconomy4,
  icon: '#5c3d4d',
  iconActive: brandColors.primary,
  danger: brandColors.primary,
  error: '#b91c1c',
  notification: brandColors.primary,
  shadowSoft: '0 1px 2px rgba(208, 16, 96, 0.06)',
  shadowCard: '0 4px 24px rgba(208, 16, 96, 0.08)',
  imagePlaceholder: '#f3eef1',
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
  brand: brandColors.primaryLight,
  brandDark: brandColors.primary,
  brandLight: '#f6639e',
  coral: brandColors.coral,
  coralLight: sheconomyDark.sheconomy5,
  roseTint: sheconomyDark.sheconomy4,
  roseSurface: sheconomyDark.sheconomy4,
  text: sheconomyDark.sheconomy12,
  textSecondary: '#f0d4e0',
  textMuted: '#d9b8c8',
  background: sheconomyDark.sheconomy1,
  surface: sheconomyDark.sheconomy3,
  surfaceMuted: sheconomyDark.sheconomy4,
  surfaceHover: sheconomyDark.sheconomy5,
  border: sheconomyDark.sheconomy6,
  borderSubtle: sheconomyDark.sheconomy5,
  chip: sheconomyDark.sheconomy4,
  chipHover: sheconomyDark.sheconomy5,
  icon: '#e8c4d4',
  iconActive: brandColors.primaryLight,
  danger: '#ff6b9d',
  error: '#fca5a5',
  notification: brandColors.primaryLight,
  shadowSoft: '0 2px 8px rgba(0, 0, 0, 0.45)',
  shadowCard: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06)',
  imagePlaceholder: sheconomyDark.sheconomy4,
  panelBg: sheconomyDark.sheconomy3,
  panelBorder: sheconomyDark.sheconomy6,
  digitalBg: 'rgba(59, 130, 246, 0.14)',
  digitalText: '#bfdbfe',
  deliveryBg: 'rgba(36, 17, 24, 0.96)',
  deliveryText: sheconomyDark.sheconomy12,
  onBrand: '#ffffff',
  success: '#6ee7a0',
  starFill: '#fcd34d',
  starEmpty: sheconomyDark.sheconomy7,
  link: '#f6639e',
  overlayDot: 'rgba(255, 255, 255, 0.65)',
  overlayDotActive: '#ffffff',
  badgeBrandBg: 'rgba(208, 16, 96, 0.94)',
  badgeBrandText: '#ffffff',
  badgeAccentBg: 'rgba(252, 221, 234, 0.18)',
  badgeAccentText: sheconomyDark.sheconomy12,
  badgeSuccessBg: 'rgba(110, 231, 160, 0.22)',
  badgeSuccessText: '#d1fae5',
  badgeInfoBg: 'rgba(252, 221, 234, 0.14)',
  badgeInfoText: sheconomyDark.sheconomy12,
  badgeNeutralBg: 'rgba(252, 221, 234, 0.12)',
  badgeNeutralText: '#f0d4e0',
  navHover: sheconomyDark.sheconomy5,
  inputBorder: sheconomyDark.sheconomy7,
  inputText: sheconomyDark.sheconomy12,
  inputBackground: sheconomyDark.sheconomy4,
  inputPlaceholder: '#c4a3b3',
  focusRing: 'rgba(246, 99, 158, 0.5)',
  chromeBg: 'rgba(28, 15, 20, 0.94)',
  elevatedSurface: sheconomyDark.sheconomy4,
}

/** @deprecated Use `useAppUi()` for theme-aware tokens. */
export const appUi = appUiLight

export function getAppUi(scheme: 'light' | 'dark'): AppUiTokens {
  return scheme === 'dark' ? appUiDark : appUiLight
}

export { APP_LAYOUT } from '~/lib/layout/constants'
