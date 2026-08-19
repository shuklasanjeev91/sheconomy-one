import { describe, expect, it } from 'vitest'

import { buildJobRevisitCards } from '~/community/lib/job-revisit'
import type { JobListing } from '~/community/lib/jobs'
import { filterNetworkSuggestions } from '~/community/lib/network-suggestions'
import type { NetworkMember } from '~/community/lib/network'
import { orderProfessionalSpotlightCards } from '~/community/lib/professional-spotlight'
import { buildWishlistActivityCards } from '~/community/lib/wishlist-activity'
import { selectBuyerReturnHomeCards } from '~/commerce/lib/buyer-return-home'
import type { WishlistReactivationSection } from '~/commerce/lib/wishlist-reactivation'

describe('filterNetworkSuggestions', () => {
  it('filters dismissed members and limits results', () => {
    const members: NetworkMember[] = [
      {
        user_id: 'a',
        username: 'a',
        full_name: 'A',
        headline: null,
        avatar_url: null,
        location: null,
        industry: null,
        is_verified: false,
        mutual_count: 0,
        connection_id: null,
        connection_status: null,
        is_sender: false,
      },
      {
        user_id: 'b',
        username: 'b',
        full_name: 'B',
        headline: null,
        avatar_url: null,
        location: null,
        industry: null,
        is_verified: false,
        mutual_count: 0,
        connection_id: null,
        connection_status: null,
        is_sender: false,
      },
    ]

    expect(filterNetworkSuggestions(members, ['a'], 1).map((item) => item.user_id)).toEqual(['b'])
  })
})

describe('buildJobRevisitCards', () => {
  it('sorts saved jobs by saved date descending', () => {
    const cards = buildJobRevisitCards(
      [
        {
          id: 'old',
          title: 'Old role',
          company_name: 'Acme',
          company_logo: null,
          description: '',
          location: 'Remote',
          job_type: 'full-time',
          experience_level: 'mid',
          salary_range: null,
          is_remote: true,
          is_active: true,
          is_applied: false,
          is_saved: true,
          application_count: 0,
          benefits: null,
          requirements: null,
          industry: null,
          posted_by: '',
          poster_name: '',
          poster_avatar: '',
          created_at: '2026-08-01T00:00:00.000Z',
          updated_at: '2026-08-10T00:00:00.000Z',
          expires_at: null,
        } as JobListing,
        {
          id: 'new',
          title: 'New role',
          company_name: 'Acme',
          company_logo: null,
          description: '',
          location: 'Remote',
          job_type: 'full-time',
          experience_level: 'mid',
          salary_range: null,
          is_remote: true,
          is_active: true,
          is_applied: true,
          is_saved: true,
          application_count: 0,
          benefits: null,
          requirements: null,
          industry: null,
          posted_by: '',
          poster_name: '',
          poster_avatar: '',
          created_at: '2026-08-01T00:00:00.000Z',
          updated_at: '2026-08-18T00:00:00.000Z',
          expires_at: null,
        } as JobListing,
      ],
      6,
    )

    expect(cards.map((card) => card.jobId)).toEqual(['new', 'old'])
    expect(cards[0]?.badge).toBe('Applied')
  })
})

describe('buildWishlistActivityCards', () => {
  it('prioritizes saved-from-cart items', () => {
    const sections: WishlistReactivationSection[] = [
      {
        key: 'ready_to_buy',
        title: 'Ready',
        subtitle: 'Ready',
        items: [
          {
            id: 'listing-ready',
            slug: 'listing-ready',
            title: 'Ready item',
            card_title: 'Ready item',
            price: 500,
            currency: 'INR',
            score: 40,
            source: 'saved',
            discountAmount: 0,
            savedFromCartAt: null,
          } as WishlistReactivationSection['items'][number],
        ],
        actionLabel: 'Move',
        count: 1,
        canBulkMoveToCart: false,
      },
      {
        key: 'saved_from_cart',
        title: 'Saved from cart',
        subtitle: 'Saved from cart',
        items: [
          {
            id: 'listing-cart',
            slug: 'listing-cart',
            title: 'Cart item',
            card_title: 'Cart item',
            price: 700,
            currency: 'INR',
            score: 90,
            source: 'saved_from_cart',
            discountAmount: 0,
            savedFromCartAt: Date.now(),
          } as WishlistReactivationSection['items'][number],
        ],
        actionLabel: 'Move',
        count: 1,
        canBulkMoveToCart: true,
      },
    ]

    const cards = buildWishlistActivityCards(sections, 2)
    expect(cards[0]?.listingId).toBe('listing-cart')
    expect(cards[0]?.sourceLabel).toBe('Saved from cart')
  })
})

describe('orderProfessionalSpotlightCards', () => {
  it('prioritizes connections over suggestions', () => {
    const cards = orderProfessionalSpotlightCards(
      [
        {
          userId: 'suggest',
          username: 's',
          fullName: 'Suggest',
          headline: null,
          avatarUrl: null,
          intent: 'open_to_work',
          intentLabel: 'Open to work',
          detail: null,
        },
        {
          userId: 'conn',
          username: 'c',
          fullName: 'Conn',
          headline: null,
          avatarUrl: null,
          intent: 'open_to_services',
          intentLabel: 'Services',
          detail: null,
        },
      ],
      ['conn', 'suggest'],
      2,
    )

    expect(cards.map((card) => card.userId)).toEqual(['conn', 'suggest'])
  })
})

describe('selectBuyerReturnHomeCards', () => {
  it('keeps only active return cards', () => {
    const cards = selectBuyerReturnHomeCards(
      [
        {
          orderId: 'order-1',
          orderNumber: '1001',
          issueId: 'issue-1',
          itemTitle: 'Dress',
          actionLabel: 'Track return',
          actionDetail: 'In transit',
          category: 'in_progress',
          returnTrackingUrl: 'https://track.example',
          issueLabel: 'Return',
          statusLabel: 'Open',
          action: 'track_return',
          timeline: [],
          evidenceCount: 0,
          evidenceUrls: [],
          evidenceLabel: null,
          refundLabel: null,
          refundProgress: null,
          returnTrackingNumber: 'AWB1',
          returnCourierSlug: null,
          returnShippingMode: null,
          rejectReason: null,
          resolutionNote: null,
        },
        {
          orderId: 'order-2',
          orderNumber: '1002',
          issueId: 'issue-2',
          itemTitle: 'Shoes',
          actionLabel: 'Refund completed',
          actionDetail: null,
          category: 'resolved',
          returnTrackingUrl: null,
          issueLabel: 'Return',
          statusLabel: 'Resolved',
          action: 'view_refund_progress',
          timeline: [],
          evidenceCount: 0,
          evidenceUrls: [],
          evidenceLabel: null,
          refundLabel: null,
          refundProgress: null,
          returnTrackingNumber: null,
          returnCourierSlug: null,
          returnShippingMode: null,
          rejectReason: null,
          resolutionNote: null,
        },
      ],
      4,
    )

    expect(cards).toHaveLength(1)
    expect(cards[0]?.issueId).toBe('issue-1')
  })
})
