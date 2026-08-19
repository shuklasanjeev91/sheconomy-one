import { describe, expect, it } from 'vitest'

import {
  buildStockAlertSections,
  classifyStockAlertState,
  dedupeStockAlertListingIds,
  type StockAlertListing,
} from '~/commerce/lib/stock-alerts'

function item(overrides: Partial<StockAlertListing> = {}): StockAlertListing {
  return {
    listingId: 'listing-1',
    slug: 'listing-1',
    title: 'Handmade Tote',
    imageUrl: null,
    shopName: 'Studio',
    price: 1499,
    currency: 'INR',
    stock: 0,
    isActive: true,
    listingStatus: 'active',
    subscribedAt: '2026-08-19T00:00:00.000Z',
    notifiedAt: null,
    state: 'watching',
    ...overrides,
  }
}

describe('stock alert center helpers', () => {
  it('classifies back in stock, watching, and inactive listings', () => {
    expect(classifyStockAlertState({ stock: 5, isActive: true, listingStatus: 'active' })).toBe('back_in_stock')
    expect(classifyStockAlertState({ stock: 0, isActive: true, listingStatus: 'active' })).toBe('watching')
    expect(classifyStockAlertState({ stock: 0, isActive: false, listingStatus: 'draft' })).toBe('inactive')
  })

  it('deduplicates repeated listing ids before hydration', () => {
    expect(dedupeStockAlertListingIds(['a', 'b', 'a', '', 'b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('builds alert sections in buyer-friendly order', () => {
    const sections = buildStockAlertSections([
      item({ listingId: '1', state: 'watching' }),
      item({ listingId: '2', state: 'back_in_stock', stock: 4 }),
      item({ listingId: '3', state: 'inactive', isActive: false, listingStatus: 'draft' }),
    ])

    expect(sections.map((section) => section.key)).toEqual(['back_in_stock', 'watching', 'inactive'])
    expect(sections[0]?.items[0]?.listingId).toBe('2')
  })
})
