import { describe, expect, it } from 'vitest'

import { buildShoppablePostInsights } from '~/community/lib/shoppable-post-insights'

describe('buildShoppablePostInsights', () => {
  it('aggregates posts with attached products and unique listing ids', () => {
    const insights = buildShoppablePostInsights([
      {
        id: 'post-1',
        created_at: '2026-08-22T10:00:00.000Z',
        post_data: {
          attached_products: [{ listingId: 'l1' }, { listingId: 'l2' }],
        },
      },
      {
        id: 'post-2',
        created_at: '2026-08-21T10:00:00.000Z',
        post_data: {
          attached_products: [{ listingId: 'l2' }],
        },
      },
      {
        id: 'post-3',
        created_at: '2026-08-20T10:00:00.000Z',
        post_data: { text: 'plain post' },
      },
    ])

    expect(insights.postsWithProducts).toBe(2)
    expect(insights.uniqueListingIds.sort()).toEqual(['l1', 'l2'])
    expect(insights.topPosts[0]?.postId).toBe('post-1')
    expect(insights.topPosts[0]?.productCount).toBe(2)
  })

  it('counts legacy product_data attachments', () => {
    const insights = buildShoppablePostInsights([
      {
        id: 'post-legacy',
        created_at: null,
        post_data: { product_data: { listingId: 'legacy-1' } },
      },
    ])

    expect(insights.postsWithProducts).toBe(1)
    expect(insights.uniqueListingIds).toEqual(['legacy-1'])
  })
})
