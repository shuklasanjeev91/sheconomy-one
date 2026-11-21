import { describe, expect, it } from 'vitest'

import { validatePublishStep } from '~/commerce/components/vendor/listing-publish/listing-publish.utils'
import { LISTING_PUBLISH_STEP_IDS } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import { EMPTY_LISTING_FORM_DATA, LISTING_TYPES } from '~/lib/listing/listing.type'
import type { ListingFormData } from '~/lib/listing/listing.type'

function form(overrides: Partial<ListingFormData> = {}): ListingFormData {
  return { ...EMPTY_LISTING_FORM_DATA, ...overrides }
}

describe('publish section validation', () => {
  it('lets the basics step pass before a price has been entered', () => {
    const result = validatePublishStep(
      LISTING_PUBLISH_STEP_IDS.BASIC,
      form({
        title: 'Handwoven cotton scarf',
        description:
          'Soft handwoven cotton scarf with natural dyes, ideal for everyday wear across seasons.',
        price: '250',
      }),
    )
    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('requires a description on the basics step', () => {
    const result = validatePublishStep(
      LISTING_PUBLISH_STEP_IDS.BASIC,
      form({ title: 'Handwoven cotton scarf', description: 'Too short', price: '' }),
    )
    expect(result.isValid).toBe(false)
    expect(result.errors.description).toBeTruthy()
  })

  it('blocks the basics step when the title is missing', () => {
    const result = validatePublishStep(LISTING_PUBLISH_STEP_IDS.BASIC, form({ title: '' }))
    expect(result.isValid).toBe(false)
    expect(result.errors.title).toBeTruthy()
  })

  it('requires a price on the pricing step', () => {
    expect(validatePublishStep(LISTING_PUBLISH_STEP_IDS.PRICING, form({ price: '' })).isValid).toBe(false)
    expect(validatePublishStep(LISTING_PUBLISH_STEP_IDS.PRICING, form({ price: '250' })).isValid).toBe(true)
  })

  it('skips the listing price when a named option has its own selling price', () => {
    const priced = form({
      price: '',
      variations: [{ variation_name: 'Color', variation_value: 'Red', price: 300 }],
    })
    expect(validatePublishStep(LISTING_PUBLISH_STEP_IDS.PRICING, priced).isValid).toBe(true)
    expect(validatePublishStep(LISTING_PUBLISH_STEP_IDS.DETAILS, priced).errors.variations).toBeUndefined()
  })

  it('requires a selling price on each named option', () => {
    const result = validatePublishStep(
      LISTING_PUBLISH_STEP_IDS.DETAILS,
      form({
        listing_type: LISTING_TYPES.PHYSICAL,
        materials: [{ material_name: 'Cotton' }],
        stock: '4',
        variations: [{ variation_name: 'Color', variation_value: 'Red', price: null }],
      }),
    )
    expect(result.errors.variations).toMatch(/selling price/i)
  })

  it('asks physical listings for a material, a variation, and stock', () => {
    const missing = validatePublishStep(
      LISTING_PUBLISH_STEP_IDS.DETAILS,
      form({ listing_type: LISTING_TYPES.PHYSICAL, stock: '' }),
    )
    expect(missing.errors.materials).toBeTruthy()
    expect(missing.errors.variations).toBeTruthy()
    expect(missing.errors.stock).toBeTruthy()
  })
})
