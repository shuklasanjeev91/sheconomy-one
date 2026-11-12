import { describe, expect, it } from 'vitest'

import { groupCartItemsBySeller, getCartItemSellerId } from '~/commerce/lib/cart-sellers'
import type { CartItemRow } from '~/commerce/lib/cart'

function item(partial: Partial<CartItemRow> & Pick<CartItemRow, 'id' | 'shop_id'>): CartItemRow {
  return {
    cart_id: 'c1',
    created_at: '',
    updated_at: '',
    image_url: null,
    item_metadata: {},
    listing_id: 'l1',
    quantity: 1,
    saved_for_later: false,
    shop_name: 'Shop',
    title: 'Item',
    total_price: 10,
    unit_price: 10,
    variant_id: null,
    variant_name: null,
    variant_sku: null,
    variant_value: null,
    ...partial,
  }
}

describe('groupCartItemsBySeller', () => {
  it('groups lines by seller_id (= shop_id)', () => {
    const rows = [
      item({ id: '1', shop_id: 's1', shop_name: 'Alpha', title: 'A' }),
      item({ id: '2', shop_id: 's2', shop_name: 'Beta', title: 'B' }),
      item({ id: '3', shop_id: 's1', shop_name: 'Alpha', title: 'C' }),
    ]
    const groups = groupCartItemsBySeller(rows)
    expect(groups).toHaveLength(2)
    expect(groups[0].seller_id).toBe('s1')
    expect(groups[0].items).toHaveLength(2)
    expect(groups[1].seller_id).toBe('s2')
    expect(getCartItemSellerId(rows[0])).toBe('s1')
  })
})
