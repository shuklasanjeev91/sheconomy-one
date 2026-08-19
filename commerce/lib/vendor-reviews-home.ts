import { fetchVendorReviews, type VendorReview } from '~/commerce/lib/vendor-operations'
import { vendorRoutes } from '~/lib/routes'

export type VendorReviewsHomeCard = {
  id: string
  listingTitle: string
  rating: number
  preview: string
  verified: boolean
  href: string
}

export function buildVendorReviewsHomeCards(
  reviews: VendorReview[],
  limit = 5,
): VendorReviewsHomeCard[] {
  return reviews
    .filter((review) => !review.vendorReply?.trim())
    .slice(0, limit)
    .map((review) => ({
      id: review.id,
      listingTitle: review.listingTitle,
      rating: review.rating,
      preview: review.title?.trim() || review.text.trim().slice(0, 120) || 'New review',
      verified: review.verified,
      href: vendorRoutes.reviews,
    }))
}

export async function fetchVendorReviewsHomeCards(
  shopId: string,
  limit = 5,
): Promise<{ cards: VendorReviewsHomeCard[]; error: string | null }> {
  try {
    const reviews = await fetchVendorReviews(shopId)
    return { cards: buildVendorReviewsHomeCards(reviews, limit), error: null }
  } catch (error) {
    return {
      cards: [],
      error: error instanceof Error ? error.message : 'Failed to load reviews',
    }
  }
}

export function vendorReviewsHomeHref() {
  return vendorRoutes.reviews
}
