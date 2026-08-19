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
  buildPickUpAgainCards,
  buildReadLaterRevisitCards,
  buildSavedCollectionRevisitCards,
  buildSavedNotesRevisitCards,
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

  it('prioritizes commerce-rich saved posts for the feed revisit strip', () => {
    const shopPost = makeEntry(
      makePost({
        id: 'shop-post',
        content: 'Drop',
        products: [
          {
            listingId: 'l1',
            title: 'Serum',
            price: 900,
            currency: 'INR',
            imageUrl: 'https://img/serum.jpg',
            slug: null,
            shopName: 'Glow',
          },
        ],
      }),
      { notes: 'Payday buy' },
    )
    const article = makeEntry(
      makePost({ id: 'article-post', post_type: 'article', article_title: 'Founder notes' }),
    )
    const event = makeEntry(
      makePost({ id: 'event-post', post_type: 'event', event_title: 'Pitch night' }),
    )

    const cards = buildPickUpAgainCards([article, event, shopPost], 4)

    expect(cards.map((card) => card.postId)).toEqual(['shop-post', 'article-post', 'event-post'])
    expect(cards[0]?.lane).toBe('shop_now')
    expect(cards[0]?.title).toBe('Serum')
    expect(cards[0]?.imageUrl).toBe('https://img/serum.jpg')
    expect(cards[0]?.subtitle).toContain('Payday buy')
  })

  it('deduplicates revisit cards when the same post appears in multiple lanes', () => {
    const shopPost = makeEntry(
      makePost({
        id: 'dup-post',
        author_verified: true,
        products: [
          {
            listingId: 'l1',
            title: 'Cream',
            price: 500,
            currency: 'INR',
            imageUrl: null,
            slug: null,
            shopName: 'Glow',
          },
        ],
      }),
    )

    const cards = buildPickUpAgainCards([shopPost, shopPost], 8)

    expect(cards).toHaveLength(1)
    expect(cards[0]?.lane).toBe('shop_now')
  })

  it('buildReadLaterRevisitCards returns only article-style saved posts', () => {
    const article = makeEntry(
      makePost({
        id: 'article-1',
        post_type: 'article',
        article_title: 'How to scale a shop',
        content: 'Long read body',
      }),
    )
    const shopPost = makeEntry(
      makePost({
        id: 'shop-1',
        products: [
          {
            listingId: 'l1',
            title: 'Serum',
            price: 500,
            currency: 'INR',
            imageUrl: null,
            slug: null,
            shopName: 'Glow',
          },
        ],
      }),
    )

    const cards = buildReadLaterRevisitCards([article, shopPost], 4)

    expect(cards).toHaveLength(1)
    expect(cards[0]?.title).toBe('How to scale a shop')
    expect(String(cards[0]?.href)).toContain('article-1')
  })

  it('buildSavedNotesRevisitCards returns only saved posts with personal notes', () => {
    const withNote = makeEntry(
      makePost({ id: 'noted-post', content: 'Campaign idea' }),
      { notes: '  follow up in September  ' },
    )
    const plain = makeEntry(makePost({ id: 'plain-post', content: 'No note' }))

    const cards = buildSavedNotesRevisitCards([plain, withNote], 4)

    expect(cards).toHaveLength(1)
    expect(cards[0]?.postId).toBe('noted-post')
    expect(cards[0]?.note).toBe('follow up in September')
    expect(String(cards[0]?.href)).toContain('noted-post')
  })

  it('buildSavedCollectionRevisitCards groups named collections and skips the default bucket', () => {
    const campaign = makeEntry(
      makePost({ id: 'campaign-1', content: 'Launch teaser' }),
      { collectionName: 'Q4 campaign' },
    )
    const campaignTwo = makeEntry(
      makePost({ id: 'campaign-2', content: 'Launch recap' }),
      { collectionName: 'Q4 campaign', createdAt: '2026-08-18T00:00:00.000Z' },
    )
    const defaultSaved = makeEntry(makePost({ id: 'plain-post', content: 'Plain save' }))

    const cards = buildSavedCollectionRevisitCards([campaign, campaignTwo, defaultSaved], 4)

    expect(cards).toHaveLength(1)
    expect(cards[0]?.collectionName).toBe('Q4 campaign')
    expect(cards[0]?.count).toBe(2)
    expect(cards[0]?.previewTitle).toBe('Launch teaser')
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
