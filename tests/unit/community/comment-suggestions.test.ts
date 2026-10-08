import { describe, expect, it } from 'vitest'

import {
  commentSuggestionContextKey,
  localCommentSuggestions,
} from '~/community/lib/comment-suggestions'

describe('comment suggestions', () => {
  it('builds a stable key for equivalent post context objects', () => {
    const first = commentSuggestionContextKey({
      postType: 'product',
      content: 'A handmade bag',
      authorName: 'Asha Sharma',
      productTitle: 'Canvas Tote',
      hasMedia: true,
    })
    const second = commentSuggestionContextKey({
      postType: 'product',
      content: 'A handmade bag',
      authorName: 'Asha Sharma',
      productTitle: 'Canvas Tote',
      hasMedia: true,
    })

    expect(first).toBe(second)
  })

  it('keeps local suggestions available without AI', () => {
    expect(
      localCommentSuggestions({
        postType: 'event',
        eventTitle: 'Founder Circle',
      }),
    ).toEqual(expect.arrayContaining(['Thanks for sharing the details. Looking forward to this!']))
  })
})
