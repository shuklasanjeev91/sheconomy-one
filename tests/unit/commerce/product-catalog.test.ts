import { describe, expect, it } from 'vitest'

import { validateDraftForm, validateFullPublishForm } from '~/commerce/components/vendor/listing-publish/listing-publish.utils'
import { validateListingQuality } from '~/lib/listing/listing-quality'
import { EMPTY_LISTING_FORM_DATA, LISTING_TYPES } from '~/lib/listing/listing.type'
import type { ListingFormData } from '~/lib/listing/listing.type'
import {
  effectiveUnitPrice,
  listingCompletenessHint,
  saleWindowActive,
  validatePersonalization,
} from '~/lib/listing/product-catalog'

function form(overrides: Partial<ListingFormData> = {}): ListingFormData {
  return { ...EMPTY_LISTING_FORM_DATA, ...overrides }
}

const richDescription =
  'A rose clay mask for weekly use, mixed in small batches with a soft finish and a short ingredient list.'

describe('personalization', () => {
  it('skips checks when personalization is off', () => {
    expect(validatePersonalization({ personalization_enabled: false })).toEqual({})
  })

  it('requires instructions and a character limit when it is on', () => {
    expect(validatePersonalization({ personalization_enabled: true }).personalization_instructions).toBeTruthy()
    expect(
      validatePersonalization({
        personalization_enabled: true,
        personalization_instructions: 'Enter a name',
        personalization_char_limit: 40,
      }),
    ).toEqual({})
  })
})

describe('draft versus publish', () => {
  const thin = form({
    title: 'Rose clay mask',
    description: '',
    listing_type: LISTING_TYPES.PHYSICAL,
    price: '',
    images: [],
  })

  it('saves a draft without maker details', () => {
    expect(validateDraftForm(thin).isValid).toBe(true)
  })

  it('blocks publish until maker details, a photo, and shipping size are present', () => {
    const blocked = validateListingQuality(thin)
    expect(blocked.isValid).toBe(false)
    expect(blocked.errors.who_made).toBeTruthy()
    expect(blocked.errors.images).toBeTruthy()

    const ready = form({
      ...thin,
      description: richDescription,
      price: '499',
      stock: 8,
      categories: [{ category_id: 'beauty', is_primary: true }],
      who_made: 'i_did',
      when_made: 'made_to_order',
      what_is_it: 'finished_product',
      weight: 250,
      listing_metadata: {
        package_length_cm: '10',
        package_width_cm: '8',
        package_height_cm: '4',
      },
      images: [{ image_url: 'a.jpg', is_primary: true, width: 1600, height: 1600 }],
      product_info: {
        brand: 'SheBloom',
        generic_name: 'Clay mask',
        manufacturer_name: 'SheBloom Studio',
        manufacturer_address: 'Pune, Maharashtra, India',
        country_of_origin: 'India',
        key_features: 'Weekly rose clay mask\nSmall-batch mix\nSoft finish after rinse',
      },
    })
    const published = validateFullPublishForm(ready)
    expect(published.errors.who_made).toBeUndefined()
    expect(published.errors.images).toBeUndefined()
    expect(published.isValid).toBe(true)
  })
})

describe('inventory hints and sale windows', () => {
  it('names the first missing handmade detail', () => {
    expect(listingCompletenessHint({ listingType: 'physical', title: '' })).toBe('Add a title')
    expect(
      listingCompletenessHint({
        listingType: 'physical',
        title: 'Rose clay mask',
        whoMade: 'i_did',
      }),
    ).toBe('Say who made it')
    expect(
      listingCompletenessHint({
        listingType: 'physical',
        title: 'Rose clay mask',
        whoMade: 'i_did',
        whenMade: 'made_to_order',
        whatIsIt: 'finished_product',
      }),
    ).toBeNull()
  })

  it('applies a sale price only inside its window', () => {
    const now = new Date('2026-06-15T12:00:00Z')
    expect(saleWindowActive('2026-06-01', '2026-06-30', now)).toBe(true)
    expect(saleWindowActive('2026-07-01', '2026-07-30', now)).toBe(false)
    expect(effectiveUnitPrice(500, 399, '2026-06-01', '2026-06-30', now)).toBe(399)
    expect(effectiveUnitPrice(500, 399, '2026-07-01', '2026-07-30', now)).toBe(500)
    expect(effectiveUnitPrice(500, 399, null, null, now)).toBe(500)
  })
})
