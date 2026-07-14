import { supabase } from '~/lib/supabase/client'
import type { Tables } from '~/lib/supabase'
import { formatCurrency } from '~/lib/format'

import { applyCartDiscount, removeCartDiscount, type CartRow } from './cart'

export type DiscountProfile = Tables<'discount_profiles'>

export type DiscountType = 'percentage' | 'fixed'

/** A publicly-applicable coupon shown in the "available offers" list. */
export type AvailableOffer = {
  id: string
  code: string
  name: string
  description: string | null
  type: DiscountType
  value: number
  minOrderAmount: number | null
  maxDiscountAmount: number | null
  validUntil: string | null
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

  const { data, error } = await supabase
    .from('discount_profiles')
    .select('*')
    .ilike('discount_code', trimmed)
    .order('valid_from', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) return null
  return data[0]
}

export type ApplyCouponResult = {
  cart: CartRow | null
  error: string | null
  discountAmount?: number
}

/**
 * Validate a coupon code against the current cart and, if valid, apply it.
 * Validation that the DB RPC skips (min order, usage limit, effective amount)
 * happens here; RLS handles active/validity/shop checks.
 */
export async function applyCouponCode(options: {
  cartId: string
  code: string
  subtotal: number
  currency: string
}): Promise<ApplyCouponResult> {
  const trimmed = options.code.trim()
  if (!trimmed) return { cart: null, error: 'Enter a coupon code.' }

  const profile = await fetchCouponByCode(trimmed)
  if (!profile) {
    return { cart: null, error: 'This coupon is invalid or has expired.' }
  }

  const minOrder = profile.min_order_amount == null ? null : toNumber(profile.min_order_amount)
  if (minOrder != null && options.subtotal < minOrder) {
    return {
      cart: null,
      error: `Spend at least ${formatCurrency(minOrder, options.currency)} to use this coupon.`,
    }
  }

  if (usageExhausted(profile)) {
    return { cart: null, error: 'This coupon has reached its usage limit.' }
  }

  const amount = computeDiscountAmount(profile, options.subtotal)
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

/**
 * Fetch order-level coupons the customer can apply. RLS keeps this to active,
 * in-window offers. Deduped by code (newest wins) and usage-exhausted ones
 * dropped, sorted so the easiest-to-qualify offers surface first.
 */
export async function fetchAvailableOffers(options?: {
  /** Scope to a shop's own coupons plus platform-wide ones. Omit for all. */
  shopId?: string | null
}): Promise<AvailableOffer[]> {
  let query = supabase
    .from('discount_profiles')
    .select(
      'id, discount_code, discount_name, description, discount_type, discount_value, min_order_amount, max_discount_amount, valid_until, valid_from, max_uses_total, total_uses',
    )
    .eq('applies_to', 'order')
    .not('discount_code', 'is', null)

  if (options?.shopId) {
    query = query.or(`shop_id.is.null,shop_id.eq.${options.shopId}`)
  }

  const { data, error } = await query.order('valid_from', { ascending: false }).limit(50)

  if (error || !data) return []

  const seen = new Set<string>()
  const offers: AvailableOffer[] = []

  for (const row of data) {
    const code = (row.discount_code ?? '').trim()
    if (!code) continue
    const key = code.toUpperCase()
    if (seen.has(key)) continue
    if (usageExhausted(row)) continue
    seen.add(key)

    offers.push({
      id: row.id,
      code,
      name: row.discount_name,
      description: row.description,
      type: row.discount_type === 'percentage' ? 'percentage' : 'fixed',
      value: toNumber(row.discount_value),
      minOrderAmount: row.min_order_amount == null ? null : toNumber(row.min_order_amount),
      maxDiscountAmount:
        row.max_discount_amount == null ? null : toNumber(row.max_discount_amount),
      validUntil: row.valid_until,
    })
  }

  offers.sort((a, b) => (a.minOrderAmount ?? 0) - (b.minOrderAmount ?? 0))
  return offers
}

/**
 * Fetch a specific shop's own coupon codes (shop-level offers, Etsy-style).
 * Only rows with a non-null shop_id matching this shop are returned, so platform
 * offers are excluded. RLS keeps these to active, in-window coupons.
 */
export async function fetchShopCoupons(shopId: string): Promise<AvailableOffer[]> {
  if (!shopId) return []

  const { data, error } = await supabase
    .from('discount_profiles')
    .select(
      'id, discount_code, discount_name, description, discount_type, discount_value, min_order_amount, max_discount_amount, valid_until, valid_from, max_uses_total, total_uses',
    )
    .eq('applies_to', 'order')
    .eq('shop_id', shopId)
    .not('discount_code', 'is', null)
    .order('valid_from', { ascending: false })
    .limit(20)

  if (error || !data) return []

  const seen = new Set<string>()
  const offers: AvailableOffer[] = []
  for (const row of data) {
    const code = (row.discount_code ?? '').trim()
    if (!code) continue
    const key = code.toUpperCase()
    if (seen.has(key)) continue
    if (usageExhausted(row)) continue
    seen.add(key)
    offers.push({
      id: row.id,
      code,
      name: row.discount_name,
      description: row.description,
      type: row.discount_type === 'percentage' ? 'percentage' : 'fixed',
      value: toNumber(row.discount_value),
      minOrderAmount: row.min_order_amount == null ? null : toNumber(row.min_order_amount),
      maxDiscountAmount:
        row.max_discount_amount == null ? null : toNumber(row.max_discount_amount),
      validUntil: row.valid_until,
    })
  }
  offers.sort((a, b) => (a.minOrderAmount ?? 0) - (b.minOrderAmount ?? 0))
  return offers
}

/**
 * Re-validate an applied discount against the cart's current subtotal (called
 * after quantity/remove edits). Percentage coupons are recomputed, coupons that
 * fall below their minimum order or no longer produce a discount are dropped.
 * Returns true when the cart's discount changed and should be reloaded.
 */
export async function reconcileCartDiscount(cart: CartRow): Promise<boolean> {
  if (!cart.applied_discount_id) return false

  const { data: profile, error } = await supabase
    .from('discount_profiles')
    .select('*')
    .eq('id', cart.applied_discount_id)
    .maybeSingle()

  if (error) return false

  // Profile disappeared or expired (RLS-filtered) — drop it.
  if (!profile) {
    await removeCartDiscount(cart.id)
    return true
  }

  const minOrder = profile.min_order_amount == null ? null : toNumber(profile.min_order_amount)
  if (minOrder != null && cart.items_subtotal < minOrder) {
    await removeCartDiscount(cart.id)
    return true
  }

  const nextAmount = computeDiscountAmount(profile, cart.items_subtotal)
  if (nextAmount <= 0) {
    await removeCartDiscount(cart.id)
    return true
  }

  const currentAmount = cart.discount_amount ?? 0
  if (Math.abs(nextAmount - currentAmount) < 0.005) return false

  await applyCartDiscount({ cartId: cart.id, profileId: profile.id, amount: nextAmount })
  return true
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

export type BestOfferResult = {
  applied: boolean
  offer?: AvailableOffer
  amount?: number
  error?: string | null
}

/**
 * Find the highest-value eligible offer for the current subtotal and apply it
 * automatically (marketplace-style). Only used when no coupon is applied.
 */
export async function autoApplyBestOffer(options: {
  cartId: string
  subtotal: number
  shopId?: string | null
}): Promise<BestOfferResult> {
  if (options.subtotal <= 0) return { applied: false }

  const offers = await fetchAvailableOffers({ shopId: options.shopId })

  let best: AvailableOffer | null = null
  let bestAmount = 0
  for (const offer of offers) {
    if (offer.minOrderAmount != null && options.subtotal < offer.minOrderAmount) continue
    const amount = estimateOfferDiscount(offer, options.subtotal)
    if (amount > bestAmount) {
      best = offer
      bestAmount = amount
    }
  }

  if (!best || bestAmount <= 0) return { applied: false }

  const { error } = await applyCartDiscount({
    cartId: options.cartId,
    profileId: best.id,
    amount: bestAmount,
  })

  if (error) return { applied: false, error }
  return { applied: true, offer: best, amount: bestAmount }
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
