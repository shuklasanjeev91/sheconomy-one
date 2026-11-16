import { describe, expect, it } from 'vitest'

import {
  cartesianAxes,
  getChildUnitPrice,
  isChildSkuMode,
  resolveChildSku,
} from '~/commerce/lib/listing-variant-skus'
import {
  filterImagesForVariant,
  getVariantPrice,
  groupListingVariations,
} from '~/commerce/lib/listing-detail'

describe('listing-variant-skus', () => {
  it('builds a cartesian product of axes', () => {
    const { combinations, truncated, error } = cartesianAxes([
      { name: 'Color', values: ['Red', 'Blue'] },
      { name: 'Size', values: ['S', 'M'] },
    ])
    expect(error).toBeNull()
    expect(truncated).toBe(false)
    expect(combinations).toEqual([
      { Color: 'Red', Size: 'S' },
      { Color: 'Red', Size: 'M' },
      { Color: 'Blue', Size: 'S' },
      { Color: 'Blue', Size: 'M' },
    ])
  })

  it('caps combinations at 100', () => {
    const values = Array.from({ length: 11 }, (_, i) => `V${i}`)
    const { truncated, error, combinations } = cartesianAxes([
      { name: 'A', values },
      { name: 'B', values },
    ])
    expect(truncated).toBe(true)
    expect(error).toMatch(/max 100/i)
    expect(combinations).toHaveLength(100)
  })

  it('resolves one child SKU from axis selection', () => {
    const rows = [
      {
        id: 'a',
        price: 100,
        variation_metadata: { mode: 'child_sku', options: { Color: 'Red', Size: 'S' } },
      },
      {
        id: 'b',
        price: 120,
        variation_metadata: { mode: 'child_sku', options: { Color: 'Red', Size: 'M' } },
      },
    ]
    expect(isChildSkuMode(rows)).toBe(true)
    expect(resolveChildSku(rows, { Color: 'Red', Size: 'M' })?.id).toBe('b')
    expect(getChildUnitPrice(99, resolveChildSku(rows, { Color: 'Red', Size: 'M' }))).toBe(120)
  })

  it('falls back to listing price + adjustment when child price missing', () => {
    expect(getChildUnitPrice(200, { price_adjustment: 25 })).toBe(225)
  })
})

describe('listing-detail child vs legacy', () => {
  it('groups child SKUs as axis pickers and prices from absolute child price', () => {
    const variations = [
      {
        id: '1',
        variation_name: 'Color / Size',
        variation_value: 'Red / M',
        price_adjustment: 20,
        price: 520,
        stock: 3,
        sku: 'RM',
        is_available: true,
        display_order: 0,
        variation_metadata: { mode: 'child_sku', options: { Color: 'Red', Size: 'M' } },
      },
      {
        id: '2',
        variation_name: 'Color / Size',
        variation_value: 'Blue / S',
        price_adjustment: 0,
        price: 480,
        stock: 1,
        sku: 'BS',
        is_available: true,
        display_order: 1,
        variation_metadata: { mode: 'child_sku', options: { Color: 'Blue', Size: 'S' } },
      },
    ]
    const groups = groupListingVariations(variations)
    expect(groups.map((g) => g.name).sort()).toEqual(['Color', 'Size'])
    expect(groups.every((g) => g.mode === 'child_sku')).toBe(true)
    expect(getVariantPrice(500, [variations[0]!])).toBe(520)
  })

  it('keeps legacy adjustment pricing when no child_sku metadata', () => {
    const variations = [
      {
        id: 'c1',
        variation_name: 'Color',
        variation_value: 'Red',
        price_adjustment: 10,
        stock: 2,
        sku: null,
        is_available: true,
        display_order: 0,
      },
      {
        id: 's1',
        variation_name: 'Size',
        variation_value: 'M',
        price_adjustment: 5,
        stock: 4,
        sku: null,
        is_available: true,
        display_order: 1,
      },
    ]
    const groups = groupListingVariations(variations)
    expect(groups).toHaveLength(2)
    expect(groups.every((g) => g.mode === 'legacy')).toBe(true)
    expect(getVariantPrice(100, variations)).toBe(115)
  })

  it('falls back to parent gallery when child has no images', () => {
    const images = [
      { id: 'p1', variation_id: null },
      { id: 'c1', variation_id: 'v1' },
    ]
    expect(filterImagesForVariant(images, 'v1').map((i) => i.id)).toEqual(['c1'])
    expect(filterImagesForVariant(images, 'v-missing').map((i) => i.id)).toEqual(['p1'])
    expect(filterImagesForVariant(images, null).map((i) => i.id)).toEqual(['p1'])
  })
})
