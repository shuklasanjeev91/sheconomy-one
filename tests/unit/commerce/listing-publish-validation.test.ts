import { describe, expect, it } from 'vitest'

import {
  resolveProductStructure,
  validateDraftForm,
  validatePublishStep,
} from '~/commerce/components/vendor/listing-publish/listing-publish.utils'
import {
  LISTING_METADATA_KEYS,
  LISTING_PUBLISH_STEP_IDS,
  PRODUCT_STRUCTURES,
} from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import { EMPTY_LISTING_FORM_DATA, LISTING_TYPES } from '~/lib/listing/listing.type'
import type { ListingFormData } from '~/lib/listing/listing.type'

function form(overrides: Partial<ListingFormData> = {}): ListingFormData {
  return { ...EMPTY_LISTING_FORM_DATA, ...overrides }
}

describe('publish section validation', () => {
  it('lets the about section pass before a price has been entered', () => {
    const result = validatePublishStep(
      LISTING_PUBLISH_STEP_IDS.ABOUT,
      form({
        title: 'Handwoven cotton scarf',
        description:
          'Soft handwoven cotton scarf with natural dyes, ideal for everyday wear across seasons.',
        price: '',
        categories: [{ category_id: 'scarves', is_primary: true }],
      }),
    )
    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('requires a substantive description on the about section', () => {
    const result = validatePublishStep(
      LISTING_PUBLISH_STEP_IDS.ABOUT,
      form({ title: 'Handwoven cotton scarf', description: 'Too short', price: '' }),
    )
    expect(result.isValid).toBe(false)
    expect(result.errors.description).toBeTruthy()
  })

  it('blocks the about section when the title is missing', () => {
    const result = validatePublishStep(LISTING_PUBLISH_STEP_IDS.ABOUT, form({ title: '' }))
    expect(result.isValid).toBe(false)
    expect(result.errors.title).toBeTruthy()
  })

  it('requires a price on the price section', () => {
    expect(validatePublishStep(LISTING_PUBLISH_STEP_IDS.PRICE, form({ price: '' })).isValid).toBe(false)
    expect(validatePublishStep(LISTING_PUBLISH_STEP_IDS.PRICE, form({ price: '250', stock: 1 })).isValid).toBe(
      true,
    )
  })

  it('asks digital listings for a download URL and file type', () => {
    const missing = validatePublishStep(
      LISTING_PUBLISH_STEP_IDS.ABOUT,
      form({ listing_type: LISTING_TYPES.DIGITAL, title: 'Pattern', description: 'A downloadable sewing pattern with sizes, fabric notes, and step by step assembly instructions.' }),
    )
    expect(missing.errors.digital_file_url).toBeTruthy()
    expect(missing.errors.digital_file_type).toBeTruthy()

    const complete = validatePublishStep(
      LISTING_PUBLISH_STEP_IDS.ABOUT,
      form({
        title: 'Pattern',
        description: 'A downloadable sewing pattern with sizes, fabric notes, and step by step assembly instructions.',
        listing_type: LISTING_TYPES.DIGITAL,
        digital_file_url: 'https://example.com/pattern.pdf',
        digital_file_type: 'pdf',
      }),
    )
    expect(complete.isValid).toBe(true)
  })

  it('asks for who made it and when it was made', () => {
    const made = validatePublishStep(
      LISTING_PUBLISH_STEP_IDS.MADE,
      form({ listing_type: LISTING_TYPES.PHYSICAL }),
    )
    expect(made.errors.who_made).toBeTruthy()
    expect(made.errors.what_is_it).toBeTruthy()
    const category = validatePublishStep(
      LISTING_PUBLISH_STEP_IDS.CATEGORY,
      form({ listing_type: LISTING_TYPES.PHYSICAL, categories: [{ category_id: 'scarves', is_primary: true }] }),
    )
    expect(category.errors.when_made).toBeTruthy()
  })
})

describe('resolveProductStructure', () => {
  it('treats listings with child SKUs as variable even when metadata defaults to simple', () => {
    expect(
      resolveProductStructure({
        listing_metadata: { [LISTING_METADATA_KEYS.PRODUCT_STRUCTURE]: PRODUCT_STRUCTURES.SIMPLE },
        variations: [{ variation_value: 'Red / M' }, { variation_value: 'Blue / L' }],
      }),
    ).toBe(PRODUCT_STRUCTURES.VARIABLE)
  })

  it('stays simple when there are no child SKUs', () => {
    expect(
      resolveProductStructure({
        listing_metadata: { [LISTING_METADATA_KEYS.PRODUCT_STRUCTURE]: PRODUCT_STRUCTURES.SIMPLE },
        variations: [],
      }),
    ).toBe(PRODUCT_STRUCTURES.SIMPLE)
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
