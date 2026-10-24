import { describe, expect, it } from 'vitest'

import { productQuestionChips } from '~/lib/listing/product-questions'

function labels(category: string) {
  return productQuestionChips(category).map((chip) => chip.label)
}

describe('productQuestionChips', () => {
  it('asks apparel about material and sizes', () => {
    expect(labels('Sarees')).toEqual([
      'Price',
      'Material',
      'Sizes',
      'In stock',
      'Reviews',
      'Returns',
      'About this product',
    ])
  })

  it('asks supplements about ingredients and pack size', () => {
    expect(labels('Herbal & Ayurvedic Supplements')).toEqual([
      'Price',
      'Ingredients',
      'Pack size',
      'In stock',
      'Reviews',
      'Returns',
      'About this product',
    ])
    expect(labels('Skin Health')).not.toContain('Sizes')
    expect(labels('Skin Health')).toContain('Ingredients')
  })

  it('asks home products about material and skips clothing sizes', () => {
    expect(labels('Wall Clocks')).toContain('Material')
    expect(labels('Wall Clocks')).not.toContain('Sizes')
    expect(labels('Wall Clocks')).not.toContain('Ingredients')
  })

  it('keeps a short list when the category has no special questions', () => {
    expect(labels('Books & Magazines')).toEqual([
      'Price',
      'In stock',
      'Reviews',
      'Returns',
      'About this product',
    ])
  })
})
