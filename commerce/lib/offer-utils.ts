/** A publicly-applicable coupon shown in the "available offers" list. */
export type AvailableOffer = {
  id: string
  code: string
  name: string
  description: string | null
  type: 'percentage' | 'fixed' | 'bogo' | 'free_shipping'
  value: number
  minOrderAmount: number | null
  maxDiscountAmount: number | null
  validUntil: string | null
  /** When set, this coupon only applies to that shop's products. */
  shopId: string | null
  /** Order-wide vs specific cart line items. */
  appliesTo: 'order' | 'item'
  /**
   * Listing filter for min-order / discount base (matches checkout SQL).
   * `null` = no listing filter; `[]` = no eligible lines; non-empty = those listings only.
   */
  eligibleListingIds: string[] | null
  eligibleUserTypes?: string[] | null
  assignedToUser?: boolean
}

export type CartOfferItem = {
  shop_id: string | null
  listing_id: string
  total_price: number | string | null
}

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0
  const parsed = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(parsed) ? parsed : 0
}

type DiscountWindow = {
  is_active?: boolean | null
  valid_from: string
  valid_until: string | null
}

/** True when a discount profile is active and inside its validity window. */
export function isDiscountProfileActive(
  profile: DiscountWindow,
  nowMs: number = Date.now(),
): boolean {
  if (profile.is_active === false) return false
  const from = new Date(profile.valid_from).getTime()
  if (Number.isNaN(from) || from > nowMs) return false
  if (!profile.valid_until) return true
  const until = new Date(profile.valid_until).getTime()
  return !Number.isNaN(until) && until >= nowMs
}

/** Estimate the discount an offer would give for a subtotal (clamped to it). */
export function estimateOfferDiscount(offer: AvailableOffer, subtotal: number): number {
  if (offer.type === 'free_shipping') return 0
  if (offer.type === 'bogo') {
    // Checkout computes BOGO from line items; treat a qualifying cart as "has savings".
    return subtotal > 0 ? Math.round(subtotal * 0.01 * 100) / 100 : 0
  }
  let amount = offer.type === 'percentage' ? (subtotal * offer.value) / 100 : offer.value
  if (offer.maxDiscountAmount && offer.maxDiscountAmount > 0 && amount > offer.maxDiscountAmount) {
    amount = offer.maxDiscountAmount
  }
  if (amount > subtotal) amount = subtotal
  if (amount < 0) amount = 0
  return Math.round(amount * 100) / 100
}

/** Subtotal used for eligibility / savings hints (shop- and item-scoped). */
export function offerEligibleSubtotal(
  offer: Pick<AvailableOffer, 'shopId' | 'appliesTo' | 'eligibleListingIds'>,
  cartSubtotal: number,
  items: CartOfferItem[],
): number {
  let scoped = items
  if (offer.shopId) {
    scoped = scoped.filter((item) => item.shop_id === offer.shopId)
  }
  if (offer.eligibleListingIds != null) {
    if (offer.eligibleListingIds.length === 0) return 0
    const listingSet = new Set(offer.eligibleListingIds)
    scoped = scoped.filter((item) => listingSet.has(item.listing_id))
  }
  if (scoped.length === 0) return 0
  if (offer.shopId || offer.appliesTo === 'item') {
    return scoped.reduce((sum, item) => sum + toNumber(item.total_price), 0)
  }
  return cartSubtotal
}

export function isOfferEligible(
  offer: AvailableOffer,
  cartSubtotal: number,
  items: CartOfferItem[],
  buyerUserType?: string | null,
): boolean {
  if (offer.eligibleUserTypes?.length && buyerUserType) {
    const types = offer.eligibleUserTypes
    if (!types.includes('all') && !types.includes(buyerUserType)) return false
  } else if (offer.eligibleUserTypes?.length && !offer.eligibleUserTypes.includes('all') && !buyerUserType) {
    return false
  }
  const eligible = offerEligibleSubtotal(offer, cartSubtotal, items)
  if (eligible <= 0 && offer.type !== 'bogo' && offer.type !== 'free_shipping') return false
  if (offer.minOrderAmount != null && eligible < offer.minOrderAmount && offer.type !== 'bogo') {
    return false
  }
  if (offer.type === 'free_shipping') return eligible > 0 || cartSubtotal > 0
  if (offer.type === 'bogo') return cartSubtotal > 0
  return estimateOfferDiscount(offer, eligible) > 0
}

/** Keep only offers the current cart selection can apply (matches checkout rules). */
export function filterEligibleOffers(
  offers: AvailableOffer[],
  cartSubtotal: number,
  items: CartOfferItem[],
  buyerUserType?: string | null,
): AvailableOffer[] {
  return offers.filter((offer) => isOfferEligible(offer, cartSubtotal, items, buyerUserType))
}

/**
 * Pure best-offer pick (no network). Used by auto-apply and unit tests.
 */
export function pickBestOffer(options: {
  offers: AvailableOffer[]
  subtotal: number
  items?: CartOfferItem[]
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
