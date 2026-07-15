import type { CommunityUiTokens } from '~/community/lib/community-theme'

export type PostTypeSurface = {
  /** Soft card fill tint for the post type. */
  backgroundColor: string
  /** Left accent rail / border highlight. */
  accentColor: string
  borderColor: string
  /** Short label chip text (optional UI). */
  label: string | null
}

function withAlpha(hexOrRgba: string, alpha: number): string {
  if (hexOrRgba.startsWith('rgba') || hexOrRgba.startsWith('rgb')) {
    return hexOrRgba
  }
  const hex = hexOrRgba.replace('#', '')
  if (hex.length !== 6) return hexOrRgba
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Modern, type-aware card surfaces for the community feed.
 * Keeps brand-linkedin cool neutrals; accents stay purposeful (not purple-default).
 */
export function getPostTypeSurface(
  postType: string | null | undefined,
  ui: CommunityUiTokens,
  scheme: 'light' | 'dark' = 'light',
): PostTypeSurface {
  const type = (postType || 'post').toLowerCase()
  const wash = scheme === 'dark' ? 0.16 : 0.08
  const borderWash = scheme === 'dark' ? 0.28 : 0.18

  const make = (accent: string, label: string | null): PostTypeSurface => ({
    backgroundColor: withAlpha(accent, wash),
    accentColor: accent,
    borderColor: withAlpha(accent, borderWash),
    label,
  })

  switch (type) {
    case 'poll':
      return make('#0a66c2', 'Poll')
    case 'event':
      return make('#0f766e', 'Event')
    case 'celebration':
      return make('#d01060', 'Celebration')
    case 'product':
      return make('#c2410c', 'Product')
    case 'service':
      return make('#15803d', 'Service')
    case 'article':
      return make('#334155', 'Article')
    case 'group_post':
      return make('#b45309', 'Group')
    case 'repost':
      return make('#057642', 'Repost')
    case 'thought':
      return make('#0369a1', 'Thought')
    case 'text':
    case 'post':
    default:
      return {
        backgroundColor: ui.cardBg,
        accentColor: ui.brand,
        borderColor: ui.borderLight,
        label: null,
      }
  }
}

/** Resolve effective type, treating original_post_id as a repost even if type is missing. */
export function resolveFeedPostType(post: {
  post_type?: string | null
  original_post_id?: string | null
}): string {
  if (post.original_post_id) return 'repost'
  return (post.post_type || 'post').toLowerCase()
}
