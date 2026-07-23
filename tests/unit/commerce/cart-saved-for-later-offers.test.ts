import { describe, expect, it } from 'vitest'

import { splitCartItems } from '~/commerce/lib/cart-shelf'
import {
  isOfferEligible,
  offerEligibleSubtotal,
  pickBestOffer,
  type AvailableOffer,
} from '~/commerce/lib/offer-utils'

type CartItemLike = {
  id: string
  listing_id: string
  shop_id: string
  saved_for_later: boolean
  cart_id?: string
  quantity?: number
  unit_price?: number
  total_price?: number
  title?: string
  shop_name?: string
}

function item(overrides: CartItemLike) {
  return {
    cart_id: 'cart-1',
    created_at: '',
    updated_at: '',
    image_url: null,
    item_metadata: {},
    quantity: 1,
    shop_name: 'Shop',
    title: 'Item',
    total_price: 100,
    unit_price: 100,
    variant_id: null,
    variant_name: null,
    variant_sku: null,
    variant_value: null,
    ...overrides,
  }
}

function offer(overrides: Partial<AvailableOffer> & Pick<AvailableOffer, 'id' | 'code'>): AvailableOffer {
  return {
    name: overrides.code,
    description: null,
    type: 'fixed',
    value: 50,
    minOrderAmount: null,
    maxDiscountAmount: null,
    validUntil: null,
    shopId: null,
    ...overrides,
  }
}

describe('splitCartItems', () => {
  it('separates active and saved-for-later lines', () => {
    const rows = [
      item({ id: 'a', listing_id: 'l1', shop_id: 's1', saved_for_later: false }),
      item({ id: 'b', listing_id: 'l2', shop_id: 's1', saved_for_later: true }),
      item({ id: 'c', listing_id: 'l3', shop_id: 's2', saved_for_later: false }),
    ]
    const { items, savedItems } = splitCartItems(rows)
    expect(items.map((row) => row.id)).toEqual(['a', 'c'])
    expect(savedItems.map((row) => row.id)).toEqual(['b'])
  })
})

describe('offer eligibility and best offer', () => {
  const cartItems = [
    { shop_id: 'shop-a', total_price: 400 },
    { shop_id: 'shop-b', total_price: 200 },
  ]

  it('scores shop offers against that shop subtotal only', () => {
    const shopOffer = offer({
      id: 'o1',
      code: 'SHOP100',
      value: 100,
      minOrderAmount: 350,
      shopId: 'shop-a',
    })
    expect(offerEligibleSubtotal(shopOffer, 600, cartItems)).toBe(400)
    expect(isOfferEligible(shopOffer, 600, cartItems)).toBe(true)

    const locked = offer({
      id: 'o2',
      code: 'SHOP500',
      value: 50,
      minOrderAmount: 500,
      shopId: 'shop-b',
    })
    expect(isOfferEligible(locked, 600, cartItems)).toBe(false)
  })

  it('picks the highest savings among eligible offers', () => {
    const best = pickBestOffer({
      subtotal: 600,
      items: cartItems,
      offers: [
        offer({ id: 'p10', code: 'P10', type: 'percentage', value: 10 }),
        offer({ id: 'f80', code: 'F80', type: 'fixed', value: 80 }),
        offer({
          id: 'shop',
          code: 'SHOP200',
          type: 'fixed',
          value: 200,
          shopId: 'shop-a',
          minOrderAmount: 300,
        }),
      ],
    })
    expect(best?.offer.id).toBe('shop')
    expect(best?.amount).toBe(200)
  })

  it('skips offers below min order', () => {
    const best = pickBestOffer({
      subtotal: 100,
      items: [{ shop_id: 'shop-a', total_price: 100 }],
      offers: [
        offer({ id: 'big', code: 'BIG', value: 50, minOrderAmount: 500 }),
        offer({ id: 'small', code: 'SMALL', value: 10, minOrderAmount: 50 }),
      ],
    })
    expect(best?.offer.id).toBe('small')
    expect(best?.amount).toBe(10)
  })
})
