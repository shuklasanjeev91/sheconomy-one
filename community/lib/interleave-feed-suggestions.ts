import type { CommunityPost } from '~/community/lib/community'
import type { SuggestionSection } from '~/community/hooks/useCommunitySuggestions'
import type { SponsoredFeedItem } from '~/community/lib/sponsored-ads'

export type FeedEntry =
  | { type: 'post'; post: CommunityPost }
  | { type: 'suggestion'; section: SuggestionSection; slot: number }
  | { type: 'sponsored'; item: SponsoredFeedItem; slot: number }

/** Insert one suggestion section every `interval` posts. */
export function interleaveFeedWithSuggestions(
  posts: CommunityPost[],
  sections: SuggestionSection[],
  interval = 3,
): FeedEntry[] {
  if (!posts.length) return []
  if (!sections.length) return posts.map((post) => ({ type: 'post', post }))

  const entries: FeedEntry[] = []
  let sectionIndex = 0

  posts.forEach((post, index) => {
    entries.push({ type: 'post', post })

    const postNumber = index + 1
    if (postNumber % interval === 0) {
      entries.push({
        type: 'suggestion',
        section: sections[sectionIndex % sections.length],
        slot: sectionIndex,
      })
      sectionIndex += 1
    }
  })

  return entries
}

/**
 * Mix organic content, recommendations, and paid reach without changing the
 * organic post query or its pagination. Sponsored slots are intentionally
 * sparser than recommendation slots and never occupy the first feed position.
 */
export function interleaveCommunityFeed(
  posts: CommunityPost[],
  sections: SuggestionSection[],
  sponsored: SponsoredFeedItem[],
  options: { suggestionInterval?: number; sponsoredInterval?: number } = {},
): FeedEntry[] {
  const suggestionInterval = Math.max(1, options.suggestionInterval ?? 3)
  const sponsoredInterval = Math.max(4, options.sponsoredInterval ?? 6)
  if (!posts.length) return []

  const entries: FeedEntry[] = []
  let suggestionIndex = 0
  let sponsoredIndex = 0

  posts.forEach((post, index) => {
    entries.push({ type: 'post', post })
    const postNumber = index + 1

    if (sponsored.length && postNumber % sponsoredInterval === 0) {
      const item = sponsored[sponsoredIndex % sponsored.length]
      // Never show the same post organically and as an ad in the same page.
      if (!posts.some((candidate) => candidate.id === item.post.id)) {
        entries.push({ type: 'sponsored', item, slot: sponsoredIndex })
      }
      sponsoredIndex += 1
      return
    }

    if (sections.length && postNumber % suggestionInterval === 0) {
      entries.push({
        type: 'suggestion',
        section: sections[suggestionIndex % sections.length],
        slot: suggestionIndex,
      })
      suggestionIndex += 1
    }
  })

  return entries
}
