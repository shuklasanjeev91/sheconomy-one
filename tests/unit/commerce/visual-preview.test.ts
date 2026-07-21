import { describe, expect, it } from 'vitest'

import {
  isVisualPreviewEnabled,
  resolveVisualPreviewMode,
  visualPreviewPrompt,
} from '~/lib/listing/visual-preview'

describe('resolveVisualPreviewMode', () => {
  it('returns try_on for apparel categories', () => {
    expect(
      resolveVisualPreviewMode({ category: 'Fashion / Clothing / Dresses', hasPrimaryImage: true }),
    ).toBe('try_on')
    expect(resolveVisualPreviewMode({ category: 'Ethnic wear - Kurti', hasPrimaryImage: true })).toBe(
      'try_on',
    )
  })

  it('returns view_in_space for electronics and home', () => {
    expect(
      resolveVisualPreviewMode({ category: 'Electronics / Television', hasPrimaryImage: true }),
    ).toBe('view_in_space')
    expect(
      resolveVisualPreviewMode({ category: 'Home & Living / Furniture', hasPrimaryImage: true }),
    ).toBe('view_in_space')
    expect(resolveVisualPreviewMode({ tags: ['wall art', 'poster'], hasPrimaryImage: true })).toBe(
      'view_in_space',
    )
  })

  it('honors listing_metadata override', () => {
    expect(
      resolveVisualPreviewMode({
        category: 'Books',
        listing_metadata: { visual_preview: 'try_on' },
        hasPrimaryImage: true,
      }),
    ).toBe('try_on')
    expect(
      resolveVisualPreviewMode({
        category: 'Fashion',
        listing_metadata: { visual_preview: 'view_in_space' },
        hasPrimaryImage: true,
      }),
    ).toBe('view_in_space')
  })

  it('hides when no image or no matching category', () => {
    expect(resolveVisualPreviewMode({ category: 'Fashion', hasPrimaryImage: false })).toBeNull()
    expect(resolveVisualPreviewMode({ category: 'Books & Magazines', hasPrimaryImage: true })).toBeNull()
  })
  it('matches suit / unstitched apparel titles via keywords', () => {
    expect(
      resolveVisualPreviewMode({
        category: 'Beauty & Wellness > Fashion > Fashion Consultation',
        hasPrimaryImage: true,
      }),
    ).toBe('try_on')
    expect(
      resolveVisualPreviewMode({
        category: 'Home',
        tags: ['unstitched suit material'],
        hasPrimaryImage: true,
      }),
    ).toBe('try_on')
  })
})

describe('visualPreviewPrompt', () => {
  it('includes placement guidance for view_in_space', () => {
    expect(visualPreviewPrompt('view_in_space', 'wall')).toMatch(/wall/i)
    expect(visualPreviewPrompt('view_in_space', 'floor')).toMatch(/floor/i)
    expect(visualPreviewPrompt('try_on')).toMatch(/wearing/i)
  })
})

describe('isVisualPreviewEnabled', () => {
  it('defaults to enabled', () => {
    expect(isVisualPreviewEnabled()).toBe(true)
  })
})
