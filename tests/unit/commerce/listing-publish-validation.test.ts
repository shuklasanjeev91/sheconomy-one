import { describe, expect, it } from 'vitest'

import {
  validateDraftForm,
  validatePublishStep,
} from '~/commerce/components/vendor/listing-publish/listing-publish.utils'
import { LISTING_PUBLISH_STEP_IDS } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import { EMPTY_LISTING_FORM_DATA, LISTING_TYPES } from '~/lib/listing/listing.type'
import type { ListingFormData } from '~/lib/listing/listing.type'

function form(overrides: Partial<ListingFormData> = {}): ListingFormData {
  return { ...EMPTY_LISTING_FORM_DATA, ...overrides }
}

describe('publish wizard step validation', () => {
  it('lets the basic step pass before a price has been entered', () => {
    const result = validatePublishStep(
      LISTING_PUBLISH_STEP_IDS.BASIC,
      form({ title: 'Handwoven cotton scarf', description: 'Soft and warm.', price: '' }),
    )
    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('blocks the basic step when the title is missing', () => {
    const result = validatePublishStep(LISTING_PUBLISH_STEP_IDS.BASIC, form({ title: '' }))
    expect(result.isValid).toBe(false)
    expect(result.errors.title).toBeTruthy()
  })

  it('requires a price only on the pricing step', () => {
    expect(validatePublishStep(LISTING_PUBLISH_STEP_IDS.PRICING, form({ price: '' })).isValid).toBe(
      false,
    )
    expect(validatePublishStep(LISTING_PUBLISH_STEP_IDS.PRICING, form({ price: '250' })).isValid).toBe(
      true,
    )
  })

  it('asks digital listings for a download URL and file type', () => {
    const missing = validatePublishStep(
      LISTING_PUBLISH_STEP_IDS.DETAILS,
      form({ listing_type: LISTING_TYPES.DIGITAL }),
    )
    expect(missing.errors.digital_file_url).toBeTruthy()
    expect(missing.errors.digital_file_type).toBeTruthy()

    const complete = validatePublishStep(
      LISTING_PUBLISH_STEP_IDS.DETAILS,
      form({
        listing_type: LISTING_TYPES.DIGITAL,
        digital_file_url: 'https://example.com/pattern.pdf',
        digital_file_type: 'pdf',
      }),
    )
    expect(complete.isValid).toBe(true)
  })

  it('does not apply physical-only requirements to digital listings', () => {
    const result = validatePublishStep(
      LISTING_PUBLISH_STEP_IDS.DETAILS,
      form({
        listing_type: LISTING_TYPES.DIGITAL,
        digital_file_url: 'https://example.com/pattern.pdf',
        digital_file_type: 'pdf',
        materials: [],
        variations: [],
      }),
    )
    expect(result.errors.materials).toBeUndefined()
    expect(result.errors.variations).toBeUndefined()
  })
})

describe('draft validation', () => {
  it('saves a draft that only has a title and a type', () => {
    const result = validateDraftForm(
      form({ title: 'Work in progress', price: '', description: '', images: [] }),
    )
    expect(result.isValid).toBe(true)
  })

  it('still requires a title', () => {
    const result = validateDraftForm(form({ title: '' }))
    expect(result.isValid).toBe(false)
    expect(result.errors.title).toBeTruthy()
  })
})
