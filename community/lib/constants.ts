import { brandColors, sheconomyLight } from '~/config/brand-colors'

/** Brand story / marketing gradient (replaces Instagram-style ring). */
export const BRAND_STORY_GRADIENT = `linear-gradient(45deg, ${brandColors.coral}, ${brandColors.primary}, ${brandColors.primaryDark})`

/** @deprecated Use `BRAND_STORY_GRADIENT`. */
export const INSTAGRAM_GRADIENT = BRAND_STORY_GRADIENT

/** @deprecated Prefer `brandColors.primary` or `useCommunityUi().brand`. */
export const BRAND_BLUE = brandColors.primary

export const REACTION_TYPES = [
  { type: 'like', label: 'Like', emoji: '👍', color: brandColors.primary },
  { type: 'celebrate', label: 'Celebrate', emoji: '👏', color: brandColors.coral },
  { type: 'love', label: 'Love', emoji: '❤️', color: brandColors.primaryLight },
  { type: 'insightful', label: 'Insightful', emoji: '💡', color: sheconomyLight.sheconomy8 },
  { type: 'funny', label: 'Funny', emoji: '😂', color: brandColors.primaryDark },
  { type: 'support', label: 'Support', emoji: '🫶', color: brandColors.primary },
  { type: 'empower', label: 'Empower', emoji: '💪', color: brandColors.coral },
  { type: 'together', label: 'Together', emoji: '👭', color: brandColors.primaryLight },
  { type: 'inspire', label: 'Inspire', emoji: '✨', color: sheconomyLight.sheconomy8 },
  { type: 'proud', label: 'Proud', emoji: '🌟', color: brandColors.primaryDark },
] as const

export type ReactionType = (typeof REACTION_TYPES)[number]['type']
