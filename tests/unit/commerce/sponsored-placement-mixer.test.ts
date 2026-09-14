import { describe, expect, it } from 'vitest'

import { mixSponsoredPlacements } from '~/commerce/hooks/useSponsoredCommerce'

type Item = { id: string }

const options = {
  getOrganicId: (item: Item) => item.id,
  getSponsoredId: (item: Item) => item.id,
  after: 3,
  every: 4,
  maxSponsored: 2,
}

describe('mixSponsoredPlacements', () => {
  it('keeps placements sparse and deterministic', () => {
    const organic = Array.from({ length: 12 }, (_, index) => ({ id: `o${index + 1}` }))
    const mixed = mixSponsoredPlacements(organic, [{ id: 'a1' }, { id: 'a2' }], options)

    expect(mixed.map((entry) => `${entry.kind}:${entry.item.id}`)).toEqual([
      'organic:o1',
      'organic:o2',
      'organic:o3',
      'sponsored:a1',
      'organic:o4',
      'organic:o5',
      'organic:o6',
      'organic:o7',
      'sponsored:a2',
      'organic:o8',
      'organic:o9',
      'organic:o10',
      'organic:o11',
      'organic:o12',
    ])
  })

  it('replaces matching organic entities instead of duplicating them', () => {
    const mixed = mixSponsoredPlacements(
      [{ id: 'one' }, { id: 'promoted' }, { id: 'three' }, { id: 'four' }],
      [{ id: 'promoted' }],
      { ...options, after: 2 },
    )

    expect(mixed.filter((entry) => entry.item.id === 'promoted')).toHaveLength(1)
    expect(mixed.find((entry) => entry.item.id === 'promoted')?.kind).toBe('sponsored')
  })

  it('deduplicates sponsored input and respects the cap', () => {
    const organic = Array.from({ length: 20 }, (_, index) => ({ id: `o${index}` }))
    const mixed = mixSponsoredPlacements(
      organic,
      [{ id: 'a' }, { id: 'a' }, { id: 'b' }, { id: 'c' }],
      options,
    )

    expect(mixed.filter((entry) => entry.kind === 'sponsored').map((entry) => entry.item.id))
      .toEqual(['a', 'b'])
  })

  it('never leads a short result set with an ad', () => {
    const mixed = mixSponsoredPlacements(
      [{ id: 'one' }, { id: 'two' }],
      [{ id: 'ad' }],
      options,
    )

    expect(mixed.map((entry) => entry.kind)).toEqual(['organic', 'organic', 'sponsored'])
  })
})
