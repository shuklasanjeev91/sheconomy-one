import { useThemeName } from 'tamagui'

import { brandColors } from '~/config/brand-colors'

/**
 * Chat surface tokens, adapted to the SHEconomy brand.
 * Cross-platform (web + iOS + Android) — resolved from the active Tamagui theme.
 */
export type ChatUiTokens = {
  /** App background behind the panes. */
  pageBg: string
  /** Conversation list surface. */
  listBg: string
  listItemHover: string
  listItemActive: string
  /** Thread wallpaper behind message bubbles. */
  threadBg: string
  threadPattern: string
  /** Header/composer chrome. */
  headerBg: string
  composerBg: string
  inputBg: string
  divider: string
  border: string
  /** Bubbles. */
  bubbleIn: string
  bubbleInText: string
  bubbleOut: string
  bubbleOutText: string
  bubbleMetaIn: string
  bubbleMetaOut: string
  /** Text. */
  text: string
  textSecondary: string
  textMuted: string
  /** Accents. */
  brand: string
  brandContrast: string
  onlineDot: string
  unreadBadge: string
  unreadBadgeText: string
  /** Read receipt ticks. */
  tick: string
  tickRead: string
  /** Date + system pills. */
  systemPillBg: string
  systemPillText: string
  dangerText: string
  /** Quoted reply block inside a bubble / composer. */
  quoteBg: string
  quoteBar: string
  quoteText: string
  /** Reaction pills. */
  reactionBg: string
  reactionMineBg: string
  reactionMineBorder: string
  reactionText: string
}

const light: ChatUiTokens = {
  pageBg: '#f0e6ec',
  listBg: '#ffffff',
  listItemHover: '#f7f0f4',
  listItemActive: '#fbe9f2',
  threadBg: '#efe4ea',
  threadPattern: 'rgba(208, 16, 96, 0.03)',
  headerBg: '#ffffff',
  composerBg: '#f4eef1',
  inputBg: '#ffffff',
  divider: '#ede2e8',
  border: '#e3d5dd',
  bubbleIn: '#ffffff',
  bubbleInText: '#1a0a12',
  bubbleOut: '#fbdcec',
  bubbleOutText: '#3a0a22',
  bubbleMetaIn: '#8f7380',
  bubbleMetaOut: '#a35480',
  text: '#1a0a12',
  textSecondary: '#5c3d4d',
  textMuted: '#8f7380',
  brand: brandColors.primary,
  brandContrast: '#ffffff',
  onlineDot: '#25d366',
  unreadBadge: brandColors.primary,
  unreadBadgeText: '#ffffff',
  tick: '#9b8391',
  tickRead: '#2f9bff',
  systemPillBg: 'rgba(255, 255, 255, 0.92)',
  systemPillText: '#6b4f5c',
  dangerText: '#b91c1c',
  quoteBg: 'rgba(208, 16, 96, 0.08)',
  quoteBar: brandColors.primary,
  quoteText: '#6b4f5c',
  reactionBg: '#ffffff',
  reactionMineBg: '#fbdcec',
  reactionMineBorder: brandColors.primary,
  reactionText: '#3a0a22',
}

const dark: ChatUiTokens = {
  pageBg: '#160b11',
  listBg: '#1d1017',
  listItemHover: '#26151e',
  listItemActive: '#301a26',
  threadBg: '#120a0f',
  threadPattern: 'rgba(255, 255, 255, 0.02)',
  headerBg: '#211219',
  composerBg: '#211219',
  inputBg: '#2b1822',
  divider: '#33202b',
  border: '#3a2531',
  bubbleIn: '#26151e',
  bubbleInText: '#f4e3ec',
  bubbleOut: '#5a1638',
  bubbleOutText: '#ffe6f2',
  bubbleMetaIn: '#b48fa2',
  bubbleMetaOut: '#e2a8c6',
  text: '#f4e3ec',
  textSecondary: '#e0c2d0',
  textMuted: '#b48fa2',
  brand: brandColors.primaryLight,
  brandContrast: '#ffffff',
  onlineDot: '#25d366',
  unreadBadge: brandColors.primaryLight,
  unreadBadgeText: '#1a0a12',
  tick: '#9c7d8c',
  tickRead: '#53b1ff',
  systemPillBg: 'rgba(43, 24, 34, 0.92)',
  systemPillText: '#d9b8c8',
  dangerText: '#fca5a5',
  quoteBg: 'rgba(255, 255, 255, 0.06)',
  quoteBar: brandColors.primaryLight,
  quoteText: '#d9b8c8',
  reactionBg: '#301a26',
  reactionMineBg: '#5a1638',
  reactionMineBorder: brandColors.primaryLight,
  reactionText: '#ffe6f2',
}

export function useChatTheme(): ChatUiTokens {
  const themeName = useThemeName()
  return themeName === 'dark' ? dark : light
}

export function getChatTheme(scheme: 'light' | 'dark'): ChatUiTokens {
  return scheme === 'dark' ? dark : light
}
