import { describe, expect, it } from 'vitest'

import { buildListingTrustSnapshot } from '~/commerce/lib/listing-trust-snapshot'
import type { ListingFulfillmentInfo } from '~/commerce/lib/listing-fulfillment'
import type { ListingReturnPolicy } from '~/commerce/lib/return-policies'
import type { PublicReview, ReviewSummary } from '~/commerce/lib/reviews'

function summary(overrides: Partial<ReviewSummary> = {}): ReviewSummary {
  return {
    averageRating: 4.7,
    totalReviews: 120,
    distribution: { 1: 2, 2: 3, 3: 8, 4: 35, 5: 72 },
    ...overrides,
  }
}

function review(overrides: Partial<PublicReview> = {}): PublicReview {
  return {
    id: 'review-1',
    rating: 5,
    title: 'Loved it',
    reviewText: 'The quality was excellent and delivery was exactly as promised for this purchase.',
    createdAt: '2026-08-19T00:00:00.000Z',
    isVerifiedPurchase: true,
    helpfulCount: 4,
    reviewImages: [],
    reviewerName: 'Buyer',
    reviewerAvatarUrl: null,
    ...overrides,
  }
}

function returnPolicy(overrides: Partial<ListingReturnPolicy> = {}): ListingReturnPolicy {
  return {
    policyName: 'Easy returns',
    acceptsReturns: true,
    acceptsExchanges: true,
    acceptsRefunds: true,
    returnWindowDays: 7,
    returnShippingPaidBy: 'buyer',
    conditionDescription: null,
    policyDetails: null,
    ...overrides,
  }
}

function physicalFulfillment(overrides: Partial<ListingFulfillmentInfo> = {}): ListingFulfillmentInfo {
  return {
    kind: 'physical',
    processingLabel: 'Ships in 2 business days',
    estimatedDeliveryLabel: 'Get it by Fri, Aug 23',
    shippingCostLabel: 'Free shipping over ₹499',
    hasDeliveryEstimate: true,
    ...overrides,
  }
}

describe('buildListingTrustSnapshot', () => {
  it('builds a full trust snapshot for a verified physical listing with strong reviews', () => {
    const snapshot = buildListingTrustSnapshot({
      reviewSummary: summary(),
      reviews: [review()],
      returnPolicy: returnPolicy(),
      fulfillment: physicalFulfillment(),
      shopVerified: true,
      followersOnly: false,
      purchaseLocked: false,
      isDigital: false,
    })

    expect(snapshot.cues.map((cue) => cue.key)).toEqual(
      expect.arrayContaining(['verified_shop', 'ratings', 'delivery', 'returns']),
    )
    expect(snapshot.buyerHighlight?.title).toContain('Verified buyer')
    expect(snapshot.buyerHighlight?.body).toContain('quality was excellent')
  })

  it('handles digital listings with no reviews and no return policy', () => {
    const snapshot = buildListingTrustSnapshot({
      reviewSummary: summary({ averageRating: null, totalReviews: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }),
      reviews: [],
      returnPolicy: null,
      fulfillment: {
        kind: 'digital',
        deliveryLabel: 'Instant download after purchase',
        instantDownload: true,
      },
      shopVerified: false,
      followersOnly: false,
      purchaseLocked: false,
      isDigital: true,
    })

    expect(snapshot.cues.some((cue) => cue.key === 'ratings')).toBe(false)
    expect(snapshot.cues.some((cue) => cue.key === 'digital')).toBe(true)
    expect(snapshot.buyerHighlight).toBeNull()
  })

  it('surfaces followers-only purchase locks as a trust cue', () => {
    const snapshot = buildListingTrustSnapshot({
      reviewSummary: summary(),
      reviews: [review()],
      returnPolicy: returnPolicy({ acceptsReturns: false, acceptsRefunds: false }),
      fulfillment: physicalFulfillment(),
      shopVerified: true,
      followersOnly: true,
      purchaseLocked: true,
      isDigital: false,
    })

    const cue = snapshot.cues.find((item) => item.key === 'followers_only')
    expect(cue?.label).toBe('Followers-only perk')
    expect(cue?.description).toContain('Follow this shop')
    expect(snapshot.sellerPrompt).toContain('unlock this listing')
  })
})
