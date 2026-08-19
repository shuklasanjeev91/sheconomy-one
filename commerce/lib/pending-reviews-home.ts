import { fetchPostPurchaseHomeNudges } from '~/commerce/lib/post-purchase-home'
import type { PostPurchaseNudgeItem } from '~/commerce/lib/post-purchase-nudges'
import { commerceRoutes } from '~/lib/routes'

export type PendingReviewHomeCard = {
  itemId: string
  listingId: string
  title: string
  imageUrl: string | null
  detail: string
  href: string
}

export function buildPendingReviewHomeCards(
  items: PostPurchaseNudgeItem[],
  limit = 5,
): PendingReviewHomeCard[] {
  return items
    .filter((item) => item.source === 'review')
    .slice(0, limit)
    .map((item) => ({
      itemId: item.itemId,
      listingId: item.listingId,
      title: item.title,
      imageUrl: item.imageUrl,
      detail: item.detail,
      href: commerceRoutes.listing(item.listingSlug ?? item.listingId),
    }))
}

export async function fetchPendingReviewHomeCards(
  userId: string,
  limit = 5,
): Promise<{ cards: PendingReviewHomeCard[]; error: string | null }> {
  const result = await fetchPostPurchaseHomeNudges(userId, limit * 3)
  return {
    cards: buildPendingReviewHomeCards(result.items, limit),
    error: result.error,
  }
}
