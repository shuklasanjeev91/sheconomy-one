import { describe, expect, it } from 'vitest'

import {
  linkImagesToVariationKeys,
  listingUsesVariantPricing,
  stampVariationTempKeys,
  variationPriceFields,
  withVariantListingPrice,
} from '~/lib/listing/variation-draft'

describe('variation drafts', () => {
  it('stores an absolute price and the difference from the listing price', () => {
    expect(variationPriceFields(250, '300')).toEqual({ price: 300, price_adjustment: 50 })
    expect(variationPriceFields(250, '')).toEqual({ price: null, price_adjustment: 0 })
  })

  it('keeps photos attached to a variation after the row id changes', () => {
    const [variation] = stampVariationTempKeys([{ id: 'old-1', variation_metadata: {} }])
    const [linked] = linkImagesToVariationKeys(
      [{ variation_id: 'old-1' }],
      [variation],
    )
    expect(linked.variant_temp_key).toBe('old-1')
  })

  it('uses the first named option as the listing price', () => {
    expect(listingUsesVariantPricing([{ variation_value: '' }])).toBe(false)
    expect(
      withVariantListingPrice({
        price: '10',
        mrp: '12',
        variations: [
          { variation_value: '', price: 99, mrp: 100 },
          { variation_value: 'Red', price: 300, mrp: 350 },
          { variation_value: 'Blue', price: 280, mrp: null },
        ],
      }),
    ).toEqual({
      price: '300',
      mrp: '350',
      variations: [
        { variation_value: '', price: 99, mrp: 100 },
        { variation_value: 'Red', price: 300, mrp: 350 },
        { variation_value: 'Blue', price: 280, mrp: null },
      ],
    })
  })
})
