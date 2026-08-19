import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcMock = vi.fn()
const fetchDiscoverMembersMock = vi.fn()
const fetchListingFeedPageMock = vi.fn()
const fetchShopsPageMock = vi.fn()
const fetchCompaniesMock = vi.fn()
const fetchGroupsMock = vi.fn()
const searchJobsMock = vi.fn()
const fetchUpcomingEventsMock = vi.fn()

vi.mock('~/lib/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

vi.mock('~/community/lib/network', () => ({
  fetchDiscoverMembers: (...args: unknown[]) => fetchDiscoverMembersMock(...args),
}))

vi.mock('~/commerce/lib/commerce', () => ({
  fetchListingFeedPage: (...args: unknown[]) => fetchListingFeedPageMock(...args),
  fetchShopsPage: (...args: unknown[]) => fetchShopsPageMock(...args),
}))

vi.mock('~/community/lib/companies', () => ({
  fetchCompanies: (...args: unknown[]) => fetchCompaniesMock(...args),
}))

vi.mock('~/community/lib/groups', () => ({
  fetchGroups: (...args: unknown[]) => fetchGroupsMock(...args),
}))

vi.mock('~/community/lib/jobs', () => ({
  searchJobs: (...args: unknown[]) => searchJobsMock(...args),
}))

vi.mock('~/community/lib/events', () => ({
  fetchUpcomingEvents: (...args: unknown[]) => fetchUpcomingEventsMock(...args),
}))

import { fetchCommunitySuggestions } from '~/community/lib/community-personalization'

describe('followed shop suggestions', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    fetchDiscoverMembersMock.mockReset()
    fetchListingFeedPageMock.mockReset()
    fetchShopsPageMock.mockReset()
    fetchCompaniesMock.mockReset()
    fetchGroupsMock.mockReset()
    searchJobsMock.mockReset()
    fetchUpcomingEventsMock.mockReset()

    rpcMock.mockResolvedValue({ data: [], error: null })
    fetchDiscoverMembersMock.mockResolvedValue({ items: [], error: null })
    fetchCompaniesMock.mockResolvedValue({ items: [] })
    fetchGroupsMock.mockResolvedValue({ items: [] })
    searchJobsMock.mockResolvedValue({ items: [] })
    fetchUpcomingEventsMock.mockResolvedValue({ items: [], error: null })
  })

  it('splits followed-shop listings into a dedicated lane and excludes followed shops from generic shop suggestions', async () => {
    fetchListingFeedPageMock.mockResolvedValue({
      items: [
        {
          id: 'listing-1',
          title: 'Followed Product',
          card_title: 'Followed Product',
          category: 'Wellness',
          shop_name: 'Followed Shop',
          shop_id: 'shop-1',
          shop_verified: true,
          total_reviews: 14,
          average_rating: 4.8,
          is_featured: false,
          price: 1200,
          currency: 'INR',
          image_urls: [],
          image_url: null,
          images: [],
          slug: 'followed-product',
          shop_address: { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
        },
        {
          id: 'listing-2',
          title: 'Generic Product',
          card_title: 'Generic Product',
          category: 'Beauty',
          shop_name: 'New Shop',
          shop_id: 'shop-2',
          shop_verified: false,
          total_reviews: 3,
          average_rating: 4.1,
          is_featured: true,
          price: 900,
          currency: 'INR',
          image_urls: [],
          image_url: null,
          images: [],
          slug: 'generic-product',
          shop_address: { city: 'Delhi', state: 'Delhi', country: 'India' },
        },
      ],
      error: null,
    })

    fetchShopsPageMock.mockResolvedValue({
      items: [
        {
          id: 'shop-1',
          shop_name: 'Followed Shop',
          slug: 'followed-shop',
          logo_url: null,
          shop_description: 'A followed shop',
          average_rating: 4.7,
          total_reviews: 22,
          verified: true,
        },
        {
          id: 'shop-2',
          shop_name: 'New Shop',
          slug: 'new-shop',
          logo_url: null,
          shop_description: 'A new shop',
          average_rating: 4.1,
          total_reviews: 5,
          verified: false,
        },
      ],
      error: null,
    })

    const result = await fetchCommunitySuggestions(
      {
        userId: 'user-1',
        interests: ['wellness'],
        industry: null,
        occupation: null,
        location: 'Mumbai, India',
        geo: { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
        followedShopIds: new Set(['shop-1']),
      },
      { perKindLimit: 4 },
    )

    expect(result.followedShopListings.map((item) => item.id)).toEqual(['listing-1'])
    expect(result.followedShopListings[0]?.reason).toBe('From a shop you follow')
    expect(result.byKind.listing.map((item) => item.id)).toEqual(['listing-2'])
    expect(result.byKind.shop.map((item) => item.id)).toEqual(['shop-2'])
  })
})
