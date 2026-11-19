import { describe, expect, it } from 'vitest'

import { topReactionTypes } from '~/community/lib/constants'

describe('topReactionTypes', () => {
  it('returns only reaction types that have counts, highest first', () => {
    const icons = topReactionTypes({ like: 2, celebrate: 5, love: 0, funny: 1 }, 3)
    expect(icons.map((row) => row.type)).toEqual(['celebrate', 'like', 'funny'])
  })

  it('returns an empty list when there are no reactions', () => {
    expect(topReactionTypes({}, 3)).toEqual([])
    expect(topReactionTypes(null, 3)).toEqual([])
  })
})
