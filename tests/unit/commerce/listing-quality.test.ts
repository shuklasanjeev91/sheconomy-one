import { describe, expect, it } from 'vitest'

import {
  validateListingQuality,
  validateListingImagesQuality,
  validatePhysicalProductInfoQuality,
} from '~/lib/listing/listing-quality'
import { EMPTY_LISTING_FORM_DATA, LISTING_TYPES } from '~/lib/listing/listing.type'
import type { ListingFormData } from '~/lib/listing/listing.type'

function form(overrides: Partial<ListingFormData> = {}): ListingFormData {
  return { ...EMPTY_LISTING_FORM_DATA, ...overrides }
}

const richDescription =
  'Handwoven cotton stole crafted on a traditional loom with natural dyes. Soft, breathable, and made for everyday wear across seasons.'

describe('listing image quality', () => {
  it('requires at least 3 images to publish', () => {
    const result = validateListingImagesQuality([
      { image_url: 'a.jpg', width: 1600, height: 1600 },
      { image_url: 'b.jpg', width: 1600, height: 1600 },
    ])
    expect(result.isValid).toBe(false)
    expect(result.errors.images).toMatch(/3/)
  })

  it('rejects main images below 1000px', () => {
    const result = validateListingImagesQuality([
      { image_url: 'a.jpg', is_primary: true, width: 800, height: 800 },
      { image_url: 'b.jpg', width: 1600, height: 1600 },
      { image_url: 'c.jpg', width: 1600, height: 1600 },
    ])
    expect(result.isValid).toBe(false)
    expect(result.errors.images).toMatch(/1000/)
  })

  it('accepts three sharp images', () => {
    const result = validateListingImagesQuality([
      { image_url: 'a.jpg', is_primary: true, width: 1600, height: 1600 },
      { image_url: 'b.jpg', width: 1600, height: 1600 },
      { image_url: 'c.jpg', width: 1600, height: 1600 },
    ])
    expect(result.isValid).toBe(true)
  })
})

describe('product info quality', () => {
  it('requires brand, manufacturer, country, and key features', () => {
    const result = validatePhysicalProductInfoQuality({})
    expect(result.errors.brand).toBeTruthy()
    expect(result.errors.manufacturer_name).toBeTruthy()
    expect(result.errors.manufacturer_address).toBeTruthy()
    expect(result.errors.country_of_origin).toBeTruthy()
    expect(result.errors.key_features).toBeTruthy()
  })

  it('accepts a complete product info bag', () => {
    const result = validatePhysicalProductInfoQuality({
      brand: 'SheLoom',
      generic_name: 'Cotton stole',
      manufacturer_name: 'SheLoom Weavers',
      manufacturer_address: 'Jaipur, Rajasthan, India',
      country_of_origin: 'India',
      key_features: 'Handwoven on a loom\nNatural vegetable dyes\nSoft cotton finish',
      net_quantity: '1 piece',
      hsn_code: '6214',
    })
    expect(result.isValid).toBe(true)
  })
})

describe('validateListingQuality', () => {
  it('blocks thin physical listings', () => {
    const result = validateListingQuality(
      form({
        title: 'Stole',
        description: 'Nice',
        listing_type: LISTING_TYPES.PHYSICAL,
        price: 500,
        images: [],
      }),
    )
    expect(result.isValid).toBe(false)
    expect(result.errors.description || result.errors.images).toBeTruthy()
  })

  it('passes a complete physical listing', () => {
    const result = validateListingQuality(
      form({
        title: 'Handwoven cotton stole',
        description: richDescription,
        listing_type: LISTING_TYPES.PHYSICAL,
        price: 899,
        stock: 12,
        materials: [{ material_name: 'Cotton' }],
        variations: [{ variation_type: 'Color', variation_value: 'Indigo' }],
        images: [
          { image_url: 'a.jpg', is_primary: true, width: 1600, height: 1600 },
          { image_url: 'b.jpg', width: 1600, height: 1600 },
          { image_url: 'c.jpg', width: 1600, height: 1600 },
        ],
        product_info: {
          brand: 'SheLoom',
          generic_name: 'Cotton stole',
          manufacturer_name: 'SheLoom Weavers',
          manufacturer_address: 'Jaipur, Rajasthan, India',
          country_of_origin: 'India',
          key_features: 'Handwoven on a loom\nNatural vegetable dyes\nLightweight for travel',
          net_quantity: '1 piece',
          hsn_code: '6214',
        },
      }),
    )
    expect(result.isValid).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(80)
  })
})
