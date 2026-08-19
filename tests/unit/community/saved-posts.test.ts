import { beforeEach, describe, expect, it, vi } from 'vitest'

const maybeSingleMock = vi.fn()
const insertMock = vi.fn()
const updateMock = vi.fn()
const deleteMock = vi.fn()
const invalidateCacheMock = vi.fn()

vi.mock('~/lib/cache/invalidation', () => ({
  INVALIDATION_TOPICS: { savedPosts: 'saved-posts' },
  invalidateCache: (...args: unknown[]) => invalidateCacheMock(...args),
}))

vi.mock('~/lib/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => ({
              maybeSingle: (...args: unknown[]) => maybeSingleMock(...args),
            }),
          }),
        }),
      }),
      insert: (...args: unknown[]) => insertMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      delete: (...args: unknown[]) => deleteMock(...args),
    }),
  },
}))

vi.mock('~/community/lib/community', () => ({
  fetchPostById: vi.fn(),
}))

import {
  buildSavedPostSections,
  saveCommunityPost,
  updateSavedCommunityPost,
  type SavedCommunityPostEntry,
} from '~/community/lib/saved-posts'
import type { CommunityPost } from '~/community/lib/community'

function makePost(overrides: Partial<CommunityPost>): CommunityPost {
  return {
    id: overrides.id ?? 'post-1',
    content: overrides.content ?? '',
    image_url: null,
    image_urls: null,
    media_url: null,
    media_urls: null,
    video_url: null,
    video_urls: null,
    created_at: null,
    post_type: null,
    user_id: 'user-1',
    company_id: null,
    group_id: null,
    like_count: 0,
    comment_count: 0,
    engagement_score: 0,
    total_reactions: 0,
    author_verified: false,
    author: null,
    company: null,
    group: null,
    event_title: null,
    event_description: null,
    event_start_time: null,
    event_end_time: null,
    event_location: null,
    event_rsvp_enabled: null,
    community_event_id: null,
    poll: null,
    listing_id: null,
    celebration: null,
    product: null,
    products: null,
    shop: null,
    link: null,
    article_title: null,
    article_tags: null,
    original_post_id: null,
    repost_comment: null,
    originalPost: null,
    is_pinned: false,
    ...overrides,
  }
}

function makeEntry(post: CommunityPost, overrides?: Partial<SavedCommunityPostEntry>): SavedCommunityPostEntry {
  return {
    postId: post.id,
    collectionName: 'Saved',
    notes: null,
    createdAt: '2026-08-19T00:00:00.000Z',
    post,
    ...overrides,
  }
}

describe('saved posts', () => {
  beforeEach(() => {
    maybeSingleMock.mockReset()
    insertMock.mockReset()
    updateMock.mockReset()
    deleteMock.mockReset()
    invalidateCacheMock.mockReset()
  })

  it('organizes saved posts into revisit lanes with product-rich posts first', () => {
    const shopPost = makeEntry(
      makePost({
        id: 'shop-post',
        content: 'A product drop',
        products: [{ listingId: 'listing-1', title: 'Cream', price: 1200, currency: 'INR', imageUrl: null, slug: null, shopName: 'Glow' }],
      }),
      { collectionName: 'Shop inspo', notes: 'Watch for payday' },
    )
    const creatorPick = makeEntry(
      makePost({
        id: 'creator-post',
        content: 'My weekly founder stack',
        author_verified: true,
      }),
    )
    const article = makeEntry(
      makePost({
        id: 'article-post',
        post_type: 'article',
        article_title: 'Funding notes',
      }),
    )
    const event = makeEntry(
      makePost({
        id: 'event-post',
        post_type: 'event',
        event_title: 'Pitch night',
      }),
    )
    const text = makeEntry(makePost({ id: 'text-post', content: 'A plain update' }))

    const sections = buildSavedPostSections([shopPost, creatorPick, article, event, text])

    expect(sections.map((section) => section.key)).toEqual([
      'shop_now',
      'creator_picks',
      'read_later',
      'events',
      'more_saved',
    ])
    expect(sections[0]?.items.map((item) => item.postId)).toEqual(['shop-post'])
    expect(sections[1]?.items.map((item) => item.postId)).toEqual(['creator-post'])
    expect(sections[4]?.items.map((item) => item.postId)).toEqual(['text-post'])
  })

  it('deduplicates saves by updating metadata when the post is already saved', async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: 'saved-1', collection_name: 'Saved', notes: null },
      error: null,
    })
    const eqSecondMock = vi.fn().mockResolvedValue({ error: null })
    const eqFirstMock = vi.fn(() => ({ eq: eqSecondMock }))
    updateMock.mockReturnValue({ eq: eqFirstMock })

    const result = await saveCommunityPost('user-1', 'post-1', {
      collectionName: 'Read later',
      notes: 'Strong opening',
    })

    expect(result.error).toBeNull()
    expect(insertMock).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledWith({
      collection_name: 'Read later',
      notes: 'Strong opening',
    })
    expect(invalidateCacheMock).toHaveBeenCalledWith('saved-posts')
  })

  it('normalizes fallback collections and trims notes when updating saved post details', async () => {
    const eqSecondMock = vi.fn().mockResolvedValue({ error: null })
    const eqFirstMock = vi.fn(() => ({ eq: eqSecondMock }))
    updateMock.mockReturnValue({ eq: eqFirstMock })

    const result = await updateSavedCommunityPost('user-1', 'post-1', {
      collectionName: '   ',
      notes: '  keep for Q4 campaign  ',
    })

    expect(result.error).toBeNull()
    expect(updateMock).toHaveBeenCalledWith({
      collection_name: 'Saved',
      notes: 'keep for Q4 campaign',
    })
  })
})
