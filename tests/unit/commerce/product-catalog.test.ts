import { describe, expect, it } from 'vitest'

import { validateDraftForm, validateFullPublishForm } from '~/commerce/components/vendor/listing-publish/listing-publish.utils'
import { validateListingQuality } from '~/lib/listing/listing-quality'
import { EMPTY_LISTING_FORM_DATA, LISTING_TYPES } from '~/lib/listing/listing.type'
import type { ListingFormData } from '~/lib/listing/listing.type'
import type { ProductTypeCatalog } from '~/lib/listing/product-catalog'
import {
  effectiveUnitPrice,
  gtinCheckDigit,
  isValidProductId,
  listingCompletenessHint,
  saleWindowActive,
  validateProductIdentifier,
  validateRequiredAttributes,
  validateRequiredCompliance,
} from '~/lib/listing/product-catalog'

function form(overrides: Partial<ListingFormData> = {}): ListingFormData {
  return { ...EMPTY_LISTING_FORM_DATA, ...overrides }
}

const catalog: ProductTypeCatalog = {
  id: 'beauty',
  code: 'beauty',
  name: 'Beauty',
  family: 'beauty',
  variationThemes: [{ code: 'size', label: 'Size', axes: ['Size'] }],
  attributes: [
    {
      id: 'ingredients',
      code: 'ingredients',
      label: 'Ingredient list',
      data_type: 'text',
      is_required: true,
      is_recommended: false,
      is_variation_axis: false,
      display_order: 1,
      options: [],
    },
  ],
  compliance: [
    {
      code: 'ingredient_declaration',
      label: 'Ingredient declaration',
      is_required: true,
      document_types: ['pdf'],
    },
  ],
}

describe('GTIN check digits', () => {
  it('computes the GS1 check digit and accepts a matching UPC', () => {
    const body = '03600029145'
    const upc = `${body}${gtinCheckDigit(body)}`
    expect(upc).toBe('036000291452')
    expect(isValidProductId('upc', upc)).toBe(true)
    expect(isValidProductId('upc', `${body}3`)).toBe(false)
    expect(isValidProductId('ean', upc)).toBe(false)
  })

  it('accepts an ISBN-13 that shares the GTIN check digit', () => {
    const body = '978030640615'
    const isbn = `${body}${gtinCheckDigit(body)}`
    expect(isValidProductId('isbn', isbn)).toBe(true)
    expect(isValidProductId('isbn', '0306406152')).toBe(true)
    expect(isValidProductId('isbn', '0306406153')).toBe(false)
  })
})

describe('product identifier gate', () => {
  it('accepts an exemption with a reason and no barcode', () => {
    expect(
      validateProductIdentifier(
        {
          product_id_type: 'none',
          product_id_value: '',
          gtin_exemption: true,
          gtin_exemption_reason: 'handmade',
        },
        { required: true },
      ),
    ).toEqual({})
  })

  it('rejects an exemption that still carries a product ID', () => {
    const errors = validateProductIdentifier(
      {
        product_id_type: 'upc',
        product_id_value: '036000291452',
        gtin_exemption: true,
        gtin_exemption_reason: 'handmade',
      },
      { required: true },
    )
    expect(errors.product_id_value).toMatch(/exemption/i)
  })

  it('rejects a missing barcode when there is no exemption', () => {
    const errors = validateProductIdentifier(
      {
        product_id_type: 'none',
        product_id_value: '',
        gtin_exemption: false,
        gtin_exemption_reason: null,
      },
      { required: true },
    )
    expect(errors.product_id_value).toBeTruthy()
  })
})

describe('required catalog children', () => {
  it('requires the product type attribute and compliance document', () => {
    expect(validateRequiredAttributes(catalog, [])).toHaveProperty('attr_ingredients')
    expect(validateRequiredAttributes(catalog, [{ attribute_id: 'ingredients', value_text: 'Shea' }])).toEqual({})
    expect(validateRequiredCompliance(catalog, [])).toHaveProperty('compliance_ingredient_declaration')
    expect(
      validateRequiredCompliance(catalog, [
        { requirement_code: 'ingredient_declaration', document_type: 'pdf', file_url: 'path/doc.pdf' },
      ]),
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

  it('saves a draft without a product type, barcode, or documents', () => {
    expect(validateDraftForm(thin).isValid).toBe(true)
  })

  it('blocks publish until identity, required attributes, and documents are present', () => {
    const blocked = validateListingQuality(thin)
    expect(blocked.isValid).toBe(false)
    expect(blocked.errors.product_type_id).toBeTruthy()
    expect(blocked.errors.product_id_value).toBeTruthy()

    const ready = form({
        ...thin,
        description:
          'A rose clay mask for weekly use, mixed in small batches with a soft finish and a short ingredient list.',
        price: '499',
        stock: 8,
        product_type_id: catalog.id,
        item_condition: 'new',
        product_identifier: {
          product_id_type: 'none',
          gtin_exemption: true,
          gtin_exemption_reason: 'handmade',
        },
        attribute_values: [{ attribute_id: 'ingredients', value_text: 'Rose clay, water' }],
        compliance_documents: [
          { requirement_code: 'ingredient_declaration', document_type: 'pdf', file_url: 'doc.pdf' },
        ],
        images: [
          { image_url: 'a.jpg', is_primary: true, width: 1600, height: 1600 },
          { image_url: 'b.jpg', width: 1600, height: 1600 },
          { image_url: 'c.jpg', width: 1600, height: 1600 },
        ],
        product_info: {
          brand: 'SheBloom',
          generic_name: 'Clay mask',
          manufacturer_name: 'SheBloom Studio',
          manufacturer_address: 'Pune, Maharashtra, India',
          country_of_origin: 'India',
          key_features: 'Weekly rose clay mask\nSmall-batch mix\nSoft finish after rinse',
        },
      })
    expect(ready.product_type_id).toBe(catalog.id)
    const published = validateFullPublishForm(ready, catalog)
    expect(published.errors.product_type_id).toBeUndefined()
    expect(published.errors.product_id_value).toBeUndefined()
    expect(published.errors.attr_ingredients).toBeUndefined()
    expect(published.errors.compliance_ingredient_declaration).toBeUndefined()
    expect(published.isValid).toBe(true)
  })
})

describe('inventory hints and sale windows', () => {
  it('names the first missing identity piece', () => {
    expect(
      listingCompletenessHint({
        listingType: 'physical',
        productTypeId: null,
      }),
    ).toBe('Choose a product type')
    expect(
      listingCompletenessHint({
        listingType: 'physical',
        productTypeId: 'beauty',
        itemCondition: 'new',
        identifier: {
          product_id_type: 'none',
          gtin_exemption: false,
        },
        catalog,
        attributeValues: [{ attribute_id: 'ingredients', value_text: 'Rose' }],
        documents: [{ requirement_code: 'ingredient_declaration', file_url: 'doc.pdf' }],
      }),
    ).toBe('Add a barcode or GTIN exemption')
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
