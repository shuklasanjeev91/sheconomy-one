import { describe, expect, it } from 'vitest'

import { normalizePostVisibility, postVisibleTo } from '~/community/lib/post-visibility'

describe('post visibility', () => {
  it('treats missing and unknown values as public', () => {
    expect(normalizePostVisibility(null)).toBe('public')
    expect(normalizePostVisibility('anyone')).toBe('public')
    expect(normalizePostVisibility('connections_only')).toBe('connections')
    expect(normalizePostVisibility('only_me')).toBe('private')
  })

  it('shows a private post only to its author', () => {
    expect(
      postVisibleTo({ visibility: 'private', authorId: 'a', viewerId: 'a' }),
    ).toBe(true)
    expect(
      postVisibleTo({ visibility: 'private', authorId: 'a', viewerId: 'b' }),
    ).toBe(false)
    expect(
      postVisibleTo({ visibility: 'private', authorId: 'a', viewerId: null }),
    ).toBe(false)
  })

  it('shows a connections post to the author and accepted connections', () => {
    const connected = new Set(['a'])
    expect(
      postVisibleTo({
        visibility: 'connections',
        authorId: 'a',
        viewerId: 'b',
        connectedAuthorIds: connected,
      }),
    ).toBe(true)
    expect(
      postVisibleTo({
        visibility: 'connections',
        authorId: 'c',
        viewerId: 'b',
        connectedAuthorIds: connected,
      }),
    ).toBe(false)
  })
})
