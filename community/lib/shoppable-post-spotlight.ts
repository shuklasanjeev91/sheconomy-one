import type { CommunityPost } from '~/community/lib/community'
import { fetchCommunityFeedPage } from '~/community/lib/community'
import { communityRoutes } from '~/lib/routes'

export type ShoppableSpotlightCard = {
  postId: string
  authorName: string
  authorHandle: string | null
  authorAvatar: string | null
  productCount: number
  previewTitle: string | null
  previewImageUrl: string | null
  href: string
}

/** Map feed posts with products into compact spotlight cards. */
export function buildShoppableSpotlightCards(
  posts: CommunityPost[],
  limit = 8,
): ShoppableSpotlightCard[] {
  const cards: ShoppableSpotlightCard[] = []

  for (const post of posts) {
    const products = post.products ?? []
    if (!products.length) continue
    const preview = products[0]
    cards.push({
      postId: post.id,
      authorName: post.author?.full_name || post.author?.username || 'Member',
      authorHandle: post.author?.username ?? null,
      authorAvatar: post.author?.avatar_url ?? null,
      productCount: products.length,
      previewTitle: preview?.title ?? null,
      previewImageUrl: preview?.imageUrl ?? post.image_url ?? post.image_urls?.[0] ?? null,
      href: String(communityRoutes.post(post.id)),
    })
    if (cards.length >= limit) break
  }

  return cards
}

/** Fetch recent shoppable posts for the community spotlight rail. */
export async function fetchShoppableSpotlightCards(limit = 8): Promise<ShoppableSpotlightCard[]> {
  const result = await fetchCommunityFeedPage(0, Math.max(limit * 3, 12), 'recent', 'shoppable')
  if (result.error) return []
  return buildShoppableSpotlightCards(result.items, limit)
}
