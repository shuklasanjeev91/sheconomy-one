/** A publicly-applicable coupon shown in the "available offers" list. */
export type AvailableOffer = {
  id: string
  code: string
  name: string
  description: string | null
  type: 'percentage' | 'fixed'
  value: number
  minOrderAmount: number | null
  maxDiscountAmount: number | null
  validUntil: string | null
  /** When set, this coupon only applies to that shop's products. */
  shopId: string | null
}

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0
  const parsed = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(parsed) ? parsed : 0
}

/** Estimate the discount an offer would give for a subtotal (clamped to it). */
export function estimateOfferDiscount(offer: AvailableOffer, subtotal: number): number {
  let amount = offer.type === 'percentage' ? (subtotal * offer.value) / 100 : offer.value
  if (offer.maxDiscountAmount && offer.maxDiscountAmount > 0 && amount > offer.maxDiscountAmount) {
    amount = offer.maxDiscountAmount
  }
  if (amount > subtotal) amount = subtotal
  if (amount < 0) amount = 0
  return Math.round(amount * 100) / 100
}

/** Subtotal used for eligibility / savings hints (shop-scoped when offer.shopId is set). */
export function offerEligibleSubtotal(
  offer: Pick<AvailableOffer, 'shopId'>,
  cartSubtotal: number,
  items: Array<{ shop_id: string | null; total_price: number | string | null }>,
): number {
  if (!offer.shopId) return cartSubtotal
  return items
    .filter((item) => item.shop_id === offer.shopId)
    .reduce((sum, item) => sum + toNumber(item.total_price), 0)
}

export function isOfferEligible(
  offer: AvailableOffer,
  cartSubtotal: number,
  items: Array<{ shop_id: string | null; total_price: number | string | null }>,
): boolean {
  const eligible = offerEligibleSubtotal(offer, cartSubtotal, items)
  if (eligible <= 0) return false
  if (offer.minOrderAmount != null && eligible < offer.minOrderAmount) return false
  return estimateOfferDiscount(offer, eligible) > 0
}

/**
 * Pure best-offer pick (no network). Used by auto-apply and unit tests.
 */
export function pickBestOffer(options: {
  offers: AvailableOffer[]
  subtotal: number
  items?: Array<{ shop_id: string | null; total_price: number | string | null }>
}): { offer: AvailableOffer; amount: number } | null {
  if (options.subtotal <= 0) return null
  let best: AvailableOffer | null = null
  let bestAmount = 0
  for (const offer of options.offers) {
    const eligibleSubtotal = offerEligibleSubtotal(offer, options.subtotal, options.items ?? [])
    if (eligibleSubtotal <= 0) continue
    if (offer.minOrderAmount != null && eligibleSubtotal < offer.minOrderAmount) continue
    const amount = estimateOfferDiscount(offer, eligibleSubtotal)
    if (amount > bestAmount) {
      best = offer
      bestAmount = amount
    }
  }
  if (!best || bestAmount <= 0) return null
  return { offer: best, amount: bestAmount }
}
