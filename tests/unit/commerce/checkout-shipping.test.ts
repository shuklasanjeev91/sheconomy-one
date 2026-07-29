import { describe, expect, it } from 'vitest'

import { computeCheckoutShippingQuote } from '~/commerce/lib/checkout-shipping'
import type { CartItemRow } from '~/commerce/lib/cart'
import { SHIPPING_RATE_TYPE } from '~/lib/shipping-policy/shipping-policy.constants'
import type { ShippingPolicy } from '~/lib/shipping-policy/shipping-policy.type'

const shopItem = {
  id: 'ci-1',
  cart_id: 'cart-1',
  listing_id: 'listing-1',
  shop_id: 'shop-1',
  shop_name: 'Test Shop',
  title: 'Item',
  quantity: 1,
  unit_price: 4984,
  image_url: null,
  saved_for_later: false,
} satisfies CartItemRow

const fixedProfile: ShippingPolicy = {
  id: 'profile-1',
  shop_id: 'shop-1',
  profile_name: 'Shop Level Shipping',
  is_default: true,
  is_active: true,
  processing_time_min: 1,
  processing_time_max: 7,
  shipping_rate_type: SHIPPING_RATE_TYPE.FIXED,
  fixed_fee: 500,
  free_shipping_threshold: null,
  shipping_zones: [],
  delivery_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('computeCheckoutShippingQuote', () => {
  it('adds per-shop shipping from delivery profiles after discount', () => {
    const quote = computeCheckoutShippingQuote({
      cart: {
        id: 'cart-1',
        currency: 'INR',
        discount_amount: 996.8,
        items_subtotal: 4984,
      } as never,
      selectedItems: [shopItem],
      listingTypes: new Map([['listing-1', 'physical']]),
      deliveryProfilesByShop: new Map([['shop-1', [fixedProfile]]]),
      selectedSubtotal: 4984,
      selectedDiscount: 996.8,
    })

    expect(quote.shippingTotal).toBe(500)
    expect(quote.itemsTotal).toBe(3987.2)
    expect(quote.grandTotal).toBe(4487.2)
    expect(quote.byShop[0]?.deliveryProfileName).toBe('Shop Level Shipping')
  })

  it('skips shipping for digital-only shop lines', () => {
    const quote = computeCheckoutShippingQuote({
      cart: null,
      selectedItems: [shopItem],
      listingTypes: new Map([['listing-1', 'digital']]),
      deliveryProfilesByShop: new Map([['shop-1', [fixedProfile]]]),
      selectedSubtotal: 4984,
      selectedDiscount: 0,
    })

    expect(quote.shippingTotal).toBe(0)
    expect(quote.grandTotal).toBe(4984)
    expect(quote.byShop[0]?.requiresShipping).toBe(false)
  })
})
