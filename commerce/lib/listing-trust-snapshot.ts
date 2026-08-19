import type { ListingFulfillmentInfo } from '~/commerce/lib/listing-fulfillment'
import type { ListingReturnPolicy } from '~/commerce/lib/return-policies'
import { hasVisibleReviews, type PublicReview, type ReviewSummary } from '~/commerce/lib/reviews'
import { formatRating } from '~/lib/format'

export type ListingTrustCue = {
  key: 'verified_shop' | 'ratings' | 'returns' | 'delivery' | 'digital' | 'followers_only'
  label: string
  description: string
}

export type ListingVerifiedBuyerHighlight = {
  title: string
  body: string
}

export type ListingTrustSnapshot = {
  headline: string
  subheadline: string
  cues: ListingTrustCue[]
  buyerHighlight: ListingVerifiedBuyerHighlight | null
  sellerPrompt: string | null
}

function pluralizeBuyers(totalReviews: number) {
  return `${totalReviews.toLocaleString()} ${totalReviews === 1 ? 'buyer' : 'buyers'}`
}

function reviewCue(summary: ReviewSummary): ListingTrustCue | null {
  if (!hasVisibleReviews(summary)) return null
  return {
    key: 'ratings',
    label: `${formatRating(summary.averageRating)} from ${pluralizeBuyers(summary.totalReviews)}`,
    description: 'Verified purchase reviews help other shoppers decide with confidence.',
  }
}

function returnCue(policy: ListingReturnPolicy | null, isDigital: boolean): ListingTrustCue {
  if (policy?.acceptsReturns) {
    return {
      key: 'returns',
      label: policy.returnWindowDays
        ? `${policy.returnWindowDays}-day returns`
        : 'Returns accepted',
      description: policy.acceptsRefunds
        ? 'The shop reviews return requests before any refund is processed.'
        : 'Return requests are reviewed by the shop before the next step is confirmed.',
    }
  }

  if (isDigital) {
    return {
      key: 'digital',
      label: 'Digital delivery',
      description: 'Instant-access items usually do not need shipping or returns handling.',
    }
  }

  return {
    key: 'returns',
    label: 'Return policy applies',
    description: 'Check the policy details before purchase so expectations stay clear.',
  }
}

function deliveryCue(fulfillment: ListingFulfillmentInfo | null): ListingTrustCue | null {
  if (!fulfillment) return null
  if (fulfillment.kind === 'physical') {
    return {
      key: 'delivery',
      label: fulfillment.estimatedDeliveryLabel,
      description: fulfillment.shippingCostLabel,
    }
  }

  return {
    key: 'digital',
    label: fulfillment.deliveryLabel,
    description: fulfillment.fileTypeLabel ?? 'Download details show after purchase.',
  }
}

function followerCue(followersOnly: boolean, purchaseLocked: boolean): ListingTrustCue | null {
  if (!followersOnly) return null
  return {
    key: 'followers_only',
    label: purchaseLocked ? 'Followers-only perk' : 'Unlocked for followers',
    description: purchaseLocked
      ? 'Follow this shop to unlock Add to cart and Buy now.'
      : 'You already follow this shop, so this gated item is available to you.',
  }
}

function buildBuyerHighlight(summary: ReviewSummary, reviews: PublicReview[]): ListingVerifiedBuyerHighlight | null {
  if (!hasVisibleReviews(summary)) return null
  const review = reviews.find((item) => item.isVerifiedPurchase && item.reviewText.trim().length >= 24) ?? reviews[0]
  if (!review) {
    return {
      title: 'Verified buyer signal',
      body: `${formatRating(summary.averageRating)} average rating from ${pluralizeBuyers(summary.totalReviews)}.`,
    }
  }

  const snippet = review.reviewText.trim().replace(/\s+/g, ' ').slice(0, 140)
  return {
    title: `Verified buyer highlight${review.title ? `: ${review.title}` : ''}`,
    body: `${snippet}${review.reviewText.trim().length > 140 ? '…' : ''}`,
  }
}

export function buildListingTrustSnapshot(input: {
  reviewSummary: ReviewSummary
  reviews: PublicReview[]
  returnPolicy: ListingReturnPolicy | null
  fulfillment: ListingFulfillmentInfo | null
  shopVerified: boolean
  followersOnly: boolean
  purchaseLocked: boolean
  isDigital: boolean
}): ListingTrustSnapshot {
  const cues: ListingTrustCue[] = []

  if (input.shopVerified) {
    cues.push({
      key: 'verified_shop',
      label: 'Verified shop',
      description: 'This seller passed marketplace verification and is eligible for buyer-facing trust features.',
    })
  }

  const reviewTrustCue = reviewCue(input.reviewSummary)
  if (reviewTrustCue) cues.push(reviewTrustCue)

  const deliveryTrustCue = deliveryCue(input.fulfillment)
  if (deliveryTrustCue) cues.push(deliveryTrustCue)

  cues.push(returnCue(input.returnPolicy, input.isDigital))

  const followTrustCue = followerCue(input.followersOnly, input.purchaseLocked)
  if (followTrustCue) cues.push(followTrustCue)

  return {
    headline: 'Why shoppers trust this',
    subheadline: 'Quick signals that reduce risk before you buy.',
    cues,
    buyerHighlight: buildBuyerHighlight(input.reviewSummary, input.reviews),
    sellerPrompt: input.purchaseLocked
      ? 'Follow this shop to unlock this listing and stay close to future drops.'
      : 'Follow the shop or review its policies if you want extra confidence before buying.',
  }
}
