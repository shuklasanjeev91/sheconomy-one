import type { CommunityPost } from '~/community/lib/community'
import type { SuggestionSection } from '~/community/hooks/useCommunitySuggestions'

export type FeedEntry =
  | { type: 'post'; post: CommunityPost }
  | { type: 'suggestion'; section: SuggestionSection; slot: number }

/** Insert one suggestion section every `interval` posts (LinkedIn-style). */
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
