import { supabase } from '~/lib/supabase/client'
import type { Tables } from '~/lib/supabase'
import { formatCurrency } from '~/lib/format'

import { applyCartDiscount, removeCartDiscount, type CartRow } from '~/commerce/lib/cart'
import {
  filterEligibleOffers,
  isDiscountProfileActive,
  offerEligibleSubtotal,
  pickBestOffer,
  type AvailableOffer,
  type CartOfferItem,
} from '~/commerce/lib/offer-utils'

export type { AvailableOffer, CartOfferItem } from './offer-utils'
export {
  estimateOfferDiscount,
  filterEligibleOffers,
  isDiscountProfileActive,
  isOfferEligible,
  offerEligibleSubtotal,
  pickBestOffer,
} from '~/commerce/lib/offer-utils'

export type DiscountProfile = Tables<'discount_profiles'>

export type DiscountType = 'percentage' | 'fixed'

export type CartOfferFetchContext = {
  /** Selected-line subtotal (must match checkout selection). */
  subtotal: number
  items: CartOfferItem[]
}

/** Map cart rows to offer-eligibility lines (selected items only). */
export function toCartOfferItems(
  items: Array<{
    shop_id: string | null
    listing_id: string
    total_price?: number | string | null
    unit_price?: number
    quantity?: number
  }>,
): CartOfferItem[] {
  return items.map((item) => ({
    shop_id: item.shop_id,
    listing_id: item.listing_id,
    total_price:
      item.total_price ??
      (item.unit_price != null && item.quantity != null ? item.unit_price * item.quantity : 0),
  }))
}

function selectedSubtotalFromItems(items: CartOfferItem[]): number {
  return items.reduce((sum, item) => sum + toNumber(item.total_price), 0)
}

type DiscountLike = {
  discount_type: string
  discount_value: number | string
  max_discount_amount: number | string | null
}

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0
  const parsed = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Compute the discount amount for a profile against a subtotal. Mirrors the DB
 * calculation (percentage capped at max_discount_amount, else fixed) but also
 * clamps to the subtotal so the order total can never go negative.
 */
export function computeDiscountAmount(profile: DiscountLike, subtotal: number): number {
  const value = toNumber(profile.discount_value)
  let amount = profile.discount_type === 'percentage' ? (subtotal * value) / 100 : value

  const cap = profile.max_discount_amount == null ? null : toNumber(profile.max_discount_amount)
  if (cap != null && cap > 0 && amount > cap) {
    amount = cap
  }
  if (amount > subtotal) amount = subtotal
  if (amount < 0) amount = 0

  return Math.round(amount * 100) / 100
}

function checkoutEligibleSubtotalForProfile(
  profile: Pick<DiscountProfile, 'shop_id' | 'eligible_listings'>,
  items: CartOfferItem[],
): number {
  let scoped = items
  if (profile.shop_id) {
    scoped = scoped.filter((item) => item.shop_id === profile.shop_id)
  }
  if (profile.eligible_listings != null) {
    const allowed = new Set(profile.eligible_listings.filter(Boolean))
    scoped = scoped.filter((item) => allowed.has(item.listing_id))
  }
  if (!scoped.length) return 0
  return scoped.reduce((sum, item) => sum + toNumber(item.total_price), 0)
}

/**
 * Drop or refresh the cart coupon when selected lines no longer qualify (checkout parity).
 * Returns true when the discount was removed or updated.
 */
export async function ensureCartDiscountValidForCheckout(
  cart: CartRow,
  items: CartOfferItem[],
): Promise<{ removed: boolean; updated: boolean }> {
  if (!cart.applied_discount_id) return { removed: false, updated: false }
  const changed = await reconcileCartDiscount(cart, items)
  return { removed: changed, updated: changed }
}

/** True when a coupon has a real positive total-usage cap that's been reached. */
function usageExhausted(profile: {
  max_uses_total: number | null
  total_uses: number | null
}): boolean {
  const max = profile.max_uses_total
  // Ignore null / non-positive caps (some rows carry bad data like -3).
  if (max == null || max <= 0) return false
  return (profile.total_uses ?? 0) >= max
}

/**
 * Look up an active coupon by code. RLS already restricts results to active
 * profiles inside their validity window for active shops, so anything returned
 * is time-valid. Codes are not guaranteed unique, so we take the newest match.
 */
export async function fetchCouponByCode(code: string): Promise<DiscountProfile | null> {
  const trimmed = code.trim()
  if (!trimmed) return null

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('discount_profiles')
    .select('*')
    .ilike('discount_code', trimmed)
    .eq('is_active', true)
    .lte('valid_from', now)
    .or(`valid_until.is.null,valid_until.gte.${now}`)
    .order('valid_from', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) return null
  const profile = data[0]
  if (!isDiscountProfileActive(profile)) return null
  return profile
}

export type ApplyCouponResult = {
  cart: CartRow | null
  error: string | null
  discountAmount?: number
}

/**
 * Validate a coupon code against the current cart and, if valid, apply it.
 * Shop-scoped coupons are checked against that shop's cart subtotal only.
 */
export async function applyCouponCode(options: {
  cartId: string
  code: string
  subtotal: number
  currency: string
  /** Cart line items — pass selected lines only (same as checkout). */
  items?: CartOfferItem[]
}): Promise<ApplyCouponResult> {
  const trimmed = options.code.trim()
  if (!trimmed) return { cart: null, error: 'Enter a coupon code.' }

  const profile = await fetchCouponByCode(trimmed)
  if (!profile) {
    return { cart: null, error: 'This coupon is invalid or has expired.' }
  }

  if (usageExhausted(profile)) {
    return { cart: null, error: 'This coupon has reached its usage limit.' }
  }

  const cartItems = options.items ?? []
  const cartSubtotal = cartItems.length
    ? selectedSubtotalFromItems(cartItems)
    : options.subtotal

  if (cartSubtotal <= 0) {
    return { cart: null, error: 'Select items in your cart to use this coupon.' }
  }

  const shopId = profile.shop_id

  if (profile.applies_to === 'item' && profile.eligible_listings?.length === 0) {
    return { cart: null, error: "This coupon doesn't apply to any items in your cart." }
  }

  let eligibleSubtotal = checkoutEligibleSubtotalForProfile(profile, cartItems)

  if (eligibleSubtotal <= 0) {
    return {
      cart: null,
      error:
        profile.applies_to === 'item'
          ? 'Add the eligible product to your cart to use this coupon.'
          : shopId
            ? 'This coupon is only valid for products from that shop. Add them to your cart first.'
            : "This coupon doesn't apply to your cart.",
    }
  }

  const minOrder = profile.min_order_amount == null ? null : toNumber(profile.min_order_amount)
  if (minOrder != null && eligibleSubtotal < minOrder) {
    return {
      cart: null,
      error: `Spend at least ${formatCurrency(minOrder, options.currency)} on eligible items to use this coupon.`,
    }
  }

  const amount = computeDiscountAmount(profile, eligibleSubtotal)
  if (amount <= 0) {
    return { cart: null, error: "This coupon doesn't apply to your cart." }
  }

  const { cart, error } = await applyCartDiscount({
    cartId: options.cartId,
    profileId: profile.id,
    amount,
  })

  if (error) return { cart: null, error }
  return { cart, error: null, discountAmount: amount }
}

type OfferRow = {
  id: string
  discount_code: string | null
  discount_name: string
  description: string | null
  discount_type: string
  discount_value: number | string
  min_order_amount: number | string | null
  max_discount_amount: number | string | null
  valid_from: string
  valid_until: string | null
  is_active: boolean
  max_uses_total: number | null
  total_uses: number | null
  shop_id: string | null
  applies_to: string
  eligible_listings: string[] | null
}

function rowToOffer(row: OfferRow): AvailableOffer {
  const appliesTo = row.applies_to === 'item' ? 'item' : 'order'
  const eligibleListingIds =
    appliesTo === 'item'
      ? row.eligible_listings != null
        ? row.eligible_listings.filter(Boolean)
        : null
      : null

  return {
    id: row.id,
    code: (row.discount_code ?? '').trim(),
    name: row.discount_name,
    description: row.description,
    type: row.discount_type === 'percentage' ? 'percentage' : 'fixed',
    value: toNumber(row.discount_value),
    minOrderAmount: row.min_order_amount == null ? null : toNumber(row.min_order_amount),
    maxDiscountAmount:
      row.max_discount_amount == null ? null : toNumber(row.max_discount_amount),
    validUntil: row.valid_until,
    shopId: row.shop_id,
    appliesTo,
    eligibleListingIds,
  }
}

function mapOfferRows(
  data: OfferRow[],
  listingIdsByDiscount?: Map<string, string[]>,
): AvailableOffer[] {
  const seen = new Set<string>()
  const offers: AvailableOffer[] = []

  for (const row of data) {
    const code = (row.discount_code ?? '').trim()
    if (!code) continue
    const key = code.toUpperCase()
    if (seen.has(key)) continue
    if (!isDiscountProfileActive(row)) continue
    if (usageExhausted(row)) continue

    const offer = rowToOffer(row)
    if (offer.appliesTo === 'item' && offer.eligibleListingIds?.length === 0) continue
    if (offer.appliesTo === 'item' && listingIdsByDiscount) {
      const linked = listingIdsByDiscount.get(row.id) ?? []
      if (offer.eligibleListingIds != null) {
        const allowed = new Set(offer.eligibleListingIds)
        if (!linked.some((id) => allowed.has(id))) continue
      } else if (!linked.length) {
        continue
      }
    }

    seen.add(key)
    offers.push(offer)
  }

  offers.sort((a, b) => (a.minOrderAmount ?? 0) - (b.minOrderAmount ?? 0))
  return offers
}

async function fetchItemOffersForListings(options: {
  shopId?: string | null
  shopIds?: string[] | null
  listingIds: string[]
}): Promise<AvailableOffer[]> {
  const listingIds = [...new Set(options.listingIds.filter(Boolean))]
  if (!listingIds.length) return []

  const { data: links, error: linkError } = await supabase
    .from('listing_discounts')
    .select('listing_id, discount_profile_id')
    .in('listing_id', listingIds)

  if (linkError || !links?.length) return []

  const listingIdsByDiscount = new Map<string, string[]>()
  for (const link of links) {
    const existing = listingIdsByDiscount.get(link.discount_profile_id) ?? []
    existing.push(link.listing_id)
    listingIdsByDiscount.set(link.discount_profile_id, existing)
  }

  const profileIds = [...listingIdsByDiscount.keys()]
  if (!profileIds.length) return []

  const now = new Date().toISOString()
  let query = supabase
    .from('discount_profiles')
    .select(OFFER_SELECT)
    .in('id', profileIds)
    .eq('applies_to', 'item')
    .eq('is_active', true)
    .lte('valid_from', now)
    .or(`valid_until.is.null,valid_until.gte.${now}`)
    .not('discount_code', 'is', null)

  if (options.shopId) {
    query = query.eq('shop_id', options.shopId)
  } else if (options.shopIds?.length) {
    const unique = [...new Set(options.shopIds.filter(Boolean))]
    const shopClause = unique.map((id) => `shop_id.eq.${id}`).join(',')
    query = query.or(`shop_id.is.null,${shopClause}`)
  }

  const { data, error } = await query.order('valid_from', { ascending: false }).limit(50)
  if (error || !data) return []

  return mapOfferRows(data as OfferRow[], listingIdsByDiscount)
}

function mergeOffers(...groups: AvailableOffer[][]): AvailableOffer[] {
  const byCode = new Map<string, AvailableOffer>()
  for (const group of groups) {
    for (const offer of group) {
      const key = offer.code.toUpperCase()
      if (!byCode.has(key)) byCode.set(key, offer)
    }
  }
  return [...byCode.values()].sort((a, b) => (a.minOrderAmount ?? 0) - (b.minOrderAmount ?? 0))
}

const OFFER_SELECT =
  'id, discount_code, discount_name, description, discount_type, discount_value, min_order_amount, max_discount_amount, valid_from, valid_until, is_active, max_uses_total, total_uses, shop_id, applies_to, eligible_listings'

/**
 * Fetch coupons the customer can apply (order-level + item-level when listingIds given).
 *
 * Scoping rules (marketplace):
 * - No options → platform-wide order coupons only. Used by home "Offers for you".
 * - `shopId` → that shop's coupons. Used on shop + product pages.
 * - `shopIds` + `listingIds` → platform + shop order codes, plus item codes linked to cart listings.
 * - `cartContext` → when set, only returns offers the selected cart lines can use now (min order, scope).
 */
export async function fetchAvailableOffers(options?: {
  shopId?: string | null
  shopIds?: string[] | null
  listingIds?: string[] | null
  cartContext?: CartOfferFetchContext | null
}): Promise<AvailableOffer[]> {
  const now = new Date().toISOString()
  let query = supabase
    .from('discount_profiles')
    .select(OFFER_SELECT)
    .eq('applies_to', 'order')
    .eq('is_active', true)
    .lte('valid_from', now)
    .or(`valid_until.is.null,valid_until.gte.${now}`)
    .not('discount_code', 'is', null)

  if (options?.shopId) {
    // Product / shop page — only that seller's own offers.
    query = query.eq('shop_id', options.shopId)
  } else if (options?.shopIds && options.shopIds.length > 0) {
    const unique = [...new Set(options.shopIds.filter(Boolean))]
    const shopClause = unique.map((id) => `shop_id.eq.${id}`).join(',')
    query = query.or(`shop_id.is.null,${shopClause}`)
  } else {
    // Home / global rail — never surface another shop's private coupons.
    query = query.is('shop_id', null)
  }

  const { data, error } = await query.order('valid_from', { ascending: false }).limit(50)

  if (error || !data) return []

  const orderOffers = mapOfferRows(data as OfferRow[])
  const listingIds =
    options?.cartContext?.items.map((item) => item.listing_id) ??
    options?.listingIds?.filter(Boolean) ??
    []

  let merged = orderOffers
  if (listingIds.length) {
    const itemOffers = await fetchItemOffersForListings({
      shopId: options?.shopId,
      shopIds: options?.shopIds,
      listingIds,
    })
    merged = mergeOffers(orderOffers, itemOffers)
  }

  if (options?.cartContext) {
    const { subtotal, items } = options.cartContext
    return filterEligibleOffers(merged, subtotal, items)
  }

  return merged
}

/**
 * Fetch a shop's coupon codes for cart / shop pages (order + item-level for cart listings).
 */
export async function fetchShopCoupons(
  shopId: string,
  listingIds?: string[] | null,
  cartContext?: CartOfferFetchContext | null,
): Promise<AvailableOffer[]> {
  if (!shopId) return []
  return fetchAvailableOffers({ shopId, listingIds, cartContext })
}

/**
 * Re-validate an applied discount against the cart's current subtotal (called
 * after quantity/remove edits). Percentage coupons are recomputed, coupons that
 * fall below their minimum order or no longer produce a discount are dropped.
 * Shop coupons use that shop's line subtotal only.
 * Returns true when the cart's discount changed and should be reloaded.
 */
export async function reconcileCartDiscount(
  cart: CartRow,
  items?: CartOfferItem[],
): Promise<boolean> {
  if (!cart.applied_discount_id) return false

  const { data: profile, error } = await supabase
    .from('discount_profiles')
    .select('*')
    .eq('id', cart.applied_discount_id)
    .maybeSingle()

  if (error) return false

  // Profile disappeared, inactive, or expired — drop it.
  if (!profile || !isDiscountProfileActive(profile)) {
    await removeCartDiscount(cart.id)
    return true
  }

  if (profile.applies_to === 'item' && profile.eligible_listings?.length === 0) {
    await removeCartDiscount(cart.id)
    return true
  }

  const cartItems = items ?? []
  const cartSubtotal = cartItems.length
    ? selectedSubtotalFromItems(cartItems)
    : cart.items_subtotal

  if (cartSubtotal <= 0) {
    await removeCartDiscount(cart.id)
    return true
  }

  let eligibleSubtotal = checkoutEligibleSubtotalForProfile(profile, cartItems)

  if (eligibleSubtotal <= 0) {
    await removeCartDiscount(cart.id)
    return true
  }

  const minOrder = profile.min_order_amount == null ? null : toNumber(profile.min_order_amount)
  if (minOrder != null && eligibleSubtotal < minOrder) {
    await removeCartDiscount(cart.id)
    return true
  }

  const nextAmount = computeDiscountAmount(profile, eligibleSubtotal)
  if (nextAmount <= 0) {
    await removeCartDiscount(cart.id)
    return true
  }

  const currentAmount = cart.discount_amount ?? 0
  if (Math.abs(nextAmount - currentAmount) < 0.005) return false

  await applyCartDiscount({ cartId: cart.id, profileId: profile.id, amount: nextAmount })
  return true
}

export type BestOfferResult = {
  applied: boolean
  offer?: AvailableOffer
  amount?: number
  error?: string | null
}

/**
 * Find the highest-value eligible offer for the current cart and apply it
 * automatically (marketplace). Only used when no coupon is applied.
 * Shop coupons are scored against that shop's line subtotal only.
 */
export async function autoApplyBestOffer(options: {
  cartId: string
  subtotal: number
  shopId?: string | null
  shopIds?: string[] | null
  listingIds?: string[] | null
  items?: CartOfferItem[]
}): Promise<BestOfferResult> {
  if (options.subtotal <= 0) return { applied: false }

  const cartItems = options.items ?? []
  const listingIds =
    options.listingIds ?? cartItems.map((item) => item.listing_id).filter(Boolean)

  const offers = options.shopId
    ? await fetchAvailableOffers({
        shopId: options.shopId,
        listingIds,
        cartContext: { subtotal: options.subtotal, items: cartItems },
      })
    : await fetchAvailableOffers({
        shopIds: options.shopIds ?? null,
        listingIds,
        cartContext: { subtotal: options.subtotal, items: cartItems },
      })

  const best = pickBestOffer({
    offers,
    subtotal: options.subtotal,
    items: options.items,
  })

  if (!best) return { applied: false }

  const { error } = await applyCartDiscount({
    cartId: options.cartId,
    profileId: best.offer.id,
    amount: best.amount,
  })

  if (error) return { applied: false, error }
  return { applied: true, offer: best.offer, amount: best.amount }
}

/** Short human label like "10% OFF" or "₹150 OFF" for an offer badge. */
export function offerBadgeLabel(offer: AvailableOffer, currency: string): string {
  if (offer.type === 'percentage') {
    const capped = offer.maxDiscountAmount
      ? ` up to ${formatCurrency(offer.maxDiscountAmount, currency)}`
      : ''
    return `${offer.value % 1 === 0 ? offer.value : offer.value.toFixed(0)}% OFF${capped}`
  }
  return `${formatCurrency(offer.value, currency)} OFF`
}
