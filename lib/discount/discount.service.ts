/**
 * Discount service — typed Supabase data-access for vendor, admin, and buyer flows.
 *
 * Ported from legacy `discount-service.js`. UI should dispatch store thunks rather
 * than calling these directly.
 */

import { canManageShop, isAdminRole } from '~/lib/shop/shop.utils'
import { supabase, type Json } from '~/lib/supabase'
import { uploadStorageObject } from '~/lib/supabase/storage-upload'

import {
  DISCOUNT_EVENT_SELECT,
  DISCOUNT_LIST_SELECT,
  DISCOUNT_POSTER_CONFIG,
  DISCOUNT_SOURCE,
  DISCOUNT_TYPES,
  DISCOUNT_VALIDATION,
  APPLIES_TO,
} from '~/lib/discount/discount.constants'
import {
  DiscountError,
  DISCOUNT_ERROR_CODES,
  DISCOUNT_ERROR_MESSAGES,
  toFriendlyDiscountError,
} from '~/lib/discount/discount.errors'
import type {
  BogoRuleInput,
  BogoRuleUpdate,
  DiscountAccessContext,
  DiscountProfileInsert,
  DiscountProfileUpdate,
  DiscountAnalytics,
  DiscountAnalyticsFilters,
  DiscountApplicationInput,
  DiscountCartItem,
  DiscountCreateInput,
  DiscountFetchScope,
  DiscountFilterInput,
  DiscountListResult,
  DiscountPosterMetadata,
  DiscountPreviewResult,
  DiscountProfile,
  DiscountServiceResponse,
  DiscountUpdateInput,
  DiscountUsageHistoryResult,
  DiscountValidationContext,
  OrderDiscountRow,
} from '~/lib/discount/discount.type'
import {
  calculateCartDiscount,
  formatPaginationResponse,
  generatePosterSlug,
  normalizeDiscountIds,
  normalizeDiscountRow,
  normalizeDiscountRows,
  prepareDiscountInsertData,
  prepareDiscountUpdateData,
  validateImageDimensions,
} from '~/lib/discount/discount.utils'
import {
  parseDiscountApplication,
  parseDiscountCreate,
  parseDiscountUpdate,
  parseCartItems,
} from '~/lib/discount/discount.validation'

// ============= INTERNAL HELPERS =============

const pendingRequests = new Map<string, Promise<unknown>>()

function ok<T>(data: T, message?: string | null): DiscountServiceResponse<T> {
  return {
    success: true,
    data,
    error: null,
    message: message ?? null,
    metadata: { timestamp: new Date().toISOString() },
  }
}

function fail<T>(error: unknown, fallback?: string): DiscountServiceResponse<T> {
  return {
    success: false,
    data: null,
    error: toFriendlyDiscountError(error, fallback),
    metadata: { timestamp: new Date().toISOString() },
  }
}

function withTimeout<T>(
  promise: PromiseLike<T>,
  timeout: number = DISCOUNT_VALIDATION.QUERY_TIMEOUT_MS,
): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new DiscountError(DISCOUNT_ERROR_CODES.TIMEOUT)), timeout),
    ),
  ])
}

async function deduplicateRequest<T>(key: string, operation: () => Promise<T>): Promise<T> {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>
  }

  const promise = operation().finally(() => {
    pendingRequests.delete(key)
  })

  pendingRequests.set(key, promise)
  return promise
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = DISCOUNT_VALIDATION.MAX_RETRIES,
  delay = DISCOUNT_VALIDATION.RETRY_DELAY_MS,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay * attempt))
      }
    }
  }

  throw lastError
}

async function resolveDiscountUserId(explicitUserId?: string | null): Promise<string | null> {
  if (explicitUserId) return explicitUserId

  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) return null
    return data.user?.id ?? null
  } catch {
    return null
  }
}

async function assertDiscountManageAccess(
  shopId: string,
  context?: DiscountAccessContext,
  scope: DiscountFetchScope = 'vendor',
): Promise<void> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user?.id) {
    throw new DiscountError(DISCOUNT_ERROR_CODES.NOT_AUTHENTICATED)
  }

  if (scope === 'admin' && isAdminRole(context?.role)) return

  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('id, user_id')
    .eq('id', shopId)
    .maybeSingle()

  if (shopError || !shop) {
    throw new DiscountError(DISCOUNT_ERROR_CODES.SHOP_NOT_FOUND)
  }

  if (!canManageShop(shop, data.user.id, context?.role)) {
    throw new DiscountError(DISCOUNT_ERROR_CODES.ACCESS_DENIED)
  }
}

async function getCustomerDiscountUsageCounts(
  userId: string,
  discountIds: string[],
): Promise<DiscountServiceResponse<Map<string, number>>> {
  const normalizedDiscountIds = normalizeDiscountIds(discountIds)

  if (!userId || normalizedDiscountIds.length === 0) {
    return ok(new Map())
  }

  const { data: usageRows, error: usageRowsError } = await withTimeout(
    supabase
      .from('order_discounts')
      .select(
        `
        discount_profile_id,
        order_items!inner(
          orders!inner(user_id)
        )
      `,
      )
      .eq('order_items.orders.user_id', userId)
      .in('discount_profile_id', normalizedDiscountIds),
  )

  if (!usageRowsError) {
    const usageCounts = (usageRows ?? []).reduce<Map<string, number>>((counts, row) => {
      const discountProfileId = String(row.discount_profile_id || '')
      if (!discountProfileId) return counts
      counts.set(discountProfileId, (counts.get(discountProfileId) || 0) + 1)
      return counts
    }, new Map())

    return ok(usageCounts)
  }

  const { data: userOrders, error: userOrdersError } = await withTimeout(
    supabase.from('orders').select('id').eq('user_id', userId),
  )

  if (userOrdersError) {
    return fail(new Map(), userOrdersError.message)
  }

  const orderIds = (userOrders ?? []).map((row) => row.id).filter(Boolean)
  if (!orderIds.length) return ok(new Map())

  const { data: orderItems, error: orderItemsError } = await withTimeout(
    supabase.from('order_items').select('id').in('order_id', orderIds),
  )

  if (orderItemsError) {
    return fail(new Map(), orderItemsError.message)
  }

  const orderItemIds = (orderItems ?? []).map((row) => row.id).filter(Boolean)
  if (!orderItemIds.length) return ok(new Map())

  const { data: discountRows, error: discountRowsError } = await withTimeout(
    supabase
      .from('order_discounts')
      .select('discount_profile_id')
      .in('order_item_id', orderItemIds)
      .in('discount_profile_id', normalizedDiscountIds),
  )

  if (discountRowsError) {
    return fail(new Map(), discountRowsError.message)
  }

  const usageCounts = (discountRows ?? []).reduce<Map<string, number>>((counts, row) => {
    const discountProfileId = String(row.discount_profile_id || '')
    if (!discountProfileId) return counts
    counts.set(discountProfileId, (counts.get(discountProfileId) || 0) + 1)
    return counts
  }, new Map())

  return ok(usageCounts)
}

function emptyAnalytics(): DiscountAnalytics {
  return {
    total_discounts_applied: 0,
    total_discount_amount: 0,
    by_discount: {},
    by_type: {},
    unique_customers: 0,
    orders_with_discounts: 0,
  }
}

// ============= CRUD =============

export async function createDiscountProfile(
  discountData: DiscountCreateInput,
  options?: { accessContext?: DiscountAccessContext; scope?: DiscountFetchScope },
): Promise<DiscountServiceResponse<DiscountProfile>> {
  const requestKey = `create-discount-${discountData.shop_id}-${discountData.discount_name}`

  return deduplicateRequest(requestKey, async () => {
    try {
      await assertDiscountManageAccess(discountData.shop_id, options?.accessContext, options?.scope)

      const validation = parseDiscountCreate({
        ...discountData,
        discount_value:
          discountData.discount_type === DISCOUNT_TYPES.BOGO ? 1 : discountData.discount_value,
      })

      if (!validation.isValid || !validation.data) {
        throw new DiscountError(DISCOUNT_ERROR_CODES.VALIDATION_ERROR, validation.errors.join(', '))
      }

      const prepared = prepareDiscountInsertData({
        ...validation.data,
        shop_id: discountData.shop_id,
        discount_type: discountData.discount_type,
        discount_value:
          discountData.discount_type === DISCOUNT_TYPES.BOGO ? 0 : discountData.discount_value,
        applies_to:
          discountData.discount_type === DISCOUNT_TYPES.BOGO ? APPLIES_TO.ITEM : discountData.applies_to,
      })

      const { total_uses: _totalUses, ...insertPayload } = prepared

      const { data, error } = await withTimeout(
        supabase
          .from('discount_profiles')
          .insert(insertPayload as DiscountProfileInsert)
          .select(DISCOUNT_LIST_SELECT),
      )

      if (error) return fail(error)
      const row = Array.isArray(data) ? data[0] : data
      if (!row) return fail(new DiscountError(DISCOUNT_ERROR_CODES.DATABASE))

      return ok(normalizeDiscountRow(row as DiscountProfile))
    } catch (error) {
      return fail(error)
    }
  })
}

export async function updateDiscountProfile(
  discountId: string,
  updateData: DiscountUpdateInput,
  options?: { shopId?: string; accessContext?: DiscountAccessContext; scope?: DiscountFetchScope },
): Promise<DiscountServiceResponse<DiscountProfile>> {
  const requestKey = `update-discount-${discountId}`

  return deduplicateRequest(requestKey, async () => {
    try {
      if (!discountId) throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_ID)

      if (options?.shopId) {
        await assertDiscountManageAccess(options.shopId, options.accessContext, options?.scope)
      }

      const validation = parseDiscountUpdate(updateData)
      if (!validation.isValid) {
        throw new DiscountError(DISCOUNT_ERROR_CODES.VALIDATION_ERROR, validation.errors.join(', '))
      }

      const cleanUpdateData = prepareDiscountUpdateData(validation.data ?? updateData) as DiscountProfileUpdate

      const { data, error } = await withTimeout(
        supabase
          .from('discount_profiles')
          .update(cleanUpdateData)
          .eq('id', discountId)
          .select(DISCOUNT_LIST_SELECT),
      )

      if (error) return fail(error)
      const row = Array.isArray(data) ? data[0] : data
      if (!row) return fail(new DiscountError(DISCOUNT_ERROR_CODES.DISCOUNT_NOT_FOUND))

      return ok(normalizeDiscountRow(row as DiscountProfile))
    } catch (error) {
      return fail(error)
    }
  })
}

export async function deleteDiscountProfile(
  discountId: string,
  options?: { shopId?: string; accessContext?: DiscountAccessContext; scope?: DiscountFetchScope },
): Promise<DiscountServiceResponse<{ id: string }>> {
  const requestKey = `delete-discount-${discountId}`

  return deduplicateRequest(requestKey, async () => {
    try {
      if (!discountId) throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_ID)

      if (options?.shopId) {
        await assertDiscountManageAccess(options.shopId, options.accessContext, options?.scope)
      }

      const { error } = await withTimeout(
        supabase.from('discount_profiles').delete().eq('id', discountId),
      )

      if (error) return fail(error)
      return ok({ id: discountId })
    } catch (error) {
      return fail(error)
    }
  })
}

export async function getDiscountProfile(
  discountId: string,
): Promise<DiscountServiceResponse<DiscountProfile>> {
  try {
    if (!discountId) throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_ID)

    const { data, error } = await withTimeout(
      supabase.from('discount_profiles').select(DISCOUNT_LIST_SELECT).eq('id', discountId).maybeSingle(),
    )

    if (error) return fail(error)
    if (!data) return fail(new DiscountError(DISCOUNT_ERROR_CODES.DISCOUNT_NOT_FOUND))

    return ok(normalizeDiscountRow(data as DiscountProfile))
  } catch (error) {
    return fail(error)
  }
}

export async function getShopDiscounts(
  shopId: string,
  options: DiscountFilterInput = {},
  access?: { accessContext?: DiscountAccessContext; scope?: DiscountFetchScope },
): Promise<DiscountServiceResponse<DiscountListResult>> {
  try {
    if (!shopId) throw new DiscountError(DISCOUNT_ERROR_CODES.SHOP_NOT_FOUND)

    await assertDiscountManageAccess(shopId, access?.accessContext, access?.scope)

    const {
      page = 1,
      limit = 20,
      active_only = false,
      include_expired = false,
      discount_type = null,
      applies_to = null,
      search = null,
      sort_by = 'created_at',
      sort_order = 'desc',
      source = null,
    } = options

    const offset = (page - 1) * limit

    let query = supabase
      .from('discount_profiles')
      .select(DISCOUNT_LIST_SELECT, { count: 'exact' })
      .eq('shop_id', shopId)

    if (search?.trim()) {
      const term = search.trim()
      query = query.or(
        `discount_name.ilike.%${term}%,discount_code.ilike.%${term}%,description.ilike.%${term}%`,
      )
    }

    if (source === DISCOUNT_SOURCE.EVENT) {
      query = query.eq('source', DISCOUNT_SOURCE.EVENT)
    } else if (source === DISCOUNT_SOURCE.MANUAL) {
      query = query.or(`source.is.null,source.neq.${DISCOUNT_SOURCE.EVENT}`)
    }

    if (discount_type) query = query.eq('discount_type', discount_type)
    if (applies_to) query = query.eq('applies_to', applies_to)

    if (active_only) {
      query = query.eq('is_active', true).lte('valid_from', new Date().toISOString())
      if (!include_expired) {
        query = query.or(`valid_until.is.null,valid_until.gte.${new Date().toISOString()}`)
      }
    }

    query = query.order(sort_by, { ascending: sort_order === 'asc' }).range(offset, offset + limit - 1)

    const { data, error, count } = await withTimeout(query)
    if (error) return fail(error)

    return ok({
      discounts: normalizeDiscountRows((data ?? []) as DiscountProfile[]),
      pagination: formatPaginationResponse(page, limit, count ?? 0),
    })
  } catch (error) {
    return fail(error)
  }
}

// ============= VALIDATION / APPLICATION =============

export async function validateDiscountCode(
  discountCode: string,
  orderData: DiscountValidationContext = {},
): Promise<DiscountServiceResponse<DiscountProfile>> {
  const normalizedCode = String(discountCode || '')
    .trim()
    .toUpperCase()

  const requestUserScope = String(orderData.user_id || 'guest')
  const requestShopScope = String(orderData.shop_id || 'any-shop')
  const requestListingsScope = Array.isArray(orderData.listing_ids)
    ? [...orderData.listing_ids].map(String).filter(Boolean).sort().join(',') || 'no-listings'
    : 'no-listings'
  const requestTotalScope = Number(orderData.order_total || 0)
  const requestKey = `validate-${normalizedCode}-${requestUserScope}-${requestShopScope}-${requestTotalScope}-${requestListingsScope}`

  return deduplicateRequest(requestKey, async () => {
    try {
      if (!discountCode?.trim()) {
        throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_CODE, 'Discount code is required.')
      }

      const { data, error } = await withTimeout(
        supabase
          .from('discount_profiles')
          .select('*')
          .eq('discount_code', normalizedCode)
          .eq('is_active', true)
          .lte('valid_from', new Date().toISOString())
          .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString()}`)
          .single(),
      )

      if (error) {
        return fail(new DiscountError(DISCOUNT_ERROR_CODES.INVALID_CODE))
      }

      const requestedShopId = orderData.shop_id ?? null
      const requestedListingIds = Array.isArray(orderData.listing_ids)
        ? orderData.listing_ids.filter(Boolean)
        : []
      const effectiveUserId = await resolveDiscountUserId(orderData.user_id)

      if (requestedShopId && data.shop_id && data.shop_id !== requestedShopId) {
        return fail(
          new DiscountError(
            DISCOUNT_ERROR_CODES.NOT_ELIGIBLE,
            'This discount code is not valid for the current shop.',
          ),
        )
      }

      if (requestedListingIds.length > 0 && data.applies_to === APPLIES_TO.ITEM) {
        if (data.discount_type === DISCOUNT_TYPES.BOGO) {
          const { data: bogoRule, error: bogoError } = await withTimeout(
            supabase
              .from('bogo_rules')
              .select('buy_listing_ids, buy_categories, get_listing_ids, get_categories')
              .eq('discount_profile_id', data.id)
              .maybeSingle(),
          )

          if (bogoError) {
            return fail(new DiscountError(DISCOUNT_ERROR_CODES.BOGO_ELIGIBILITY))
          }

          const cartListingSet = new Set(requestedListingIds.map(String))
          const hasProductMatch =
            (bogoRule?.buy_listing_ids ?? []).some((id) => cartListingSet.has(String(id))) ||
            (bogoRule?.get_listing_ids ?? []).some((id) => cartListingSet.has(String(id)))

          const hasCategoryConfig =
            (bogoRule?.buy_categories ?? []).length > 0 || (bogoRule?.get_categories ?? []).length > 0

          if (!hasProductMatch && !hasCategoryConfig) {
            return fail(new DiscountError(DISCOUNT_ERROR_CODES.BOGO_ELIGIBILITY))
          }
        } else {
          const { data: linkedRows, error: linkError } = await withTimeout(
            supabase
              .from('listing_discounts')
              .select('id')
              .eq('discount_profile_id', data.id)
              .in('listing_id', requestedListingIds)
              .limit(1),
          )

          if (linkError) {
            return fail(new DiscountError(DISCOUNT_ERROR_CODES.NOT_ELIGIBLE))
          }

          if (!linkedRows?.length) {
            return fail(
              new DiscountError(
                DISCOUNT_ERROR_CODES.NO_ELIGIBLE_ITEMS,
                'This discount code does not apply to items in your cart.',
              ),
            )
          }
        }
      }

      if (data.max_uses_total && (data.total_uses ?? 0) >= data.max_uses_total) {
        return fail(new DiscountError(DISCOUNT_ERROR_CODES.USAGE_EXCEEDED))
      }

      if (data.min_order_amount && (orderData.order_total ?? 0) < data.min_order_amount) {
        return fail(
          new DiscountError(
            DISCOUNT_ERROR_CODES.MIN_ORDER,
            `Minimum order amount of ${data.min_order_amount} required.`,
          ),
        )
      }

      const maxUsesPerCustomer = Number(data.max_uses_per_customer || 0)
      if (maxUsesPerCustomer > 0) {
        if (!effectiveUserId) {
          return fail(
            new DiscountError(
              DISCOUNT_ERROR_CODES.NOT_AUTHENTICATED,
              'Please sign in to use this discount code due to per-customer usage limits.',
            ),
          )
        }

        const usageResult = await getCustomerDiscountUsageCounts(effectiveUserId, [data.id])
        if (!usageResult.success || !usageResult.data) {
          return fail(usageResult.error ?? DISCOUNT_ERROR_MESSAGES[DISCOUNT_ERROR_CODES.CUSTOMER_LIMIT])
        }

        const customerUsage = usageResult.data.get(String(data.id)) || 0
        if (customerUsage >= maxUsesPerCustomer) {
          return fail(new DiscountError(DISCOUNT_ERROR_CODES.CUSTOMER_LIMIT))
        }
      }

      return ok(data as DiscountProfile)
    } catch (error) {
      return fail(error)
    }
  })
}

export async function previewDiscountOnCart(
  discountCode: string,
  cartItems: DiscountCartItem[],
): Promise<DiscountServiceResponse<DiscountPreviewResult>> {
  try {
    const itemsValidation = parseCartItems(cartItems)
    if (!itemsValidation.isValid || !itemsValidation.data?.length) {
      throw new DiscountError(DISCOUNT_ERROR_CODES.NO_ELIGIBLE_ITEMS, itemsValidation.errors.join(', '))
    }

    const cartTotal = itemsValidation.data.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const listingIds = itemsValidation.data.map((item) => item.listing_id)

    const validation = await validateDiscountCode(discountCode, {
      order_total: cartTotal,
      listing_ids: listingIds,
    })

    if (!validation.success || !validation.data) {
      return fail(validation.error ?? DISCOUNT_ERROR_MESSAGES[DISCOUNT_ERROR_CODES.INVALID_CODE])
    }

    let discount = validation.data
    if (discount.discount_type === DISCOUNT_TYPES.BOGO) {
      const profile = await getDiscountProfile(discount.id)
      if (profile.success && profile.data) discount = profile.data
    }

    const breakdown = calculateCartDiscount(discount, itemsValidation.data, cartTotal)
    return ok({ discount, breakdown })
  } catch (error) {
    return fail(error)
  }
}

export async function applyDiscountToOrderItem(
  input: DiscountApplicationInput,
): Promise<DiscountServiceResponse<OrderDiscountRow>> {
  try {
    const validation = parseDiscountApplication(input)
    if (!validation.isValid || !validation.data) {
      throw new DiscountError(DISCOUNT_ERROR_CODES.VALIDATION_ERROR, validation.errors.join(', '))
    }

    const payload = validation.data

    const { data, error } = await withTimeout(
      supabase
        .from('order_discounts')
        .insert({
          order_item_id: payload.order_item_id,
          discount_profile_id: payload.discount_profile_id,
          listing_discount_id: payload.listing_discount_id ?? null,
          discount_name: payload.discount_name,
          discount_type: payload.discount_type,
          discount_amount: payload.discount_amount,
          applied_by_code: payload.applied_by_code ?? false,
          discount_metadata: (payload.metadata ?? {}) as Json,
        })
        .select()
        .single(),
    )

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

// ============= LISTING LINKS =============

export async function linkDiscountToListings(
  discountId: string,
  listingIds: string[],
  options?: { shopId?: string; accessContext?: DiscountAccessContext; scope?: DiscountFetchScope },
): Promise<DiscountServiceResponse<unknown[]>> {
  const requestKey = `link-discount-${discountId}`

  return deduplicateRequest(requestKey, async () => {
    try {
      if (!discountId || !listingIds.length) {
        throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_INPUT, 'Discount ID and listing IDs are required.')
      }

      if (options?.shopId) {
        await assertDiscountManageAccess(options.shopId, options.accessContext, options?.scope)
      }

      const profile = await retryOperation(async () => {
        const { data, error } = await withTimeout(
          supabase.from('discount_profiles').select('applies_to, is_active').eq('id', discountId).single(),
        )
        if (error) throw error
        return data
      })

      if (!profile) throw new DiscountError(DISCOUNT_ERROR_CODES.DISCOUNT_NOT_FOUND)
      if (profile.applies_to !== APPLIES_TO.ITEM) {
        throw new DiscountError(
          DISCOUNT_ERROR_CODES.INVALID_INPUT,
          `Discount cannot be linked to individual listings (applies to: ${profile.applies_to}).`,
        )
      }

      const existingLinks = await retryOperation(async () => {
        const { data, error } = await withTimeout(
          supabase.from('listing_discounts').select('listing_id').eq('discount_profile_id', discountId),
        )
        if (error) throw error
        return data ?? []
      })

      const existingListingIds = new Set(existingLinks.map((link) => link.listing_id))
      const newListingIds = listingIds.filter((listingId) => !existingListingIds.has(listingId))

      if (!newListingIds.length) {
        return ok([], 'All listings are already linked to this discount.')
      }

      const linkData = newListingIds.map((listingId) => ({
        listing_id: listingId,
        discount_profile_id: discountId,
      }))

      const insertedLinks = await retryOperation(async () => {
        const { data, error } = await withTimeout(
          supabase.from('listing_discounts').insert(linkData).select(),
        )
        if (error) throw error
        return data ?? []
      })

      return ok(insertedLinks)
    } catch (error) {
      return fail(error)
    }
  })
}

export async function unlinkDiscountFromListings(
  discountId: string,
  listingIds: string[],
  options?: { shopId?: string; accessContext?: DiscountAccessContext; scope?: DiscountFetchScope },
): Promise<DiscountServiceResponse<unknown[]>> {
  const requestKey = `unlink-discount-${discountId}`

  return deduplicateRequest(requestKey, async () => {
    try {
      if (!discountId || !listingIds.length) {
        throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_INPUT, 'Discount ID and listing IDs are required.')
      }

      if (options?.shopId) {
        await assertDiscountManageAccess(options.shopId, options.accessContext, options?.scope)
      }

      const deletedLinks = await retryOperation(async () => {
        const { data, error } = await withTimeout(
          supabase
            .from('listing_discounts')
            .delete()
            .eq('discount_profile_id', discountId)
            .in('listing_id', listingIds)
            .select(),
        )
        if (error) throw error
        return data ?? []
      })

      return ok(deletedLinks)
    } catch (error) {
      return fail(error)
    }
  })
}

export async function getListingDiscounts(
  listingId: string,
  activeOnly = true,
): Promise<DiscountServiceResponse<DiscountProfile[]>> {
  try {
    if (!listingId) throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_ID)

    const { data, error } = await withTimeout(
      supabase
        .from('listing_discounts')
        .select(
          `
          id,
          listing_id,
          discount_profile_id,
          discount_profiles (
            id,
            discount_name,
            discount_code,
            description,
            discount_type,
            discount_value,
            max_discount_amount,
            applies_to,
            min_order_amount,
            max_uses_total,
            max_uses_per_customer,
            total_uses,
            is_active,
            valid_from,
            valid_until,
            created_at
          )
        `,
        )
        .eq('listing_id', listingId),
    )

    if (error) return fail(error)

    let discounts = (data ?? [])
      .map((row) => row.discount_profiles)
      .filter((profile): profile is DiscountProfile => profile != null)

    if (activeOnly) {
      const now = new Date()
      discounts = discounts.filter((discount) => {
        if (!discount.is_active) return false
        const validFrom = discount.valid_from ? new Date(discount.valid_from) : null
        const validUntil = discount.valid_until ? new Date(discount.valid_until) : null
        if (validFrom && validFrom > now) return false
        if (validUntil && validUntil < now) return false
        return true
      })
    }

    return ok(discounts)
  } catch (error) {
    return fail(error)
  }
}

export async function getCartEligibleDiscounts(
  shopId: string,
  listingIds: string[] = [],
  context: DiscountValidationContext = {},
): Promise<DiscountServiceResponse<DiscountProfile[]>> {
  const normalizedListingIds = [...listingIds].map(String).filter(Boolean).sort()
  const userScope = String(context.user_id || 'anonymous')
  const cacheKey = `cart-discounts-${shopId}-${userScope}-${JSON.stringify(normalizedListingIds)}`

  return deduplicateRequest(cacheKey, async () => {
    try {
      if (!shopId) throw new DiscountError(DISCOUNT_ERROR_CODES.SHOP_NOT_FOUND)

      const now = new Date().toISOString()
      const eligibleDiscounts: DiscountProfile[] = []

      const { data: orderDiscounts, error: orderError } = await withTimeout(
        supabase
          .from('discount_profiles')
          .select(DISCOUNT_LIST_SELECT)
          .eq('shop_id', shopId)
          .eq('applies_to', APPLIES_TO.ORDER)
          .eq('is_active', true)
          .lte('valid_from', now)
          .or(`valid_until.is.null,valid_until.gte.${now}`),
      )

      if (!orderError && orderDiscounts) {
        eligibleDiscounts.push(...normalizeDiscountRows(orderDiscounts as DiscountProfile[]))
      }

      if (normalizedListingIds.length > 0) {
        const { data: activeDiscounts, error: discountError } = await withTimeout(
          supabase
            .from('discount_profiles')
            .select(DISCOUNT_LIST_SELECT)
            .eq('shop_id', shopId)
            .eq('applies_to', APPLIES_TO.ITEM)
            .eq('is_active', true)
            .lte('valid_from', now)
            .or(`valid_until.is.null,valid_until.gte.${now}`),
        )

        if (!discountError && activeDiscounts?.length) {
          const normalized = normalizeDiscountRows(activeDiscounts as DiscountProfile[])
          const bogoDiscounts = normalized.filter((d) => d.discount_type === DISCOUNT_TYPES.BOGO)
          const regularDiscounts = normalized.filter((d) => d.discount_type !== DISCOUNT_TYPES.BOGO)

          if (regularDiscounts.length) {
            const regularIds = regularDiscounts.map((d) => d.id)
            const { data: listingLinks, error: linkError } = await withTimeout(
              supabase
                .from('listing_discounts')
                .select('discount_profile_id')
                .in('listing_id', normalizedListingIds)
                .in('discount_profile_id', regularIds),
            )

            if (!linkError && listingLinks?.length) {
              const linkedDiscountIds = new Set(listingLinks.map((link) => link.discount_profile_id))
              eligibleDiscounts.push(...regularDiscounts.filter((d) => linkedDiscountIds.has(d.id)))
            }
          }

          const cartListingSet = new Set(normalizedListingIds)
          for (const bogoDiscount of bogoDiscounts) {
            const rule = bogoDiscount.bogo_rule
            if (!rule) continue

            const hasProductMatch =
              (rule.buy_listing_ids ?? []).some((id) => cartListingSet.has(String(id))) ||
              (rule.get_listing_ids ?? []).some((id) => cartListingSet.has(String(id)))

            const hasCategoryConfig =
              (rule.buy_categories?.length ?? 0) > 0 || (rule.get_categories?.length ?? 0) > 0

            if (hasProductMatch || hasCategoryConfig) {
              eligibleDiscounts.push(bogoDiscount)
            }
          }
        }
      }

      const uniqueEligibleDiscounts = Array.from(
        new Map(eligibleDiscounts.map((d) => [d.id, d])).values(),
      )

      let filteredDiscounts = uniqueEligibleDiscounts
      const discountsWithUserLimit = uniqueEligibleDiscounts.filter(
        (discount) => Number(discount.max_uses_per_customer || 0) > 0,
      )

      if (discountsWithUserLimit.length) {
        const effectiveUserId = await resolveDiscountUserId(context.user_id)

        if (!effectiveUserId) {
          filteredDiscounts = uniqueEligibleDiscounts.filter(
            (discount) => Number(discount.max_uses_per_customer || 0) <= 0,
          )
        } else {
          const usageResult = await getCustomerDiscountUsageCounts(
            effectiveUserId,
            discountsWithUserLimit.map((discount) => discount.id),
          )

          if (!usageResult.success || !usageResult.data) {
            return fail(usageResult.error ?? DISCOUNT_ERROR_MESSAGES[DISCOUNT_ERROR_CODES.CUSTOMER_LIMIT])
          }

          filteredDiscounts = uniqueEligibleDiscounts.filter((discount) => {
            const maxUsesPerCustomer = Number(discount.max_uses_per_customer || 0)
            if (maxUsesPerCustomer <= 0) return true
            const usageCount = usageResult.data!.get(String(discount.id)) || 0
            return usageCount < maxUsesPerCustomer
          })
        }
      }

      return ok(filteredDiscounts)
    } catch (error) {
      return fail(error)
    }
  })
}

// ============= BOGO =============

export async function createBogoRule(
  discountProfileId: string,
  bogoData: BogoRuleInput,
): Promise<DiscountServiceResponse<NonNullable<DiscountProfile['bogo_rule']>>> {
  const requestKey = `create-bogo-rule-${discountProfileId}`

  return deduplicateRequest(requestKey, async () => {
    try {
      if (!discountProfileId) throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_ID)

      const insertData = {
        discount_profile_id: discountProfileId,
        buy_listing_ids: bogoData.buy_listing_ids ?? [],
        buy_categories: bogoData.buy_categories ?? [],
        buy_quantity: bogoData.buy_quantity ?? 1,
        get_listing_ids: bogoData.get_listing_ids ?? [],
        get_categories: bogoData.get_categories ?? [],
        get_quantity: bogoData.get_quantity ?? 1,
        get_discount_type: bogoData.get_discount_type ?? 'free',
        get_discount_value:
          bogoData.get_discount_type === 'free' ? 100 : bogoData.get_discount_value ?? 100,
      }

      const { data, error } = await withTimeout(supabase.from('bogo_rules').insert(insertData).select())

      if (error) return fail(error)
      const row = Array.isArray(data) ? data[0] : data
      if (!row) return fail(new DiscountError(DISCOUNT_ERROR_CODES.DATABASE))

      return ok(row)
    } catch (error) {
      return fail(error)
    }
  })
}

export async function updateBogoRule(
  discountProfileId: string,
  bogoData: BogoRuleInput,
): Promise<DiscountServiceResponse<NonNullable<DiscountProfile['bogo_rule']>>> {
  try {
    if (!discountProfileId) throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_ID)

    const updateData: BogoRuleUpdate = { updated_at: new Date().toISOString() }

    if (bogoData.buy_listing_ids !== undefined) updateData.buy_listing_ids = bogoData.buy_listing_ids
    if (bogoData.buy_categories !== undefined) updateData.buy_categories = bogoData.buy_categories
    if (bogoData.buy_quantity !== undefined) updateData.buy_quantity = bogoData.buy_quantity
    if (bogoData.get_listing_ids !== undefined) updateData.get_listing_ids = bogoData.get_listing_ids
    if (bogoData.get_categories !== undefined) updateData.get_categories = bogoData.get_categories
    if (bogoData.get_quantity !== undefined) updateData.get_quantity = bogoData.get_quantity
    if (bogoData.get_discount_type !== undefined) {
      updateData.get_discount_type = bogoData.get_discount_type
      updateData.get_discount_value =
        bogoData.get_discount_type === 'free' ? 100 : bogoData.get_discount_value ?? 100
    }

    const { data, error } = await withTimeout(
      supabase.from('bogo_rules').update(updateData).eq('discount_profile_id', discountProfileId).select(),
    )

    if (error) return fail(error)
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return fail(new DiscountError(DISCOUNT_ERROR_CODES.DISCOUNT_NOT_FOUND))

    return ok(row)
  } catch (error) {
    return fail(error)
  }
}

export async function getBogoRule(
  discountProfileId: string,
): Promise<DiscountServiceResponse<NonNullable<DiscountProfile['bogo_rule']>>> {
  try {
    if (!discountProfileId) throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_ID)

    const { data, error } = await withTimeout(
      supabase.from('bogo_rules').select('*').eq('discount_profile_id', discountProfileId).single(),
    )

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteBogoRule(
  discountProfileId: string,
): Promise<DiscountServiceResponse<{ discountProfileId: string }>> {
  try {
    if (!discountProfileId) throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_ID)

    const { error } = await withTimeout(
      supabase.from('bogo_rules').delete().eq('discount_profile_id', discountProfileId),
    )

    if (error) return fail(error)
    return ok({ discountProfileId })
  } catch (error) {
    return fail(error)
  }
}

// ============= BULK =============

export async function bulkUpdateDiscountStatus(
  discountIds: string[],
  isActive: boolean,
  options?: { shopId?: string; accessContext?: DiscountAccessContext; scope?: DiscountFetchScope },
): Promise<DiscountServiceResponse<{ updatedIds: string[] }>> {
  try {
    const ids = normalizeDiscountIds(discountIds)
    if (!ids.length) throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_ID)

    if (options?.shopId) {
      await assertDiscountManageAccess(options.shopId, options.accessContext, options?.scope)
    }

    const { data, error } = await withTimeout(
      supabase
        .from('discount_profiles')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .in('id', ids)
        .select('id'),
    )

    if (error) return fail(error)
    return ok({ updatedIds: (data ?? []).map((row) => row.id) })
  } catch (error) {
    return fail(error, DISCOUNT_ERROR_MESSAGES[DISCOUNT_ERROR_CODES.BULK_FAILED])
  }
}

export async function bulkDeleteDiscounts(
  discountIds: string[],
  options?: { shopId?: string; accessContext?: DiscountAccessContext; scope?: DiscountFetchScope },
): Promise<DiscountServiceResponse<{ deletedIds: string[] }>> {
  try {
    const ids = normalizeDiscountIds(discountIds)
    if (!ids.length) throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_ID)

    if (options?.shopId) {
      await assertDiscountManageAccess(options.shopId, options.accessContext, options?.scope)
    }

    const { error } = await withTimeout(supabase.from('discount_profiles').delete().in('id', ids))
    if (error) return fail(error)

    return ok({ deletedIds: ids })
  } catch (error) {
    return fail(error, DISCOUNT_ERROR_MESSAGES[DISCOUNT_ERROR_CODES.BULK_FAILED])
  }
}

// ============= ANALYTICS =============

export async function getDiscountAnalytics(
  shopId: string,
  filters: DiscountAnalyticsFilters = {},
  access?: { accessContext?: DiscountAccessContext; scope?: DiscountFetchScope },
): Promise<DiscountServiceResponse<DiscountAnalytics>> {
  try {
    if (!shopId) throw new DiscountError(DISCOUNT_ERROR_CODES.SHOP_NOT_FOUND)
    await assertDiscountManageAccess(shopId, access?.accessContext, access?.scope)

    const { date_from, date_to } = filters

    const { data: shopDiscounts, error: profileError } = await withTimeout(
      supabase
        .from('discount_profiles')
        .select('id, discount_name, discount_type, discount_code')
        .eq('shop_id', shopId),
      DISCOUNT_VALIDATION.ANALYTICS_PROFILE_TIMEOUT_MS,
    )

    if (profileError) return fail(profileError)
    if (!shopDiscounts?.length) return ok(emptyAnalytics())

    const discountProfileIds = shopDiscounts.map((d) => d.id)
    const discountNameMap = new Map(shopDiscounts.map((d) => [d.id, d.discount_name]))
    const discountTypeMap = new Map(shopDiscounts.map((d) => [d.id, d.discount_type]))

    let analyticsQuery = supabase
      .from('order_discounts')
      .select('discount_amount, discount_profile_id, order_item_id, applied_at')
      .in('discount_profile_id', discountProfileIds)

    if (date_from) analyticsQuery = analyticsQuery.gte('applied_at', date_from)
    if (date_to) analyticsQuery = analyticsQuery.lte('applied_at', date_to)

    const { data: discountData, error: discountError } = await withTimeout(
      analyticsQuery,
      DISCOUNT_VALIDATION.ANALYTICS_QUERY_TIMEOUT_MS,
    )

    if (discountError) return fail(discountError)
    if (!discountData?.length) return ok(emptyAnalytics())

    const orderItemIds = [...new Set(discountData.map((d) => d.order_item_id))]
    const batchSize = DISCOUNT_VALIDATION.ANALYTICS_BATCH_SIZE
    let allOrderItems: Array<{ id: string; order_id: string }> = []

    for (let i = 0; i < orderItemIds.length; i += batchSize) {
      const batch = orderItemIds.slice(i, i + batchSize)
      const { data: items } = await withTimeout(
        supabase.from('order_items').select('id, order_id').in('id', batch),
        DISCOUNT_VALIDATION.QUERY_TIMEOUT_MS,
      )
      if (items) allOrderItems = allOrderItems.concat(items)
    }

    const orderItemToOrderMap = new Map(allOrderItems.map((item) => [item.id, item.order_id]))
    const orderIds = [...new Set(allOrderItems.map((item) => item.order_id))]
    let allOrders: Array<{ id: string; user_id: string }> = []

    for (let i = 0; i < orderIds.length; i += batchSize) {
      const batch = orderIds.slice(i, i + batchSize)
      const { data: orders } = await withTimeout(
        supabase.from('orders').select('id, user_id').in('id', batch),
        DISCOUNT_VALIDATION.QUERY_TIMEOUT_MS,
      )
      if (orders) allOrders = allOrders.concat(orders)
    }

    const orderToUserMap = new Map(allOrders.map((order) => [order.id, order.user_id]))

    const analytics = {
      total_discounts_applied: discountData.length,
      total_discount_amount: 0,
      by_discount: {} as Record<string, number>,
      by_type: {} as Record<string, number>,
      unique_customers: new Set<string>(),
      orders_with_discounts: new Set<string>(),
    }

    discountData.forEach((discount) => {
      const discountName = discountNameMap.get(discount.discount_profile_id ?? '') || 'Unknown'
      const discountType = discountTypeMap.get(discount.discount_profile_id ?? '') || 'Unknown'
      const amount = discount.discount_amount || 0

      analytics.total_discount_amount += amount
      analytics.by_discount[discountName] = (analytics.by_discount[discountName] || 0) + amount
      analytics.by_type[discountType] = (analytics.by_type[discountType] || 0) + amount

      const orderId = orderItemToOrderMap.get(discount.order_item_id)
      if (orderId) {
        analytics.orders_with_discounts.add(orderId)
        const userId = orderToUserMap.get(orderId)
        if (userId) analytics.unique_customers.add(userId)
      }
    })

    return ok({
      total_discounts_applied: analytics.total_discounts_applied,
      total_discount_amount: analytics.total_discount_amount,
      by_discount: analytics.by_discount,
      by_type: analytics.by_type,
      unique_customers: analytics.unique_customers.size,
      orders_with_discounts: analytics.orders_with_discounts.size,
    })
  } catch (error) {
    return fail(error)
  }
}

export async function getDiscountUsageHistory(
  discountId: string,
  options: { page?: number; limit?: number } = {},
): Promise<DiscountServiceResponse<DiscountUsageHistoryResult>> {
  try {
    if (!discountId) throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_ID)

    const page = options.page ?? 1
    const limit = options.limit ?? 20
    const offset = (page - 1) * limit

    const { data, error, count } = await withTimeout(
      supabase
        .from('order_discounts')
        .select('*, order_items(order_id)', { count: 'exact' })
        .eq('discount_profile_id', discountId)
        .order('applied_at', { ascending: false })
        .range(offset, offset + limit - 1),
    )

    if (error) return fail(error)

    return ok({
      items: (data ?? []) as DiscountUsageHistoryResult['items'],
      pagination: formatPaginationResponse(page, limit, count ?? 0),
    })
  } catch (error) {
    return fail(error)
  }
}

export async function getCustomerDiscountUsage(
  userId: string,
  shopId?: string | null,
): Promise<DiscountServiceResponse<Array<{ discount_profile_id: string; usage_count: number }>>> {
  try {
    if (!userId) throw new DiscountError(DISCOUNT_ERROR_CODES.NOT_AUTHENTICATED)

    let discountIds: string[] = []

    if (shopId) {
      const { data: shopDiscounts, error } = await withTimeout(
        supabase.from('discount_profiles').select('id').eq('shop_id', shopId),
      )
      if (error) return fail(error)
      discountIds = (shopDiscounts ?? []).map((row) => row.id)
    }

    const usageResult = await getCustomerDiscountUsageCounts(userId, discountIds)
    if (!usageResult.success || !usageResult.data) {
      return fail(usageResult.error)
    }

    const rows = [...usageResult.data.entries()].map(([discount_profile_id, usage_count]) => ({
      discount_profile_id,
      usage_count,
    }))

    return ok(rows)
  } catch (error) {
    return fail(error)
  }
}

export async function getEventDiscountsForShop(
  shopId: string,
): Promise<DiscountServiceResponse<DiscountProfile[]>> {
  const requestKey = `event-discounts-${shopId}`

  return deduplicateRequest(requestKey, async () => {
    try {
      if (!shopId) throw new DiscountError(DISCOUNT_ERROR_CODES.SHOP_NOT_FOUND)

      const { data, error } = await withTimeout(
        supabase
          .from('discount_profiles')
          .select(DISCOUNT_EVENT_SELECT)
          .eq('shop_id', shopId)
          .eq('source', DISCOUNT_SOURCE.EVENT)
          .order('created_at', { ascending: false }),
      )

      if (error) return fail(error)
      return ok((data ?? []) as DiscountProfile[])
    } catch (error) {
      return fail(error)
    }
  })
}

// ============= POSTERS =============

function parsePosterArray(value: unknown): DiscountPosterMetadata[] {
  if (!Array.isArray(value)) return []
  return value as DiscountPosterMetadata[]
}

export async function uploadDiscountPoster(
  discountId: string,
  file: File,
  posterName: string,
  options?: { shopId?: string; accessContext?: DiscountAccessContext; scope?: DiscountFetchScope },
): Promise<DiscountServiceResponse<DiscountPosterMetadata>> {
  const requestKey = `upload-poster-${discountId}-${Date.now()}`

  return deduplicateRequest(requestKey, async () => {
    try {
      if (!discountId || !file || !posterName?.trim()) {
        throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_INPUT, 'Discount ID, file, and poster name are required.')
      }

      if (options?.shopId) {
        await assertDiscountManageAccess(options.shopId, options.accessContext, options?.scope)
      }

      const validation = await validateImageDimensions(file)
      if (!validation.isValid) {
        throw new DiscountError(DISCOUNT_ERROR_CODES.POSTER_INVALID, validation.message)
      }

      const slug = generatePosterSlug(posterName)
      const fileExt = file.name.split('.').pop() ?? 'jpg'
      const fileName = `${discountId}/${slug}-${Date.now()}.${fileExt}`

      const uploadResult = await retryOperation(async () => {
        const result = await uploadStorageObject(
          DISCOUNT_POSTER_CONFIG.BUCKET_NAME,
          fileName,
          file,
          file.type,
          { maxBytes: DISCOUNT_POSTER_CONFIG.MAX_FILE_SIZE_BYTES },
        )
        if (result.error || !result.data) throw new Error(result.error ?? 'Upload failed')
        return result.data
      })

      const posterMetadata: DiscountPosterMetadata = {
        id: Date.now().toString(),
        name: posterName,
        slug,
        file_path: fileName,
        url: uploadResult.publicUrl,
        width: validation.width,
        height: validation.height,
        size: file.size,
        uploaded_at: new Date().toISOString(),
      }

      const currentDiscount = await retryOperation(async () => {
        const { data, error } = await withTimeout(
          supabase.from('discount_profiles').select('discount_poster').eq('id', discountId).single(),
        )
        if (error) throw error
        return data
      })

      const existingPosters = parsePosterArray(currentDiscount?.discount_poster)
      const updatedPosters = [...existingPosters, posterMetadata]

      await retryOperation(async () => {
        const { error } = await withTimeout(
          supabase.from('discount_profiles').update({ discount_poster: updatedPosters }).eq('id', discountId),
        )
        if (error) throw error
      })

      return ok(posterMetadata)
    } catch (error) {
      return fail(error)
    }
  })
}

export async function deleteDiscountPoster(
  discountId: string,
  posterId: string,
  options?: { shopId?: string; accessContext?: DiscountAccessContext; scope?: DiscountFetchScope },
): Promise<DiscountServiceResponse<{ deletedPosterId: string }>> {
  const requestKey = `delete-poster-${discountId}-${posterId}`

  return deduplicateRequest(requestKey, async () => {
    try {
      if (!discountId || !posterId) {
        throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_INPUT, 'Discount ID and poster ID are required.')
      }

      if (options?.shopId) {
        await assertDiscountManageAccess(options.shopId, options.accessContext, options?.scope)
      }

      const currentDiscount = await retryOperation(async () => {
        const { data, error } = await withTimeout(
          supabase.from('discount_profiles').select('discount_poster').eq('id', discountId).single(),
        )
        if (error) throw error
        return data
      })

      const existingPosters = parsePosterArray(currentDiscount?.discount_poster)
      const posterToDelete = existingPosters.find((p) => p.id === posterId)
      if (!posterToDelete) throw new DiscountError(DISCOUNT_ERROR_CODES.POSTER_NOT_FOUND)

      try {
        await withTimeout(
          supabase.storage.from(DISCOUNT_POSTER_CONFIG.BUCKET_NAME).remove([posterToDelete.file_path]),
        )
      } catch {
        // Best effort storage cleanup — continue with DB update.
      }

      const updatedPosters = existingPosters.filter((p) => p.id !== posterId)

      await retryOperation(async () => {
        const { error } = await withTimeout(
          supabase.from('discount_profiles').update({ discount_poster: updatedPosters }).eq('id', discountId),
        )
        if (error) throw error
      })

      return ok({ deletedPosterId: posterId })
    } catch (error) {
      return fail(error)
    }
  })
}

export async function updatePosterMetadata(
  discountId: string,
  posterId: string,
  newName: string,
  options?: { shopId?: string; accessContext?: DiscountAccessContext; scope?: DiscountFetchScope },
): Promise<DiscountServiceResponse<DiscountPosterMetadata>> {
  const requestKey = `update-poster-${discountId}-${posterId}`

  return deduplicateRequest(requestKey, async () => {
    try {
      if (!discountId || !posterId || !newName?.trim()) {
        throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_INPUT, 'Discount ID, poster ID, and new name are required.')
      }

      if (options?.shopId) {
        await assertDiscountManageAccess(options.shopId, options.accessContext, options?.scope)
      }

      const currentDiscount = await retryOperation(async () => {
        const { data, error } = await withTimeout(
          supabase.from('discount_profiles').select('discount_poster').eq('id', discountId).single(),
        )
        if (error) throw error
        return data
      })

      const existingPosters = parsePosterArray(currentDiscount?.discount_poster)
      const posterIndex = existingPosters.findIndex((p) => p.id === posterId)
      if (posterIndex === -1) throw new DiscountError(DISCOUNT_ERROR_CODES.POSTER_NOT_FOUND)

      const updatedPoster: DiscountPosterMetadata = {
        ...existingPosters[posterIndex],
        name: newName,
        slug: generatePosterSlug(newName),
        updated_at: new Date().toISOString(),
      }

      const updatedPosters = [...existingPosters]
      updatedPosters[posterIndex] = updatedPoster

      await retryOperation(async () => {
        const { error } = await withTimeout(
          supabase.from('discount_profiles').update({ discount_poster: updatedPosters }).eq('id', discountId),
        )
        if (error) throw error
      })

      return ok(updatedPoster)
    } catch (error) {
      return fail(error)
    }
  })
}

export async function assignDiscountToCustomer(options: {
  discountId: string
  shopId: string
  usernameOrEmail: string
  assignmentCode?: string | null
  accessContext?: DiscountAccessContext
  scope?: DiscountFetchScope
}): Promise<DiscountServiceResponse<{ userId: string }>> {
  try {
    await assertDiscountManageAccess(options.shopId, options.accessContext, options.scope)
    const needle = options.usernameOrEmail.trim()
    if (!needle) {
      throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_INPUT, 'Enter a username or email.')
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, email')
      .or(`username.ilike.${needle},email.ilike.${needle}`)
      .limit(1)
      .maybeSingle()

    if (profileError || !profile?.id) {
      throw new DiscountError(DISCOUNT_ERROR_CODES.INVALID_INPUT, 'No customer matched that username or email.')
    }

    const { data: session } = await supabase.auth.getUser()
    const { error } = await supabase.from('discount_assignments').upsert(
      {
        discount_profile_id: options.discountId,
        user_id: profile.id,
        assignment_code: options.assignmentCode?.trim() || null,
        created_by: session.user?.id ?? null,
      },
      { onConflict: 'discount_profile_id,user_id' },
    )
    if (error) throw error
    return ok({ userId: profile.id }, 'Offer assigned')
  } catch (error) {
    return fail(error)
  }
}

export function clearDiscountRequestCache(): void {
  pendingRequests.clear()
}
