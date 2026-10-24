import { describe, expect, it } from 'vitest'

import {
  isVisualPreviewEnabled,
  resolveVisualPreviewMode,
  suggestVisualPreviewPlacement,
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

  it('ignores title and tags when the category does not match', () => {
    expect(
      resolveVisualPreviewMode({
        title: 'Floral summer dress for women',
        hasPrimaryImage: true,
      }),
    ).toBeNull()
    expect(
      resolveVisualPreviewMode({ tags: ['wall art', 'poster'], hasPrimaryImage: true }),
    ).toBeNull()
    expect(
      resolveVisualPreviewMode({
        title: 'Handcrafted dining table',
        category: 'Herbal & Ayurvedic Supplements',
        hasPrimaryImage: true,
      }),
    ).toBeNull()
  })

  it('returns view_in_space for electronics and home categories', () => {
    expect(
      resolveVisualPreviewMode({ category: 'Electronics / Television', hasPrimaryImage: true }),
    ).toBe('view_in_space')
    expect(
      resolveVisualPreviewMode({ category: 'Home & Living / Furniture', hasPrimaryImage: true }),
    ).toBe('view_in_space')
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

  it('does not treat tablets as a table for view in your room', () => {
    expect(
      resolveVisualPreviewMode({
        title: 'Bioayurveda Bio Skintone Herbal Tablets',
        category: 'Herbal & Ayurvedic Supplements',
        hasPrimaryImage: true,
      }),
    ).toBeNull()
    expect(
      resolveVisualPreviewMode({
        title: 'Handcrafted dining table',
        category: 'Furniture',
        hasPrimaryImage: true,
      }),
    ).toBe('view_in_space')
    expect(
      resolveVisualPreviewMode({
        title: 'Handcrafted Modern MDF & Glass Wall Clock',
        category: 'Wall Clocks',
        hasPrimaryImage: true,
      }),
    ).toBe('view_in_space')
  })

  it('hides when no image or no matching category', () => {
    expect(resolveVisualPreviewMode({ category: 'Fashion', hasPrimaryImage: false })).toBeNull()
    expect(resolveVisualPreviewMode({ category: 'Books & Magazines', hasPrimaryImage: true })).toBeNull()
  })

  it('matches apparel from the category, not from tags', () => {
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
    ).toBeNull()
  })
})

describe('suggestVisualPreviewPlacement', () => {
  it('suggests wall for TVs and art', () => {
    expect(suggestVisualPreviewPlacement({ category: 'Electronics / TV', title: '55 inch Smart TV' })).toBe(
      'wall',
    )
    expect(suggestVisualPreviewPlacement({ title: 'Canvas wall art', tags: ['poster'] })).toBe('wall')
  })

  it('suggests floor for furniture and rugs', () => {
    expect(suggestVisualPreviewPlacement({ category: 'Furniture', title: '3-seater sofa' })).toBe('floor')
    expect(suggestVisualPreviewPlacement({ title: 'Handwoven rug 5x7' })).toBe('floor')
  })

  it('suggests table for lamps and decor accents', () => {
    expect(suggestVisualPreviewPlacement({ title: 'Ceramic table lamp' })).toBe('table')
  })

  it('honors metadata placement override', () => {
    expect(
      suggestVisualPreviewPlacement({
        title: 'Sofa',
        listing_metadata: { visual_placement: 'wall' },
      }),
    ).toBe('wall')
  })
})

describe('visualPreviewPrompt', () => {
  it('includes placement guidance for view_in_space', () => {
    expect(visualPreviewPrompt('view_in_space', 'wall')).toMatch(/wall/i)
    expect(visualPreviewPrompt('view_in_space', 'floor')).toMatch(/floor/i)
    expect(visualPreviewPrompt('try_on')).toMatch(/wearing|wear/i)
  })

  it('includes product context when provided', () => {
    expect(
      visualPreviewPrompt('try_on', 'wall', { title: 'Red kurti', category: 'Fashion' }),
    ).toMatch(/Red kurti/)
  })
})

describe('isVisualPreviewEnabled', () => {
  it('defaults to enabled', () => {
    expect(isVisualPreviewEnabled()).toBe(true)
  })
})
