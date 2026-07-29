/**
 * Discount pure helpers — calculations, eligibility, formatting, query builders.
 *
 * Ported from legacy `discountUtils.js`.
 */

import {
  ALLOWED_POSTER_DIMENSIONS,
  APPLIES_TO,
  DEFAULT_DISCOUNT_CURRENCY,
  DISCOUNT_TYPES,
  DISCOUNT_USER_TYPES,
  DISCOUNT_VALIDATION,
} from '~/lib/discount/discount.constants'
import { DISCOUNT_ELIGIBILITY_ERRORS } from '~/lib/discount/discount.errors'
import type {
  BogoRule,
  BogoRuleInput,
  DiscountCartBreakdown,
  DiscountCartItem,
  DiscountFilterInput,
  DiscountPagination,
  DiscountProfile,
  DiscountStats,
  DiscountType,
} from '~/lib/discount/discount.type'

// Re-export for convenience in store/service layers.
export { DISCOUNT_ELIGIBILITY_ERRORS as DISCOUNT_UTILS_ERRORS }

// ============= POSTER =============

export function generatePosterSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, DISCOUNT_VALIDATION.POSTER_SLUG_MAX_LENGTH)
}

export type ImageDimensionValidation = {
  isValid: boolean
  width: number
  height: number
  message: string
}

/** Browser-only image dimension validation. */
export async function validateImageDimensions(
  file: File,
  allowedDimensions: readonly { width: number; height: number; label: string }[] = ALLOWED_POSTER_DIMENSIONS,
): Promise<ImageDimensionValidation> {
  if (typeof Image === 'undefined' || typeof URL === 'undefined') {
    return {
      isValid: false,
      width: 0,
      height: 0,
      message: 'Image validation is only available in a browser environment.',
    }
  }

  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      const { width, height } = img
      URL.revokeObjectURL(objectUrl)

      const isValid = allowedDimensions.some((dim) => dim.width === width && dim.height === height)

      resolve({
        isValid,
        width,
        height,
        message: isValid
          ? 'Valid dimensions'
          : `Invalid dimensions ${width}×${height}. Allowed: ${allowedDimensions.map((d) => d.label).join(', ')}`,
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({
        isValid: false,
        width: 0,
        height: 0,
        message: 'Failed to load image',
      })
    }

    img.src = objectUrl
  })
}

// ============= CODE / DEFAULT GENERATION =============

/** Auto-generate a discount code from a discount name (legacy DiscountForm behaviour). */
export function generateDiscountCodeFromName(discountName: string, maxLength = 20): string {
  if (!discountName?.trim()) return ''
  return discountName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, maxLength)
}

/** ISO datetime-local string for "valid from now" defaults. */
export function buildValidFromNowIso(): string {
  return new Date().toISOString()
}

/** ISO datetime-local slice for HTML datetime-local inputs. */
export function buildValidFromNowLocal(): string {
  return new Date().toISOString().slice(0, 16)
}

// ============= CALCULATION =============

export type DiscountCalculationContext = {
  order_total?: number
  shipping_amount?: number
  item_price?: number
  bogo_rule?: BogoRule | BogoRuleInput | null
  get_item_price?: number
}

export function calculateDiscountAmount(
  discount: Pick<DiscountProfile, 'discount_type' | 'discount_value' | 'max_discount_amount'>,
  context: DiscountCalculationContext = {},
): number {
  const { order_total = 0, shipping_amount = 0, item_price = 0 } = context
  let amount = 0
  const baseAmount = item_price || order_total

  switch (discount.discount_type) {
    case DISCOUNT_TYPES.PERCENTAGE:
      amount = (baseAmount * discount.discount_value) / 100
      if (discount.max_discount_amount) {
        amount = Math.min(amount, discount.max_discount_amount)
      }
      break
    case DISCOUNT_TYPES.FIXED:
      amount = Math.min(discount.discount_value, baseAmount)
      break
    case DISCOUNT_TYPES.FREE_SHIPPING:
      amount = shipping_amount
      break
    case DISCOUNT_TYPES.BOGO:
      if (context.bogo_rule && context.get_item_price != null) {
        const rule = context.bogo_rule
        const getDiscountValue = rule.get_discount_value ?? 100
        const getQuantity = rule.get_quantity ?? 1
        amount = ((context.get_item_price * getDiscountValue) / 100) * getQuantity
      }
      break
    default:
      amount = 0
  }

  return Math.round(amount * 100) / 100
}

export function calculateCartDiscount(
  discount: DiscountProfile,
  cartItems: DiscountCartItem[],
  cartTotal: number,
): DiscountCartBreakdown {
  if (discount.discount_type === DISCOUNT_TYPES.BOGO && discount.bogo_rule) {
    return calculateBogoCartDiscount(discount, cartItems)
  }

  let totalDiscount = 0
  const itemBreakdown: DiscountCartBreakdown['item_breakdown'] = []

  if (discount.applies_to === APPLIES_TO.ORDER) {
    totalDiscount = calculateDiscountAmount(discount, { order_total: cartTotal })

    cartItems.forEach((item) => {
      const itemTotal = item.price * item.quantity
      const itemDiscount = cartTotal > 0 ? (totalDiscount * itemTotal) / cartTotal : 0
      itemBreakdown.push({
        listing_id: item.listing_id,
        item_total: itemTotal,
        discount_amount: itemDiscount,
        final_price: itemTotal - itemDiscount,
        is_eligible: true,
      })
    })
  } else if (discount.applies_to === APPLIES_TO.ITEM) {
    cartItems.forEach((item) => {
      const itemTotal = item.price * item.quantity
      let itemDiscount = 0
      const isEligible = isItemEligible(item, discount)

      if (isEligible) {
        itemDiscount = calculateDiscountAmount(discount, {
          order_total: itemTotal,
          item_price: itemTotal,
        })
        totalDiscount += itemDiscount
      }

      itemBreakdown.push({
        listing_id: item.listing_id,
        item_total: itemTotal,
        discount_amount: itemDiscount,
        final_price: itemTotal - itemDiscount,
        is_eligible: isEligible,
      })
    })
  }

  return { total_discount: totalDiscount, item_breakdown: itemBreakdown }
}

export function calculateBogoCartDiscount(
  discount: DiscountProfile,
  cartItems: DiscountCartItem[],
): DiscountCartBreakdown {
  const bogoRule = discount.bogo_rule
  if (!bogoRule) {
    return { total_discount: 0, item_breakdown: [], is_bogo_eligible: false }
  }

  const {
    buy_listing_ids = [],
    buy_categories = [],
    buy_quantity = 1,
    get_listing_ids = [],
    get_categories = [],
    get_quantity = 1,
    get_discount_value = 100,
  } = bogoRule

  const buyByProduct = buy_listing_ids.length > 0
  const buyByCategory = buy_categories.length > 0
  const getByProduct = get_listing_ids.length > 0
  const getByCategory = get_categories.length > 0

  const buyMatchingItems = cartItems.filter((item) => {
    if (buyByProduct && buy_listing_ids.includes(item.listing_id)) return true
    if (buyByCategory && item.category_id && buy_categories.includes(item.category_id)) return true
    return false
  })

  const totalBuyQty = buyMatchingItems.reduce((sum, item) => sum + item.quantity, 0)
  if (totalBuyQty < buy_quantity) {
    return { total_discount: 0, item_breakdown: [], is_bogo_eligible: false }
  }

  const bogoTriggerCount = Math.floor(totalBuyQty / buy_quantity)

  const effectiveGetListings = getByProduct ? get_listing_ids : buyByProduct ? buy_listing_ids : []
  const effectiveGetCategories = getByCategory ? get_categories : buyByCategory ? buy_categories : []

  const getMatchingItems = cartItems.filter((item) => {
    if (effectiveGetListings.length > 0 && effectiveGetListings.includes(item.listing_id)) return true
    if (
      effectiveGetCategories.length > 0 &&
      item.category_id &&
      effectiveGetCategories.includes(item.category_id)
    ) {
      return true
    }
    return false
  })

  const sortedGetItems = [...getMatchingItems].sort((a, b) => a.price - b.price)

  let totalDiscount = 0
  let remainingGetQty = get_quantity * bogoTriggerCount
  const itemBreakdown: DiscountCartBreakdown['item_breakdown'] = []
  const processedListingIds = new Set<string>()

  for (const item of sortedGetItems) {
    if (remainingGetQty <= 0) break

    const discountableQty = Math.min(item.quantity, remainingGetQty)
    const itemDiscount = ((item.price * get_discount_value) / 100) * discountableQty

    totalDiscount += itemDiscount
    remainingGetQty -= discountableQty
    processedListingIds.add(item.listing_id)

    itemBreakdown.push({
      listing_id: item.listing_id,
      item_total: item.price * item.quantity,
      discount_amount: Math.round(itemDiscount * 100) / 100,
      final_price: item.price * item.quantity - itemDiscount,
      is_eligible: true,
      is_bogo_get_item: true,
      discounted_quantity: discountableQty,
    })
  }

  cartItems.forEach((item) => {
    if (processedListingIds.has(item.listing_id)) return

    const isBuyItem = buyByProduct
      ? buy_listing_ids.includes(item.listing_id)
      : buyByCategory && item.category_id
        ? buy_categories.includes(item.category_id)
        : false

    itemBreakdown.push({
      listing_id: item.listing_id,
      item_total: item.price * item.quantity,
      discount_amount: 0,
      final_price: item.price * item.quantity,
      is_eligible: isBuyItem,
      is_bogo_get_item: false,
    })
  })

  return {
    total_discount: Math.round(totalDiscount * 100) / 100,
    item_breakdown: itemBreakdown,
    is_bogo_eligible: true,
    bogo_trigger_count: bogoTriggerCount,
  }
}

// ============= ELIGIBILITY =============

export function isDiscountValid(discount: DiscountProfile | null | undefined): {
  valid: boolean
  reason: string | null
} {
  if (!discount) {
    return { valid: false, reason: DISCOUNT_ELIGIBILITY_ERRORS.INVALID_CODE }
  }
  if (!discount.is_active) {
    return { valid: false, reason: DISCOUNT_ELIGIBILITY_ERRORS.INACTIVE }
  }

  const now = new Date().toISOString()

  if (discount.valid_from && discount.valid_from > now) {
    return { valid: false, reason: DISCOUNT_ELIGIBILITY_ERRORS.NOT_STARTED }
  }
  if (discount.valid_until && discount.valid_until < now) {
    return { valid: false, reason: DISCOUNT_ELIGIBILITY_ERRORS.EXPIRED }
  }
  if (discount.max_uses_total && (discount.total_uses ?? 0) >= discount.max_uses_total) {
    return { valid: false, reason: DISCOUNT_ELIGIBILITY_ERRORS.USAGE_EXCEEDED }
  }

  return { valid: true, reason: null }
}

export function isItemEligible(
  item: Pick<DiscountCartItem, 'listing_id' | 'category' | 'category_id'>,
  discount: Pick<DiscountProfile, 'eligible_listings' | 'eligible_categories'>,
): boolean {
  if (discount.eligible_listings?.length) {
    return discount.eligible_listings.includes(item.listing_id)
  }
  if (discount.eligible_categories?.length) {
    const category = item.category ?? item.category_id
    return category ? discount.eligible_categories.includes(category) : false
  }
  return true
}

export function isUserTypeEligible(
  userType: string | null | undefined,
  eligibleTypes: string[] | null | undefined,
): boolean {
  if (!eligibleTypes?.length) return true
  if (eligibleTypes.includes(DISCOUNT_USER_TYPES.ALL)) return true
  return !!userType && eligibleTypes.includes(userType)
}

export function checkMinimumOrder(
  orderTotal: number,
  minAmount: number | null | undefined,
): { met: boolean; shortfall: number } {
  if (!minAmount) return { met: true, shortfall: 0 }
  const met = orderTotal >= minAmount
  return { met, shortfall: met ? 0 : minAmount - orderTotal }
}

// ============= DATA PREP =============

export function prepareDiscountInsertData(
  discountData: Record<string, unknown> & {
    shop_id?: string | null
    discount_name: string
    discount_type: DiscountType
  },
) {
  return {
    shop_id: discountData.shop_id ?? null,
    discount_name: String(discountData.discount_name).trim(),
    discount_code: discountData.discount_code
      ? String(discountData.discount_code).trim().toUpperCase()
      : null,
    description: discountData.description ? String(discountData.description).trim() : null,
    discount_type: discountData.discount_type,
    discount_value: parseFloat(String(discountData.discount_value)),
    max_discount_amount: discountData.max_discount_amount
      ? parseFloat(String(discountData.max_discount_amount))
      : null,
    applies_to: discountData.applies_to,
    min_order_amount: discountData.min_order_amount
      ? parseFloat(String(discountData.min_order_amount))
      : null,
    max_uses_total: discountData.max_uses_total ?? null,
    max_uses_per_customer: discountData.max_uses_per_customer ?? 1,
    eligible_user_types: discountData.eligible_user_types ?? [DISCOUNT_USER_TYPES.ALL],
    eligible_categories: discountData.eligible_categories ?? null,
    eligible_listings: discountData.eligible_listings ?? null,
    is_active: discountData.is_active !== false,
    valid_from: discountData.valid_from ?? new Date().toISOString(),
    valid_until: discountData.valid_until ?? null,
    discount_currency: discountData.discount_currency ?? DEFAULT_DISCOUNT_CURRENCY,
    total_uses: 0,
  }
}

export function prepareDiscountUpdateData(updateData: Record<string, unknown>) {
  const updates: Record<string, unknown> = {}

  if (updateData.discount_name !== undefined) {
    updates.discount_name = String(updateData.discount_name).trim()
  }
  if (updateData.discount_code !== undefined) {
    updates.discount_code = updateData.discount_code
      ? String(updateData.discount_code).trim().toUpperCase()
      : null
  }
  if (updateData.description !== undefined) {
    updates.description = updateData.description ? String(updateData.description).trim() : null
  }
  if (updateData.discount_value !== undefined) {
    updates.discount_value = parseFloat(String(updateData.discount_value))
  }
  if (updateData.max_discount_amount !== undefined) {
    updates.max_discount_amount = updateData.max_discount_amount
      ? parseFloat(String(updateData.max_discount_amount))
      : null
  }
  if (updateData.min_order_amount !== undefined) {
    updates.min_order_amount = updateData.min_order_amount
      ? parseFloat(String(updateData.min_order_amount))
      : null
  }
  if (updateData.max_uses_total !== undefined) {
    updates.max_uses_total = updateData.max_uses_total || null
  }
  if (updateData.max_uses_per_customer !== undefined) {
    updates.max_uses_per_customer = updateData.max_uses_per_customer || 1
  }
  if (updateData.eligible_user_types !== undefined) {
    updates.eligible_user_types = updateData.eligible_user_types
  }
  if (updateData.eligible_categories !== undefined) {
    updates.eligible_categories = updateData.eligible_categories
  }
  if (updateData.eligible_listings !== undefined) {
    updates.eligible_listings = updateData.eligible_listings
  }
  if (updateData.is_active !== undefined) {
    updates.is_active = updateData.is_active
  }
  if (updateData.valid_from !== undefined) {
    updates.valid_from = updateData.valid_from
  }
  if (updateData.valid_until !== undefined) {
    updates.valid_until = updateData.valid_until
  }

  updates.updated_at = new Date().toISOString()
  return updates
}

// ============= DISPLAY =============

export function formatDiscountDisplay(
  discount: DiscountProfile,
  itemPrice = 0,
  currencySymbol = '$',
): {
  display: string
  display_value: string
  amount: number
  code: string | null
  name: string
  description: string | null
  min_order: string | null
  valid_until: string
} {
  let displayValue = ''
  let discountAmount = 0

  switch (discount.discount_type) {
    case DISCOUNT_TYPES.PERCENTAGE:
      displayValue = `${discount.discount_value}% OFF`
      if (discount.max_discount_amount) {
        displayValue += ` (Max ${currencySymbol}${discount.max_discount_amount})`
      }
      if (itemPrice > 0) {
        discountAmount = (itemPrice * discount.discount_value) / 100
        if (discount.max_discount_amount) {
          discountAmount = Math.min(discountAmount, discount.max_discount_amount)
        }
      }
      break
    case DISCOUNT_TYPES.FIXED:
      displayValue = `${currencySymbol}${discount.discount_value} OFF`
      discountAmount = discount.discount_value
      break
    case DISCOUNT_TYPES.FREE_SHIPPING:
      displayValue = 'FREE SHIPPING'
      discountAmount = 0
      break
    case DISCOUNT_TYPES.BOGO:
      displayValue = discount.bogo_rule
        ? getBogoDescription(discount.bogo_rule)
        : 'BUY ONE GET ONE'
      discountAmount = 0
      break
    default:
      displayValue = 'DISCOUNT'
      discountAmount = 0
  }

  return {
    display: displayValue,
    display_value: displayValue,
    amount: discountAmount,
    code: discount.discount_code,
    name: discount.discount_name,
    description: discount.description,
    min_order: discount.min_order_amount
      ? `Min. order ${currencySymbol}${discount.min_order_amount}`
      : null,
    valid_until: discount.valid_until
      ? new Date(discount.valid_until).toLocaleDateString()
      : 'No expiry',
  }
}

export function getBogoDescription(
  bogoRule: BogoRule | BogoRuleInput,
  options: { categoryNames?: Record<string, string>; productNames?: Record<string, string> } = {},
): string {
  const {
    buy_listing_ids = [],
    buy_categories = [],
    buy_quantity = 1,
    get_listing_ids = [],
    get_categories = [],
    get_quantity = 1,
    get_discount_type = 'free',
    get_discount_value = 100,
  } = bogoRule

  const { categoryNames = {}, productNames = {} } = options

  let buyDesc = `Buy ${buy_quantity}`
  if (buy_listing_ids.length > 0) {
    const names = buy_listing_ids.map((id) => productNames[id] ?? 'product').slice(0, 2)
    buyDesc += ` ${names.join(', ')}${buy_listing_ids.length > 2 ? '...' : ''}`
  } else if (buy_categories.length > 0) {
    const names = buy_categories.map((id) => categoryNames[id] ?? 'category').slice(0, 2)
    buyDesc += ` from ${names.join(', ')}${buy_categories.length > 2 ? '...' : ''}`
  }

  let getDesc = `Get ${get_quantity}`
  const discountText =
    get_discount_type === 'free' || get_discount_value === 100
      ? 'FREE'
      : `at ${get_discount_value}% OFF`

  if (get_listing_ids.length > 0) {
    const names = get_listing_ids.map((id) => productNames[id] ?? 'product').slice(0, 2)
    getDesc += ` ${names.join(', ')} ${discountText}`
  } else if (get_categories.length > 0) {
    const names = get_categories.map((id) => categoryNames[id] ?? 'category').slice(0, 2)
    getDesc += ` from ${names.join(', ')} ${discountText}`
  } else {
    getDesc += ` ${discountText}`
  }

  return `${buyDesc} → ${getDesc}`
}

export function getDiscountSummary(
  discounts: Array<{ discount_amount?: number | null; discount_type?: string | null }>,
) {
  if (!discounts.length) {
    return { total_count: 0, total_amount: 0, average_amount: 0, by_type: {} as Record<string, { count: number; total: number }> }
  }

  const summary = {
    total_count: discounts.length,
    total_amount: 0,
    by_type: {} as Record<string, { count: number; total: number }>,
  }

  discounts.forEach((discount) => {
    const amount = parseFloat(String(discount.discount_amount ?? 0))
    summary.total_amount += amount

    const type = discount.discount_type ?? 'unknown'
    if (!summary.by_type[type]) {
      summary.by_type[type] = { count: 0, total: 0 }
    }
    summary.by_type[type].count++
    summary.by_type[type].total += amount
  })

  return {
    ...summary,
    average_amount: summary.total_amount / summary.total_count,
  }
}

// ============= QUERY BUILDERS =============

export function buildDiscountFilters(options: DiscountFilterInput) {
  const { active_only = false, include_expired = false, discount_type, applies_to, search } = options
  const filters: Record<string, unknown> = {}
  const now = new Date().toISOString()

  if (active_only) filters.is_active = true
  if (!include_expired) {
    filters.valid_from_lte = now
    filters.valid_until_or = `valid_until.is.null,valid_until.gte.${now}`
  }
  if (discount_type) filters.discount_type = discount_type
  if (applies_to) filters.applies_to = applies_to
  if (search?.trim()) {
    filters.search = `discount_name.ilike.%${search.trim()}%,discount_code.ilike.%${search.trim()}%`
  }

  return filters
}

export function buildPagination(page = 1, limit = 20) {
  const offset = (page - 1) * limit
  return { offset, limit, range: { from: offset, to: offset + limit - 1 } }
}

export function formatPaginationResponse(page: number, limit: number, total: number): DiscountPagination {
  return {
    page,
    limit,
    total,
    total_pages: total ? Math.ceil(total / limit) : 0,
    has_more: page * limit < total,
  }
}

// ============= NORMALIZATION / INDEX =============

export function normalizeDiscountRow<T extends DiscountProfile>(row: T): T {
  const bogoRules = row.bogo_rules
  const bogoRule = Array.isArray(bogoRules) ? bogoRules[0] ?? null : bogoRules ?? row.bogo_rule ?? null
  return { ...row, bogo_rule: bogoRule }
}

export function normalizeDiscountRows<T extends DiscountProfile>(rows: T[]): T[] {
  return rows.map(normalizeDiscountRow)
}

export function indexDiscountsById(discounts: DiscountProfile[]): Record<string, DiscountProfile> {
  return discounts.reduce<Record<string, DiscountProfile>>((acc, discount) => {
    acc[discount.id] = discount
    return acc
  }, {})
}

export function upsertDiscount(
  discounts: DiscountProfile[],
  discount: DiscountProfile,
): DiscountProfile[] {
  const index = discounts.findIndex((d) => d.id === discount.id)
  if (index === -1) return [discount, ...discounts]
  const next = [...discounts]
  next[index] = { ...next[index], ...discount }
  return next
}

export function removeDiscountById(discounts: DiscountProfile[], discountId: string): DiscountProfile[] {
  return discounts.filter((d) => d.id !== discountId)
}

export function replaceTempDiscount(
  discounts: DiscountProfile[],
  tempId: string,
  confirmed: DiscountProfile,
): DiscountProfile[] {
  return discounts.map((d) => (d.id === tempId ? confirmed : d))
}

export function buildOptimisticDiscount(
  tempId: string,
  input: Partial<DiscountProfile> & Pick<DiscountProfile, 'shop_id' | 'discount_name' | 'discount_type' | 'applies_to'>,
): DiscountProfile {
  const now = new Date().toISOString()
  return {
    id: tempId,
    shop_id: input.shop_id,
    discount_name: input.discount_name,
    description: input.description ?? null,
    discount_code: input.discount_code ?? null,
    discount_type: input.discount_type,
    discount_value: input.discount_value ?? 0,
    discount_currency: input.discount_currency ?? DEFAULT_DISCOUNT_CURRENCY,
    max_discount_amount: input.max_discount_amount ?? null,
    applies_to: input.applies_to,
    eligible_categories: input.eligible_categories ?? null,
    eligible_listings: input.eligible_listings ?? null,
    eligible_user_types: input.eligible_user_types ?? [DISCOUNT_USER_TYPES.ALL],
    event_offer_id: input.event_offer_id ?? null,
    is_active: input.is_active ?? true,
    max_uses_per_customer: input.max_uses_per_customer ?? 1,
    max_uses_total: input.max_uses_total ?? null,
    min_order_amount: input.min_order_amount ?? null,
    source: input.source ?? null,
    total_uses: input.total_uses ?? 0,
    valid_from: input.valid_from ?? now,
    valid_until: input.valid_until ?? null,
    discount_poster: input.discount_poster ?? null,
    created_at: now,
    updated_at: now,
    bogo_rule: input.bogo_rule ?? null,
    _optimistic: true,
  }
}

// ============= LOCAL SELECTORS =============

export function computeDiscountStats(discounts: DiscountProfile[]): DiscountStats {
  const now = new Date()
  return {
    total: discounts.length,
    active: discounts.filter((d) => d.is_active).length,
    inactive: discounts.filter((d) => !d.is_active).length,
    expired: discounts.filter((d) => d.valid_until && new Date(d.valid_until) < now).length,
    byType: {
      [DISCOUNT_TYPES.PERCENTAGE]: discounts.filter((d) => d.discount_type === DISCOUNT_TYPES.PERCENTAGE).length,
      [DISCOUNT_TYPES.FIXED]: discounts.filter((d) => d.discount_type === DISCOUNT_TYPES.FIXED).length,
      [DISCOUNT_TYPES.BOGO]: discounts.filter((d) => d.discount_type === DISCOUNT_TYPES.BOGO).length,
      [DISCOUNT_TYPES.FREE_SHIPPING]: discounts.filter((d) => d.discount_type === DISCOUNT_TYPES.FREE_SHIPPING).length,
    },
  }
}

export function filterActiveDiscounts(discounts: DiscountProfile[]): DiscountProfile[] {
  return discounts.filter((d) => isDiscountValid(d).valid)
}

export function filterDiscountsByType(discounts: DiscountProfile[], type: DiscountType): DiscountProfile[] {
  return discounts.filter((d) => d.discount_type === type)
}

export function filterPlatformDiscounts(discounts: DiscountProfile[]): DiscountProfile[] {
  return discounts.filter((d) => d.shop_id == null)
}

export function filterExpiringDiscounts(
  discounts: DiscountProfile[],
  daysFromNow = DISCOUNT_VALIDATION.EXPIRING_SOON_DAYS,
): DiscountProfile[] {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + daysFromNow)
  const now = new Date()

  return discounts.filter(
    (d) =>
      d.valid_until &&
      new Date(d.valid_until) <= futureDate &&
      new Date(d.valid_until) >= now &&
      d.is_active,
  )
}

export function filterHighUsageDiscounts(discounts: DiscountProfile[]): DiscountProfile[] {
  return discounts.filter(
    (d) =>
      d.max_uses_total != null &&
      d.max_uses_total > 0 &&
      (d.total_uses ?? 0) >= d.max_uses_total * DISCOUNT_VALIDATION.HIGH_USAGE_RATIO,
  )
}

export function filterDiscountsByScope(discounts: DiscountProfile[], appliesTo: string): DiscountProfile[] {
  return discounts.filter((d) => d.applies_to === appliesTo)
}

export function discountCodeExists(discounts: DiscountProfile[], code: string): boolean {
  const normalized = code.trim().toUpperCase()
  return discounts.some((d) => d.discount_code?.toUpperCase() === normalized)
}

export function normalizeDiscountIds(discountIds: string[]): string[] {
  return Array.from(new Set(discountIds.map((id) => String(id)).filter(Boolean)))
}

export function shouldUseDiscountCache(lastFetch: number | null, forceRefresh?: boolean, ttlMs = 30_000): boolean {
  if (forceRefresh) return false
  if (!lastFetch) return false
  return Date.now() - lastFetch < ttlMs
}
