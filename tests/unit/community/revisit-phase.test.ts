import { describe, expect, it } from 'vitest'

import { buildJobRevisitCards } from '~/community/lib/job-revisit'
import type { JobListing } from '~/community/lib/jobs'
import { filterNetworkSuggestions, rankNetworkSuggestions } from '~/community/lib/network-suggestions'
import type { NetworkMember } from '~/community/lib/network'
import { orderProfessionalSpotlightCards } from '~/community/lib/professional-spotlight'
import { buildWishlistActivityCards } from '~/community/lib/wishlist-activity'
import { buildJobApplicationRevisitCards } from '~/community/lib/job-applications-revisit'
import { mergeBuyerOrderAttentionItems } from '~/commerce/lib/buyer-order-attention'
import { buildWishlistPriceDropCards } from '~/commerce/lib/wishlist-price-drops-home'
import { selectBuyerReturnHomeCards } from '~/commerce/lib/buyer-return-home'
import { buildBuyerRtoHomeCards } from '~/commerce/lib/buyer-rto-home'
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

describe('rankNetworkSuggestions', () => {
  it('boosts open-to-work members ahead of others', () => {
    const members: NetworkMember[] = [
      {
        user_id: 'plain',
        username: 'plain',
        full_name: 'Plain',
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
        user_id: 'hire',
        username: 'hire',
        full_name: 'Hire',
        headline: 'Designer',
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

    expect(
      rankNetworkSuggestions(members, {
        dismissedIds: [],
        boostUserIds: ['hire'],
        limit: 2,
      }).map((item) => item.user_id),
    ).toEqual(['hire', 'plain'])
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

describe('buildBuyerRtoHomeCards', () => {
  it('includes reverse pickup and forward RTO legs', () => {
    const cards = buildBuyerRtoHomeCards(
      [
        {
          id: 'delivery-return',
          delivery_status: 'in_transit',
          delivery_mode: 'return',
          tracking_number: 'RET123',
          carrier_tracking_url: 'https://track.example/ret',
          updated_at: '2026-08-19T10:00:00.000Z',
          orders: { id: 'order-1', order_number: '1001' },
          order_items: { product_title: 'Dress' },
        },
        {
          id: 'delivery-rto',
          delivery_status: 'returned_to_sender',
          delivery_mode: 'forward',
          tracking_number: 'RTO456',
          carrier_tracking_url: null,
          updated_at: '2026-08-19T09:00:00.000Z',
          orders: { id: 'order-2', order_number: '1002' },
          order_items: { product_title: 'Shoes' },
        },
      ],
      4,
    )

    expect(cards.map((card) => card.kind)).toEqual(['return_shipment', 'rto'])
  })
})

describe('buildJobApplicationRevisitCards', () => {
  it('maps application status labels', () => {
    const cards = buildJobApplicationRevisitCards(
      [
        {
          id: 'app-1',
          status: 'under_review',
          created_at: '2026-08-19T10:00:00.000Z',
          cover_letter: null,
          job: {
            id: 'job-1',
            title: 'Product Designer',
            company_name: 'Acme',
            location: 'Remote',
            job_type: 'full-time',
          },
        },
      ],
      3,
    )

    expect(cards[0]?.statusLabel).toBe('Under review')
    expect(cards[0]?.title).toBe('Product Designer')
  })
})

describe('buildWishlistPriceDropCards', () => {
  it('returns only price win items', () => {
    const cards = buildWishlistPriceDropCards(
      [
        {
          key: 'price_wins',
          title: 'Price drops',
          subtitle: 'Cheaper now',
          items: [
            {
              id: 'listing-1',
              slug: 'listing-1',
              title: 'Serum',
              card_title: 'Serum',
              price: 450,
              currency: 'INR',
              score: 50,
              source: 'discount',
              discountAmount: 100,
              savedFromCartAt: null,
            },
          ] as WishlistReactivationSection['items'],
          actionLabel: 'Move',
          count: 1,
          canBulkMoveToCart: false,
        },
      ],
      2,
    )

    expect(cards).toHaveLength(1)
    expect(cards[0]?.discountAmount).toBe(100)
  })
})

describe('mergeBuyerOrderAttentionItems', () => {
  it('prioritizes exchange needs-action and dedupes by order', () => {
    const items = mergeBuyerOrderAttentionItems(
      [
        {
          orderId: 'order-1',
          orderNumber: '1001',
          issueId: 'issue-1',
          itemTitle: 'Dress',
          actionLabel: 'Add photos if helpful',
          actionDetail: 'Photos help approval',
          category: 'needs_action',
          issueKind: 'exchange',
          returnTrackingUrl: null,
        },
      ],
      [
        {
          orderId: 'order-1',
          orderNumber: '1001',
          deliveryId: 'delivery-1',
          itemTitle: 'Dress',
          kind: 'return_shipment',
          label: 'Return in transit',
          detail: 'AWB in transit',
          trackingNumber: 'AWB1',
          trackingUrl: 'https://track.example',
        },
        {
          orderId: 'order-2',
          orderNumber: '1002',
          deliveryId: 'delivery-2',
          itemTitle: 'Shoes',
          kind: 'rto',
          label: 'Package returning to seller',
          detail: 'RTO started',
          trackingNumber: null,
          trackingUrl: null,
        },
      ],
      4,
    )

    expect(items.map((item) => item.orderId)).toEqual(['order-1', 'order-2'])
    expect(items[0]?.kind).toBe('exchange')
  })
})
