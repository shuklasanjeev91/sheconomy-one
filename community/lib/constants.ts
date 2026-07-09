export const BRAND_BLUE = '#0a66c2'
export const INSTAGRAM_GRADIENT = 'linear-gradient(45deg, #f58529, #dd2a7b, #8134af)'

export const REACTION_TYPES = [
  { type: 'like', label: 'Like', emoji: '👍', color: '#0a66c2' },
  { type: 'celebrate', label: 'Celebrate', emoji: '👏', color: '#44712e' },
  { type: 'love', label: 'Love', emoji: '❤️', color: '#df704d' },
  { type: 'insightful', label: 'Insightful', emoji: '💡', color: '#f5b800' },
  { type: 'funny', label: 'Funny', emoji: '😂', color: '#57c5ce' },
] as const

export type ReactionType = (typeof REACTION_TYPES)[number]['type']
