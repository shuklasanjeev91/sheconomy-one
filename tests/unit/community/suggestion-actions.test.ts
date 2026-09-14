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

/**
 * Sidebar rows render Connect / Follow / Join from the suggestion itself, so each
 * kind has to carry the identifiers those controls need.
 */
describe('suggestion action payloads', () => {
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
    fetchListingFeedPageMock.mockResolvedValue({ items: [], error: null })
    fetchShopsPageMock.mockResolvedValue({ items: [], error: null })
    fetchCompaniesMock.mockResolvedValue({ items: [] })
    fetchGroupsMock.mockResolvedValue({ items: [] })
    searchJobsMock.mockResolvedValue({ items: [] })
    fetchUpcomingEventsMock.mockResolvedValue({ items: [], error: null })
  })

  it('keeps the member id on person suggestions so Connect targets the right profile', async () => {
    const result = await fetchCommunitySuggestions(
      {
        userId: 'me',
        geo: {},
        networkSuggestions: [
          {
            user_id: 'user-9',
            full_name: 'Asha Rao',
            username: 'asharao',
            headline: 'Founder',
            avatar_url: null,
            location: 'Pune, India',
            industry: 'Retail',
            mutual_count: 2,
            is_verified: true,
            is_sender: false,
          } as never,
        ],
      },
      { perKindLimit: 4 },
    )

    expect(result.byKind.person.map((item) => item.id)).toEqual(['user-9'])
  })

  it('carries group type so private groups request access instead of joining directly', async () => {
    fetchGroupsMock.mockResolvedValue({
      items: [
        {
          id: 'group-public',
          title: 'Women in Retail',
          description: 'Open community',
          group_type: 'public',
          members_count: 120,
          location: 'Mumbai, India',
          industries: ['Retail'],
          avatar_url: null,
        },
        {
          id: 'group-private',
          title: 'Founders Circle',
          description: 'Invite only',
          group_type: 'private',
          members_count: 40,
          location: 'Mumbai, India',
          industries: ['Retail'],
          avatar_url: null,
        },
      ],
    })

    const result = await fetchCommunitySuggestions({ userId: 'me', geo: {} }, { perKindLimit: 4 })

    const byId = new Map(result.byKind.group.map((item) => [item.id, item.groupMeta?.groupType]))
    expect(byId.get('group-public')).toBe('public')
    expect(byId.get('group-private')).toBe('private')
  })

  it('keeps the page id on company suggestions so Follow targets the right page', async () => {
    fetchCompaniesMock.mockResolvedValue({
      items: [
        {
          id: 'company-3',
          name: 'Realm Perfumes',
          tagline: 'Smell premium',
          industry: 'Beauty',
          location: 'Mumbai, India',
          headquarters: 'Mumbai, India',
          community_members: 80,
          logo_url: null,
        },
      ],
    })

    const result = await fetchCommunitySuggestions({ userId: 'me', geo: {} }, { perKindLimit: 4 })

    expect(result.byKind.company.map((item) => item.id)).toEqual(['company-3'])
  })

  it('drops pages the viewer already follows or manages', async () => {
    fetchCompaniesMock.mockResolvedValue({
      items: [
        { id: 'company-followed', name: 'Followed Co', industry: 'Beauty', community_members: 10 },
        { id: 'company-managed', name: 'My Own Page', industry: 'Beauty', community_members: 10 },
        { id: 'company-new', name: 'Fresh Co', industry: 'Beauty', community_members: 10 },
      ],
    })

    const result = await fetchCommunitySuggestions(
      {
        userId: 'me',
        geo: {},
        excludeCompanyIds: new Set(['company-followed', 'company-managed']),
      },
      { perKindLimit: 4 },
    )

    expect(result.byKind.company.map((item) => item.id)).toEqual(['company-new'])
  })

  it('drops groups the viewer already joined or has requested', async () => {
    fetchGroupsMock.mockResolvedValue({
      items: [
        { id: 'group-joined', title: 'Joined', group_type: 'public', members_count: 5 },
        { id: 'group-requested', title: 'Requested', group_type: 'private', members_count: 5 },
        { id: 'group-new', title: 'Fresh', group_type: 'public', members_count: 5 },
      ],
    })

    const result = await fetchCommunitySuggestions(
      {
        userId: 'me',
        geo: {},
        excludeGroupIds: new Set(['group-joined', 'group-requested']),
      },
      { perKindLimit: 4 },
    )

    expect(result.byKind.group.map((item) => item.id)).toEqual(['group-new'])
  })
})
