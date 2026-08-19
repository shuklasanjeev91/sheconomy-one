import { describe, expect, it } from 'vitest'

import { buildPostPurchaseNudges } from '~/commerce/lib/post-purchase-nudges'
import type { CustomerOrderItem } from '~/commerce/lib/customer-orders'
import { ORDER_STATUS } from '~/lib/orders/order.constants'

function item(
  overrides: Partial<CustomerOrderItem> & Pick<CustomerOrderItem, 'id' | 'listing_id' | 'product_title'>,
): CustomerOrderItem {
  return {
    id: overrides.id,
    listing_id: overrides.listing_id,
    product_title: overrides.product_title,
    product_sku: null,
    quantity: 1,
    unit_price: 100,
    total_price: 100,
    item_status: ORDER_STATUS.DELIVERED,
    variation_details: null,
    digital_download_url: null,
    download_expires_at: null,
    download_attempts: null,
    has_review: false,
    listing_slug: overrides.id,
    listing_type: 'physical',
    image_url: null,
    shop_id: 'shop-1',
    shop_name: 'Shop',
    shop_slug: 'shop',
    variant_id: null,
    available_stock: 5,
    listing_active: true,
    ...overrides,
  }
}

describe('buildPostPurchaseNudges', () => {
  it('prioritizes reorderable items into the buy-again lane', () => {
    const result = buildPostPurchaseNudges({
      orderStatus: ORDER_STATUS.DELIVERED,
      items: [
        item({ id: 'a', listing_id: 'listing-a', product_title: 'A' }),
        item({ id: 'b', listing_id: 'listing-b', product_title: 'B' }),
      ],
    })

    expect(result.sections.find((section) => section.key === 'buy_again')?.items.map((row) => row.itemId)).toEqual([
      'a',
      'b',
    ])
    expect(result.sections.find((section) => section.key === 'buy_again')?.canBulkReorder).toBe(true)
  })

  it('moves delivered unreviewed items into review-then-reorder when buy-again is unavailable', () => {
    const result = buildPostPurchaseNudges({
      orderStatus: ORDER_STATUS.DELIVERED,
      items: [
        item({
          id: 'blocked',
          listing_id: 'listing-blocked',
          product_title: 'Blocked',
          listing_active: false,
        }),
      ],
    })

    const reviewSection = result.sections.find((section) => section.key === 'review_then_reorder')
    expect(reviewSection?.items[0]?.itemId).toBe('blocked')
    expect(reviewSection?.items[0]?.source).toBe('review')
  })

  it('creates care reminders for delivered items after higher-priority lanes are used', () => {
    const result = buildPostPurchaseNudges({
      orderStatus: ORDER_STATUS.COMPLETED,
      items: [
        item({
          id: 'reviewed',
          listing_id: 'listing-reviewed',
          product_title: 'Reviewed',
          has_review: true,
          available_stock: 0,
        }),
        item({
          id: 'digital',
          listing_id: 'listing-digital',
          product_title: 'Digital',
          has_review: true,
          available_stock: 0,
          listing_type: 'digital',
        }),
      ],
    })

    const careSection = result.sections.find((section) => section.key === 'care_tips')
    expect(careSection?.items.map((row) => row.itemId)).toEqual(['reviewed', 'digital'])
    expect(careSection?.items[1]?.detail).toContain('file details')
  })
})
