import { describe, expect, it } from 'vitest'

import { buyerCanUseDiscountUserTypes } from '~/commerce/lib/buyer-segment'
import { DISCOUNT_USER_TYPES } from '~/lib/discount/discount.constants'
import { isOfferEligible, type AvailableOffer } from '~/commerce/lib/offer-utils'

function offer(overrides: Partial<AvailableOffer> = {}): AvailableOffer {
  return {
    id: 'd1',
    code: 'SAVE10',
    name: 'Save 10',
    description: null,
    type: 'percentage',
    value: 10,
    minOrderAmount: null,
    maxDiscountAmount: null,
    validUntil: null,
    shopId: null,
    appliesTo: 'order',
    eligibleListingIds: null,
    eligibleUserTypes: [DISCOUNT_USER_TYPES.ALL],
    ...overrides,
  }
}

describe('buyer discount segments', () => {
  it('lets all-segment coupons through', () => {
    expect(buyerCanUseDiscountUserTypes([DISCOUNT_USER_TYPES.ALL], DISCOUNT_USER_TYPES.NEW)).toBe(true)
  })

  it('blocks returning-only coupons for new buyers', () => {
    expect(
      buyerCanUseDiscountUserTypes([DISCOUNT_USER_TYPES.RETURNING], DISCOUNT_USER_TYPES.NEW),
    ).toBe(false)
  })
})

describe('offer eligibility with user types', () => {
  it('rejects a vip-only coupon for a new buyer', () => {
    expect(
      isOfferEligible(
        offer({ eligibleUserTypes: [DISCOUNT_USER_TYPES.VIP] }),
        500,
        [{ shop_id: 's1', listing_id: 'l1', total_price: 500 }],
        DISCOUNT_USER_TYPES.NEW,
      ),
    ).toBe(false)
  })

  it('allows free shipping when the cart has items', () => {
    expect(
      isOfferEligible(
        offer({ type: 'free_shipping', value: 0 }),
        200,
        [{ shop_id: 's1', listing_id: 'l1', total_price: 200 }],
        DISCOUNT_USER_TYPES.RETURNING,
      ),
    ).toBe(true)
  })
})
