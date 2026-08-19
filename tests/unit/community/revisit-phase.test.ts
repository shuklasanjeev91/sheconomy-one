import { describe, expect, it } from 'vitest'

import { buildJobRevisitCards } from '~/community/lib/job-revisit'
import type { JobListing } from '~/community/lib/jobs'
import { filterNetworkSuggestions, rankNetworkSuggestions } from '~/community/lib/network-suggestions'
import type { NetworkMember } from '~/community/lib/network'
import { orderProfessionalSpotlightCards } from '~/community/lib/professional-spotlight'
import { buildWishlistActivityCards } from '~/community/lib/wishlist-activity'
import { buildJobApplicationRevisitCards } from '~/community/lib/job-applications-revisit'
import { buildGroupsRevisitCards } from '~/community/lib/groups-revisit'
import { mergeBuyerOrderAttentionItems } from '~/commerce/lib/buyer-order-attention'
import { buildBuyerListingInquiryCards } from '~/commerce/lib/buyer-listing-inquiries-home'
import { buildWishlistPriceDropCards } from '~/commerce/lib/wishlist-price-drops-home'
import { buildProgramRevisitCards } from '~/class/lib/programs-revisit'
import type { Program } from '~/class/lib/programs'
import { buildUnreadChatRevisitCards } from '~/chat/lib/unread-chats-revisit'
import type { ChatSummary } from '~/chat/lib/types'
import { buildPendingReviewHomeCards } from '~/commerce/lib/pending-reviews-home'
import type { PostPurchaseNudgeItem } from '~/commerce/lib/post-purchase-nudges'
import { buildVendorSaleEventHomeCards } from '~/commerce/lib/vendor-sale-events-home'
import type { EnrollmentWithEvent, SaleEventForVendor } from '~/lib/sale-event/sale-event.type'
import { buildMeetingInviteRevisitCards } from '~/co-work/lib/meeting-invites-revisit'
import { buildMeetingRevisitCards } from '~/co-work/lib/meeting-revisit'
import type { Meeting } from '~/co-work/lib/types'
import { buildCompaniesRevisitCards } from '~/community/lib/companies-revisit'
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

describe('buildMeetingRevisitCards', () => {
  it('labels invited meetings and sorts by schedule time', () => {
    const meetings: Meeting[] = [
      {
        id: 'm2',
        title: 'Later sync',
        description: null,
        meeting_code: 'BBBBBB',
        host_id: 'host',
        status: 'scheduled',
        scheduled_at: '2026-08-20T12:00:00.000Z',
        started_at: null,
        ended_at: null,
        time_zone: 'UTC',
        max_participants: null,
        room_id: null,
        security_settings: null,
        meeting_options: null,
        created_at: '2026-08-19T12:00:00.000Z',
        is_recurring: false,
        repeat: null,
        invitees: [],
        host: { full_name: 'Host User', username: 'host', avatar_url: null },
      },
      {
        id: 'm1',
        title: 'Standup',
        description: null,
        meeting_code: 'AAAAAA',
        host_id: 'host',
        status: 'scheduled',
        scheduled_at: '2026-08-19T12:00:00.000Z',
        started_at: null,
        ended_at: null,
        time_zone: 'UTC',
        max_participants: null,
        room_id: null,
        security_settings: null,
        meeting_options: null,
        created_at: '2026-08-19T10:00:00.000Z',
        is_recurring: false,
        repeat: null,
        invitees: [],
        host: null,
      },
    ]

    const cards = buildMeetingRevisitCards(meetings, 'guest', 2)
    expect(cards.map((card) => card.meetingId)).toEqual(['m1', 'm2'])
    expect(cards.every((card) => card.badge === 'Invited')).toBe(true)
  })
})

describe('buildGroupsRevisitCards', () => {
  it('sorts joined groups by member count', () => {
    const cards = buildGroupsRevisitCards(
      [
        {
          id: 'small',
          name: 'small',
          title: 'Small group',
          description: null,
          rules: null,
          avatar_url: null,
          cover_url: null,
          group_type: 'public',
          location: null,
          industries: null,
          members_count: 12,
          created_by: null,
          created_at: null,
          allow_invites: null,
          require_post_review: null,
        },
        {
          id: 'large',
          name: 'large',
          title: 'Large group',
          description: null,
          rules: null,
          avatar_url: null,
          cover_url: null,
          group_type: 'private',
          location: 'Mumbai',
          industries: null,
          members_count: 400,
          created_by: null,
          created_at: null,
          allow_invites: null,
          require_post_review: null,
        },
      ],
      2,
    )

    expect(cards.map((card) => card.groupId)).toEqual(['large', 'small'])
    expect(cards[0]?.memberCount).toBe(400)
  })
})

describe('buildBuyerListingInquiryCards', () => {
  it('keeps open and replied inquiries and drops closed rows', () => {
    const cards = buildBuyerListingInquiryCards(
      [
        {
          id: 'open',
          message: 'Is this still available?',
          status: 'open',
          sellerReply: null,
          repliedAt: null,
          createdAt: '2026-08-19T10:00:00.000Z',
          updatedAt: '2026-08-19T10:00:00.000Z',
          listingId: 'listing-1',
          listingTitle: 'Handbag',
          listingSlug: 'handbag',
        },
        {
          id: 'replied',
          message: 'What size?',
          status: 'replied',
          sellerReply: 'Size M is in stock.',
          repliedAt: '2026-08-19T11:00:00.000Z',
          createdAt: '2026-08-19T09:00:00.000Z',
          updatedAt: '2026-08-19T11:00:00.000Z',
          listingId: 'listing-2',
          listingTitle: 'Dress',
          listingSlug: null,
        },
        {
          id: 'closed',
          message: 'Old question',
          status: 'closed',
          sellerReply: null,
          repliedAt: null,
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-02T10:00:00.000Z',
          listingId: 'listing-3',
          listingTitle: 'Shoes',
          listingSlug: null,
        },
      ],
      5,
    )

    expect(cards.map((card) => card.inquiryId)).toEqual(['open', 'replied'])
    expect(cards[1]?.badge).toBe('Seller replied')
    expect(cards[1]?.preview).toBe('Size M is in stock.')
  })
})

describe('buildCompaniesRevisitCards', () => {
  it('sorts managed companies by follower count', () => {
    const cards = buildCompaniesRevisitCards(
      [
        {
          id: 'small',
          name: 'Small Co',
          page_slug: 'small-co',
          tagline: null,
          industry: 'Retail',
          location: null,
          headquarters: null,
          website: null,
          logo_url: null,
          cover_url: null,
          size: '1-10',
          type: 'private',
          page_category: 'business',
          founded_year: null,
          community_members: 20,
          created_by: 'user',
          created_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'large',
          name: 'Large Co',
          page_slug: 'large-co',
          tagline: 'We build things',
          industry: 'Tech',
          location: 'Bengaluru',
          headquarters: null,
          website: null,
          logo_url: null,
          cover_url: null,
          size: '100+',
          type: 'public',
          page_category: 'business',
          founded_year: 2010,
          community_members: 900,
          created_by: 'user',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      2,
    )

    expect(cards.map((card) => card.companyId)).toEqual(['large', 'small'])
    expect(cards[0]?.memberCount).toBe(900)
  })
})

describe('buildMeetingInviteRevisitCards', () => {
  it('shows only pending invites for non-host meetings', () => {
    const meetings: Meeting[] = [
      {
        id: 'hosted',
        title: 'My meeting',
        description: null,
        meeting_code: 'HOSTED',
        host_id: 'guest',
        status: 'scheduled',
        scheduled_at: '2026-08-20T12:00:00.000Z',
        started_at: null,
        ended_at: null,
        time_zone: 'UTC',
        max_participants: null,
        room_id: null,
        security_settings: null,
        meeting_options: null,
        created_at: '2026-08-19T12:00:00.000Z',
        is_recurring: false,
        repeat: null,
        invitees: [],
        host: null,
      },
      {
        id: 'invited',
        title: 'Team sync',
        description: null,
        meeting_code: 'INVITE',
        host_id: 'host',
        status: 'scheduled',
        scheduled_at: '2026-08-19T14:00:00.000Z',
        started_at: null,
        ended_at: null,
        time_zone: 'UTC',
        max_participants: null,
        room_id: null,
        security_settings: null,
        meeting_options: null,
        created_at: '2026-08-19T10:00:00.000Z',
        is_recurring: false,
        repeat: null,
        invitees: [{ id: 'guest', type: 'user', name: 'Guest', status: 'sent' }],
        host: { full_name: 'Host User', username: 'host', avatar_url: null },
      },
    ]

    const cards = buildMeetingInviteRevisitCards(meetings, 'guest', 'guest@example.com', 3)
    expect(cards.map((card) => card.meetingId)).toEqual(['invited'])
    expect(cards[0]?.hostName).toBe('Host User')
  })
})

describe('buildProgramRevisitCards', () => {
  it('maps enrolled programs to class routes', () => {
    const programs: Program[] = [
      {
        id: 'program-1',
        title: 'Mindful leadership',
        description: 'A short course',
        category: 'Leadership',
        duration: '45 min',
        image_url: null,
        video_url: null,
        audio_url: null,
        media_type: 'video',
        language: 'English',
        view_count: 10,
        like_count: 2,
        listen_count: 0,
        featured: false,
        published_at: '2026-01-01T00:00:00.000Z',
        seo_slug: 'mindful-leadership',
        author_id: null,
        external_author_id: null,
        author: { full_name: 'Coach A', username: 'coach-a', avatar_url: null },
      },
    ]

    const cards = buildProgramRevisitCards(programs, 1)
    expect(cards[0]?.badge).toBe('Video')
    expect(String(cards[0]?.href)).toContain('mindful-leadership')
  })
})

describe('buildPendingReviewHomeCards', () => {
  it('keeps only review nudges from post-purchase items', () => {
    const items: PostPurchaseNudgeItem[] = [
      {
        itemId: 'item-1',
        listingId: 'listing-1',
        listingSlug: 'dress',
        title: 'Dress',
        imageUrl: null,
        quantity: 1,
        listingType: 'physical',
        source: 'review',
        label: 'Review then buy again',
        detail: 'Share feedback while it is fresh.',
      },
      {
        itemId: 'item-2',
        listingId: 'listing-2',
        listingSlug: 'shoes',
        title: 'Shoes',
        imageUrl: null,
        quantity: 1,
        listingType: 'physical',
        source: 'reorder',
        label: 'Ready to reorder',
        detail: 'Buy again quickly.',
      },
    ]

    const cards = buildPendingReviewHomeCards(items, 3)
    expect(cards.map((card) => card.itemId)).toEqual(['item-1'])
    expect(String(cards[0]?.href)).toContain('dress')
  })
})

describe('buildVendorSaleEventHomeCards', () => {
  it('prioritizes pending enrollments and open registration events', () => {
    const enrollments: EnrollmentWithEvent[] = [
      {
        id: 'enroll-1',
        event_id: 'event-1',
        shop_id: 'shop-1',
        enrollment_status: 'accepted',
        enrolled_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
        sale_events: {
          id: 'event-1',
          event_name: 'Monsoon Sale',
          event_slug: 'monsoon-sale',
          description: null,
          start_date: '2026-08-20T00:00:00.000Z',
          end_date: '2026-08-25T00:00:00.000Z',
          banner_image: null,
          status: 'active',
        },
      },
      {
        id: 'enroll-2',
        event_id: 'event-2',
        shop_id: 'shop-1',
        enrollment_status: 'pending',
        enrolled_at: '2026-08-18T00:00:00.000Z',
        updated_at: '2026-08-18T00:00:00.000Z',
        sale_events: {
          id: 'event-2',
          event_name: 'Festive Sale',
          event_slug: 'festive-sale',
          description: null,
          start_date: '2026-08-22T00:00:00.000Z',
          end_date: '2026-08-30T00:00:00.000Z',
          banner_image: null,
          status: 'active',
        },
      },
    ]

    const activeEvents: SaleEventForVendor[] = [
      {
        id: 'event-3',
        event_name: 'New Event',
        event_slug: 'new-event',
        description: null,
        start_date: '2026-08-24T00:00:00.000Z',
        end_date: '2026-08-28T00:00:00.000Z',
        banner_image: null,
        status: 'active',
        registration_start_date: null,
        registration_end_date: null,
      } as SaleEventForVendor,
    ]

    const cards = buildVendorSaleEventHomeCards(enrollments, activeEvents, 3)
    expect(cards.map((card) => card.id)).toEqual(['enroll-2', 'open-event-3', 'enroll-1'])
  })
})

describe('buildUnreadChatRevisitCards', () => {
  it('sorts unread chats by latest message and skips archived rows', () => {
    const chats: ChatSummary[] = [
      {
        id: 'old',
        name: 'Old chat',
        type: 'direct',
        lastMessage: 'Earlier',
        lastMessageType: 'text',
        lastMessageTime: '2026-08-18T10:00:00.000Z',
        lastMessageSenderName: null,
        unreadCount: 2,
        avatarUrl: null,
        otherUserId: 'user-1',
        otherUserName: 'Old chat',
        otherUserAvatar: null,
        isOnline: false,
        lastSeen: null,
        currentUserRole: 'member',
        isPinned: false,
        isMuted: false,
        isArchived: false,
      },
      {
        id: 'new',
        name: 'New chat',
        type: 'direct',
        lastMessage: 'Hey there',
        lastMessageType: 'text',
        lastMessageTime: '2026-08-19T12:00:00.000Z',
        lastMessageSenderName: null,
        unreadCount: 5,
        avatarUrl: null,
        otherUserId: 'user-2',
        otherUserName: 'New chat',
        otherUserAvatar: null,
        isOnline: true,
        lastSeen: null,
        currentUserRole: 'member',
        isPinned: false,
        isMuted: false,
        isArchived: false,
      },
      {
        id: 'archived',
        name: 'Archived',
        type: 'group',
        lastMessage: 'Ignore me',
        lastMessageType: 'text',
        lastMessageTime: '2026-08-19T13:00:00.000Z',
        lastMessageSenderName: null,
        unreadCount: 9,
        avatarUrl: null,
        otherUserId: null,
        otherUserName: null,
        otherUserAvatar: null,
        isOnline: false,
        lastSeen: null,
        currentUserRole: 'member',
        isPinned: false,
        isMuted: false,
        isArchived: true,
      },
    ]

    const cards = buildUnreadChatRevisitCards(chats, 2)
    expect(cards.map((card) => card.chatId)).toEqual(['new', 'old'])
    expect(cards[0]?.unreadCount).toBe(5)
  })
})
