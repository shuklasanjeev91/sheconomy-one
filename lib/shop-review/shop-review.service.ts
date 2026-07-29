/**
 * Shop review service — typed data-access for buyer, vendor, admin, and shared flows.
 *
 * Ported from legacy `shop-review.js` and `update-shop-ratings.js`.
 * Components should dispatch thunks from `shop-review.store` rather than calling directly.
 */

import { canManageShop, isAdminRole } from '~/lib/shop/shop.utils'
import { supabase } from '~/lib/supabase'

import {
  DEFAULT_VENDOR_SHOP_REVIEW_STATUSES,
  SHOP_REVIEW_BULK_ACTION_TO_STATUS,
  SHOP_REVIEW_ELIGIBILITY_REASONS,
  SHOP_REVIEW_STATUS,
  SHOP_REVIEW_SUCCESS_MESSAGES,
} from '~/lib/shop-review/shop-review.constants'
import {
  ShopReviewError,
  SHOP_REVIEW_ERROR_CODES,
  toFriendlyShopReviewError,
} from '~/lib/shop-review/shop-review.errors'
import type {
  DeleteShopReviewResult,
  ShopReviewAccessContext,
  ShopReviewBulkModerationInput,
  ShopReviewCreateInput,
  ShopReviewEligibility,
  ShopReviewFetchResult,
  ShopReviewFetchScope,
  ShopReviewFilterInput,
  ShopReviewHelpfulnessInput,
  ShopReviewModerationInput,
  ShopReviewQueryInput,
  ShopReviewRatingsRefreshResult,
  ShopReviewReportInput,
  ShopReviewResponse,
  ShopReviewResponseCreateInput,
  ShopReviewServiceResponse,
  ShopReviewStats,
  ShopReviewStatsQueryInput,
  ShopReviewUpdateInput,
  ShopReviewWithRelations,
} from '~/lib/shop-review/shop-review.type'
import {
  buildShopReviewStatsFromReviews,
  computeShopReviewPagination,
  normalizeShopReviewRow,
  normalizeShopReviewRows,
  resolveShopReviewSortColumn,
} from '~/lib/shop-review/shop-review.utils'
import {
  parseShopReviewBulkModeration,
  parseShopReviewCreate,
  parseShopReviewHelpfulness,
  parseShopReviewModeration,
  parseShopReviewQuery,
  parseShopReviewReport,
  parseShopReviewResponseCreate,
  parseShopReviewStatsQuery,
  parseShopReviewUpdate,
} from '~/lib/shop-review/shop-review.validation'

// ============= RESPONSE HELPERS =============

function ok<T>(data: T, message?: string | null): ShopReviewServiceResponse<T> {
  return { success: true, data, error: null, message: message ?? null }
}

function fail<T>(error: unknown, fallback?: string): ShopReviewServiceResponse<T> {
  return { success: false, data: null, error: toFriendlyShopReviewError(error, fallback) }
}

async function resolveUserId(userId?: string | null): Promise<string> {
  if (userId) return userId

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user?.id) {
    throw new ShopReviewError(SHOP_REVIEW_ERROR_CODES.NOT_AUTHENTICATED)
  }
  return data.user.id
}

async function assertShopReviewAccess(
  shopId: string,
  context?: ShopReviewAccessContext,
): Promise<{ shopId: string; userId: string }> {
  const userId = await resolveUserId(context?.userId)

  const { data: shop, error } = await supabase
    .from('shops')
    .select('id, user_id, is_active')
    .eq('id', shopId)
    .maybeSingle()

  if (error || !shop) {
    throw new ShopReviewError(SHOP_REVIEW_ERROR_CODES.SHOP_NOT_FOUND)
  }

  if (!canManageShop(shop, userId, context?.role)) {
    throw new ShopReviewError(SHOP_REVIEW_ERROR_CODES.MODERATION_DENIED)
  }

  return { shopId: shop.id, userId }
}

async function assertReviewModerationAccess(
  reviewId: string,
  context?: ShopReviewAccessContext,
): Promise<{ review: ShopReviewWithRelations; userId: string }> {
  const userId = await resolveUserId(context?.userId)

  const { data: review, error } = await supabase
    .from('shop_reviews')
    .select(`${REVIEW_DETAIL_SELECT}`)
    .eq('id', reviewId)
    .maybeSingle()

  if (error || !review) {
    throw new ShopReviewError(SHOP_REVIEW_ERROR_CODES.REVIEW_NOT_FOUND)
  }

  const typedReview = review as unknown as ShopReviewWithRelations
  const shop = typedReview.shops

  if (isAdminRole(context?.role)) {
    return { review: typedReview, userId }
  }

  if (shop && canManageShop({ user_id: shop.user_id }, userId, context?.role)) {
    return { review: typedReview, userId }
  }

  throw new ShopReviewError(SHOP_REVIEW_ERROR_CODES.MODERATION_DENIED)
}

const PUBLIC_REVIEW_SELECT =
  '*, profiles:reviewer_id(full_name, username, avatar_url), shop_review_responses(id, response_text, created_at, updated_at, is_public)'

const REVIEW_DETAIL_SELECT =
  '*, shops:shop_id(id, shop_name, user_id), profiles:reviewer_id(full_name, username, avatar_url), shop_review_responses(id, response_text, created_at, updated_at, is_public, shop_owner_id)'

function buildReviewSelect(includeResponses: boolean, scope: ShopReviewFetchScope): string {
  if (scope === 'public') {
    return includeResponses ? PUBLIC_REVIEW_SELECT : '*, profiles:reviewer_id(full_name, username, avatar_url)'
  }
  return includeResponses ? REVIEW_DETAIL_SELECT : `${REVIEW_DETAIL_SELECT.split(', shop_review_responses')[0]}`
}

// ============= RATING REFRESH =============

export async function refreshShopRatingsFromReviews(
  shopId: string,
): Promise<ShopReviewServiceResponse<ShopReviewRatingsRefreshResult>> {
  try {
    if (!shopId) {
      throw new ShopReviewError(SHOP_REVIEW_ERROR_CODES.INVALID_INPUT, 'Shop ID is required.')
    }

    const { data: reviews, error: reviewsError } = await supabase
      .from('shop_reviews')
      .select('rating')
      .eq('shop_id', shopId)
      .eq('review_status', SHOP_REVIEW_STATUS.APPROVED)

    if (reviewsError) throw reviewsError

    const totalReviews = reviews?.length ?? 0
    const averageRating =
      totalReviews > 0
        ? Math.round(((reviews ?? []).reduce((sum, row) => sum + row.rating, 0) / totalReviews) * 10) / 10
        : 0

    const { error: updateError } = await supabase
      .from('shops')
      .update({
        average_rating: averageRating,
        total_reviews: totalReviews,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shopId)

    if (updateError) throw updateError

    return ok(
      { shop_id: shopId, average_rating: averageRating, total_reviews: totalReviews },
      SHOP_REVIEW_SUCCESS_MESSAGES.RATINGS_REFRESHED,
    )
  } catch (error) {
    return fail(error)
  }
}

function scheduleShopRatingsRefresh(shopId: string): void {
  void refreshShopRatingsFromReviews(shopId)
}

// ============= READ =============

export async function fetchShopReviews(
  query: ShopReviewQueryInput,
  options: {
    scope?: ShopReviewFetchScope
    accessContext?: ShopReviewAccessContext
  } = {},
): Promise<ShopReviewServiceResponse<ShopReviewFetchResult>> {
  try {
    const scope = options.scope ?? 'public'
    const parsed = parseShopReviewQuery(query)

    if (scope === 'management') {
      await assertShopReviewAccess(parsed.shop_id, options.accessContext)
    }

    const select = buildReviewSelect(parsed.include_responses ?? true, scope)
    const sortColumn = resolveShopReviewSortColumn(parsed.sort_by)
    const offset = (parsed.page - 1) * parsed.limit

    let dbQuery = supabase.from('shop_reviews').select(select, { count: 'exact' }).eq('shop_id', parsed.shop_id)

    if (scope === 'public') {
      dbQuery = dbQuery.eq('review_status', SHOP_REVIEW_STATUS.APPROVED)
    } else if (parsed.status) {
      dbQuery = dbQuery.eq('review_status', parsed.status)
    }

    if (parsed.min_rating != null) dbQuery = dbQuery.gte('rating', parsed.min_rating)
    if (parsed.max_rating != null) dbQuery = dbQuery.lte('rating', parsed.max_rating)
    if (parsed.verified_only) dbQuery = dbQuery.eq('is_verified_purchase', true)
    if (parsed.date_from) dbQuery = dbQuery.gte('created_at', parsed.date_from)
    if (parsed.date_to) dbQuery = dbQuery.lte('created_at', parsed.date_to)
    if (parsed.search_term) {
      dbQuery = dbQuery.or(
        `title.ilike.%${parsed.search_term}%,review_text.ilike.%${parsed.search_term}%`,
      )
    }

    dbQuery = dbQuery.order(sortColumn, { ascending: parsed.sort_order === 'asc' })

    const { data, error, count } = await dbQuery.range(offset, offset + parsed.limit - 1)
    if (error) throw error

    const reviews = normalizeShopReviewRows((data ?? []) as unknown as ShopReviewWithRelations[])
    const total = count ?? reviews.length

    return ok({
      reviews,
      pagination: computeShopReviewPagination(parsed.page, parsed.limit, total),
    })
  } catch (error) {
    return fail(error)
  }
}

export async function fetchShopReviewById(
  reviewId: string,
  options: {
    scope?: ShopReviewFetchScope
    includeResponses?: boolean
    accessContext?: ShopReviewAccessContext
  } = {},
): Promise<ShopReviewServiceResponse<ShopReviewWithRelations>> {
  try {
    const scope = options.scope ?? 'public'
    const select = buildReviewSelect(options.includeResponses ?? true, scope)

    let query = supabase.from('shop_reviews').select(select).eq('id', reviewId)
    if (scope === 'public') {
      query = query.eq('review_status', SHOP_REVIEW_STATUS.APPROVED)
    }

    const { data, error } = await query.maybeSingle()
    if (error) throw error
    if (!data) {
      throw new ShopReviewError(SHOP_REVIEW_ERROR_CODES.REVIEW_NOT_FOUND)
    }

    const review = normalizeShopReviewRow(data as unknown as ShopReviewWithRelations)

    if (scope === 'management') {
      await assertShopReviewAccess(review.shop_id, options.accessContext)
    }

    return ok(review)
  } catch (error) {
    return fail(error)
  }
}

export async function fetchUserShopReviews(
  options: {
    page?: number
    limit?: number
    status?: ShopReviewFilterInput['status']
    accessContext?: ShopReviewAccessContext
  } = {},
): Promise<ShopReviewServiceResponse<ShopReviewFetchResult>> {
  try {
    const userId = await resolveUserId(options.accessContext?.userId)
    const page = options.page ?? 1
    const limit = options.limit ?? 10
    const offset = (page - 1) * limit

    let query = supabase
      .from('shop_reviews')
      .select(`${REVIEW_DETAIL_SELECT}`, { count: 'exact' })
      .eq('reviewer_id', userId)

    if (options.status) {
      query = query.eq('review_status', options.status)
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const reviews = normalizeShopReviewRows((data ?? []) as unknown as ShopReviewWithRelations[])
    const total = count ?? reviews.length

    return ok({
      reviews,
      pagination: computeShopReviewPagination(page, limit, total),
    })
  } catch (error) {
    return fail(error)
  }
}

export async function fetchShopOwnerReviews(
  options: {
    shopId?: string | null
    page?: number
    limit?: number
    status?: ShopReviewFilterInput['status']
    accessContext?: ShopReviewAccessContext
  } = {},
): Promise<ShopReviewServiceResponse<ShopReviewFetchResult>> {
  try {
    const userId = await resolveUserId(options.accessContext?.userId)
    const page = options.page ?? 1
    const limit = options.limit ?? 10
    const offset = (page - 1) * limit

    let shopIds: string[] = []

    if (options.shopId) {
      const { shopId } = await assertShopReviewAccess(options.shopId, options.accessContext)
      shopIds = [shopId]
    } else if (isAdminRole(options.accessContext?.role)) {
      return ok({
        reviews: [],
        pagination: computeShopReviewPagination(page, limit, 0),
      })
    } else {
      const { data: shops, error } = await supabase
        .from('shops')
        .select('id')
        .eq('user_id', userId)

      if (error) throw error
      shopIds = (shops ?? []).map((shop) => shop.id)
    }

    if (!shopIds.length) {
      return ok({
        reviews: [],
        pagination: computeShopReviewPagination(page, limit, 0),
      })
    }

    let query = supabase
      .from('shop_reviews')
      .select(`${REVIEW_DETAIL_SELECT}`, { count: 'exact' })
      .in('shop_id', shopIds)

    if (options.status) {
      query = query.eq('review_status', options.status)
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const reviews = normalizeShopReviewRows((data ?? []) as unknown as ShopReviewWithRelations[])
    const total = count ?? reviews.length

    return ok({
      reviews,
      pagination: computeShopReviewPagination(page, limit, total),
    })
  } catch (error) {
    return fail(error)
  }
}

export async function fetchShopReviewStats(
  input: ShopReviewStatsQueryInput,
): Promise<ShopReviewServiceResponse<ShopReviewStats>> {
  try {
    const parsed = parseShopReviewStatsQuery(input)

    const rpc = await supabase.rpc('get_shop_review_stats', { p_shop_id: parsed.shop_id })
    if (!rpc.error && rpc.data) {
      const payload = rpc.data as Partial<ShopReviewStats>
      if (payload.total_reviews != null) {
        return ok({
          total_reviews: Number(payload.total_reviews ?? 0),
          verified_reviews: Number(payload.verified_reviews ?? 0),
          average_rating: Number(payload.average_rating ?? 0),
          rating_distribution: payload.rating_distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          rating_percentages: payload.rating_percentages ?? {},
          verification_rate: Number(payload.verification_rate ?? 0),
          categories: parsed.include_category_ratings ? payload.categories : undefined,
        })
      }
    }

    const { data, error } = await supabase
      .from('shop_reviews')
      .select(
        'rating, review_status, is_verified_purchase, product_quality_rating, customer_service_rating, shipping_speed_rating, value_for_money_rating',
      )
      .eq('shop_id', parsed.shop_id)
      .eq('review_status', SHOP_REVIEW_STATUS.APPROVED)

    if (error) throw error

    return ok(buildShopReviewStatsFromReviews(data ?? [], parsed.include_category_ratings))
  } catch (error) {
    return fail(error)
  }
}

// ============= CREATE / UPDATE / DELETE =============

export async function createShopReview(
  input: ShopReviewCreateInput,
  accessContext?: ShopReviewAccessContext,
): Promise<ShopReviewServiceResponse<ShopReviewWithRelations>> {
  try {
    const parsed = parseShopReviewCreate(input)
    const userId = await resolveUserId(accessContext?.userId)

    const eligibility = await checkShopReviewEligibility(parsed.shop_id, accessContext)
    if (!eligibility.data?.can_review) {
      throw new ShopReviewError(
        SHOP_REVIEW_ERROR_CODES.INVALID_INPUT,
        eligibility.data?.reason ?? SHOP_REVIEW_ELIGIBILITY_REASONS.CHECK_FAILED,
      )
    }

    const { data, error } = await supabase
      .from('shop_reviews')
      .insert({
        shop_id: parsed.shop_id,
        reviewer_id: userId,
        rating: parsed.rating,
        title: parsed.title?.trim() || null,
        review_text: parsed.review_text?.trim() || null,
        product_quality_rating: parsed.product_quality_rating ?? null,
        customer_service_rating: parsed.customer_service_rating ?? null,
        shipping_speed_rating: parsed.shipping_speed_rating ?? null,
        value_for_money_rating: parsed.value_for_money_rating ?? null,
        is_verified_purchase: parsed.is_verified_purchase ?? false,
        order_id: parsed.order_id ?? null,
        review_images: parsed.review_images ?? [],
        review_metadata: parsed.review_metadata ?? {},
        review_status: SHOP_REVIEW_STATUS.PENDING,
      })
      .select(REVIEW_DETAIL_SELECT)
      .single()

    if (error) throw error

    scheduleShopRatingsRefresh(parsed.shop_id)

    return ok(
      normalizeShopReviewRow(data as unknown as ShopReviewWithRelations),
      SHOP_REVIEW_SUCCESS_MESSAGES.CREATED,
    )
  } catch (error) {
    return fail(error)
  }
}

export async function updateShopReview(
  reviewId: string,
  input: ShopReviewUpdateInput,
  accessContext?: ShopReviewAccessContext,
): Promise<ShopReviewServiceResponse<ShopReviewWithRelations>> {
  try {
    const parsed = parseShopReviewUpdate(input)
    const userId = await resolveUserId(accessContext?.userId)

    const { data: existing, error: fetchError } = await supabase
      .from('shop_reviews')
      .select('id, reviewer_id, review_status, shop_id')
      .eq('id', reviewId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!existing) {
      throw new ShopReviewError(SHOP_REVIEW_ERROR_CODES.REVIEW_NOT_FOUND)
    }

    if (existing.reviewer_id !== userId) {
      throw new ShopReviewError(SHOP_REVIEW_ERROR_CODES.REVIEW_ACCESS_DENIED)
    }

    if (existing.review_status !== SHOP_REVIEW_STATUS.PENDING) {
      throw new ShopReviewError(SHOP_REVIEW_ERROR_CODES.PENDING_ONLY)
    }

    const { data, error } = await supabase
      .from('shop_reviews')
      .update({
        ...parsed,
        title: parsed.title === undefined ? undefined : parsed.title?.trim() || null,
        review_text: parsed.review_text === undefined ? undefined : parsed.review_text?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .eq('reviewer_id', userId)
      .eq('review_status', SHOP_REVIEW_STATUS.PENDING)
      .select(REVIEW_DETAIL_SELECT)
      .single()

    if (error) throw error

    return ok(
      normalizeShopReviewRow(data as unknown as ShopReviewWithRelations),
      SHOP_REVIEW_SUCCESS_MESSAGES.UPDATED,
    )
  } catch (error) {
    return fail(error)
  }
}

export async function deleteShopReview(
  reviewId: string,
  accessContext?: ShopReviewAccessContext,
): Promise<ShopReviewServiceResponse<DeleteShopReviewResult>> {
  try {
    const userId = await resolveUserId(accessContext?.userId)

    const { data: review, error: fetchError } = await supabase
      .from('shop_reviews')
      .select('id, reviewer_id, shop_id, shops:shop_id(user_id)')
      .eq('id', reviewId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!review) {
      throw new ShopReviewError(SHOP_REVIEW_ERROR_CODES.REVIEW_NOT_FOUND)
    }

    const shop = Array.isArray(review.shops) ? review.shops[0] : review.shops
    const canDelete =
      review.reviewer_id === userId ||
      shop?.user_id === userId ||
      isAdminRole(accessContext?.role)

    if (!canDelete) {
      throw new ShopReviewError(SHOP_REVIEW_ERROR_CODES.ACCESS_DENIED)
    }

    const { data, error } = await supabase
      .from('shop_reviews')
      .update({
        review_status: SHOP_REVIEW_STATUS.HIDDEN,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select('id, shop_id')
      .single()

    if (error) throw error

    scheduleShopRatingsRefresh(review.shop_id)

    return ok(
      { review_id: data.id, shop_id: data.shop_id },
      SHOP_REVIEW_SUCCESS_MESSAGES.DELETED,
    )
  } catch (error) {
    return fail(error)
  }
}

export async function moderateShopReviews(
  reviewIds: string[],
  updates: ShopReviewModerationInput,
  accessContext?: ShopReviewAccessContext,
): Promise<ShopReviewServiceResponse<ShopReviewWithRelations[]>> {
  try {
    const parsed = parseShopReviewModeration(updates)
    const userId = await resolveUserId(accessContext?.userId)

    for (const reviewId of reviewIds) {
      await assertReviewModerationAccess(reviewId, accessContext)
    }

    const { data, error } = await supabase
      .from('shop_reviews')
      .update({
        review_status: parsed.review_status,
        moderation_reason: parsed.moderation_reason,
        moderated_by: userId,
        moderated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', reviewIds)
      .select(REVIEW_DETAIL_SELECT)

    if (error) throw error

    const reviews = normalizeShopReviewRows((data ?? []) as unknown as ShopReviewWithRelations[])
    const shopIds = [...new Set(reviews.map((review) => review.shop_id))]
    shopIds.forEach(scheduleShopRatingsRefresh)

    return ok(reviews, SHOP_REVIEW_SUCCESS_MESSAGES.MODERATED)
  } catch (error) {
    return fail(error)
  }
}

export async function bulkModerateShopReviews(
  input: ShopReviewBulkModerationInput,
  accessContext?: ShopReviewAccessContext,
): Promise<ShopReviewServiceResponse<ShopReviewWithRelations[]>> {
  const parsed = parseShopReviewBulkModeration(input)
  return moderateShopReviews(
    parsed.review_ids,
    {
      review_status: SHOP_REVIEW_BULK_ACTION_TO_STATUS[parsed.action],
      moderation_reason: parsed.reason,
    },
    accessContext,
  )
}

// ============= RESPONSES / VOTES / REPORTS =============

export async function createShopReviewResponse(
  input: ShopReviewResponseCreateInput,
  accessContext?: ShopReviewAccessContext,
): Promise<ShopReviewServiceResponse<ShopReviewResponse>> {
  try {
    const parsed = parseShopReviewResponseCreate(input)
    const userId = await resolveUserId(accessContext?.userId)

    const { data: review, error: reviewError } = await supabase
      .from('shop_reviews')
      .select('id, shop_id, review_status, shop_review_responses(id), shops:shop_id(user_id)')
      .eq('id', parsed.review_id)
      .maybeSingle()

    if (reviewError) throw reviewError
    if (!review) {
      throw new ShopReviewError(SHOP_REVIEW_ERROR_CODES.REVIEW_NOT_FOUND)
    }

    const shop = Array.isArray(review.shops) ? review.shops[0] : review.shops
    if (!canManageShop(shop as { user_id: string }, userId, accessContext?.role)) {
      throw new ShopReviewError(SHOP_REVIEW_ERROR_CODES.MODERATION_DENIED)
    }

    if (review.review_status !== SHOP_REVIEW_STATUS.APPROVED) {
      throw new ShopReviewError(SHOP_REVIEW_ERROR_CODES.INVALID_INPUT, 'Only approved reviews can be responded to.')
    }

    if ((review.shop_review_responses ?? []).length > 0) {
      throw new ShopReviewError(SHOP_REVIEW_ERROR_CODES.RESPONSE_EXISTS)
    }

    const { data, error } = await supabase
      .from('shop_review_responses')
      .insert({
        review_id: parsed.review_id,
        shop_owner_id: userId,
        response_text: parsed.response_text.trim(),
        is_public: parsed.is_public ?? true,
      })
      .select()
      .single()

    if (error) throw error

    return ok(data as ShopReviewResponse, SHOP_REVIEW_SUCCESS_MESSAGES.RESPONSE_CREATED)
  } catch (error) {
    return fail(error)
  }
}

export async function voteShopReviewHelpfulness(
  input: ShopReviewHelpfulnessInput,
  accessContext?: ShopReviewAccessContext,
): Promise<ShopReviewServiceResponse<ShopReviewWithRelations>> {
  try {
    const parsed = parseShopReviewHelpfulness(input)
    const userId = await resolveUserId(accessContext?.userId)

    const { error } = await supabase.from('shop_review_helpfulness').upsert(
      {
        review_id: parsed.review_id,
        user_id: userId,
        is_helpful: parsed.is_helpful,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'review_id,user_id' },
    )

    if (error) throw error

    const review = await fetchShopReviewById(parsed.review_id, { scope: 'public' })
    if (!review.success || !review.data) throw review.error

    return ok(review.data, SHOP_REVIEW_SUCCESS_MESSAGES.VOTE_RECORDED)
  } catch (error) {
    return fail(error)
  }
}

export async function removeShopReviewHelpfulnessVote(
  reviewId: string,
  accessContext?: ShopReviewAccessContext,
): Promise<ShopReviewServiceResponse<ShopReviewWithRelations>> {
  try {
    const userId = await resolveUserId(accessContext?.userId)

    const { error } = await supabase
      .from('shop_review_helpfulness')
      .delete()
      .eq('review_id', reviewId)
      .eq('user_id', userId)

    if (error) throw error

    const review = await fetchShopReviewById(reviewId, { scope: 'public' })
    if (!review.success || !review.data) throw review.error

    return ok(review.data, SHOP_REVIEW_SUCCESS_MESSAGES.VOTE_REMOVED)
  } catch (error) {
    return fail(error)
  }
}

export async function reportShopReview(
  input: ShopReviewReportInput,
  accessContext?: ShopReviewAccessContext,
): Promise<ShopReviewServiceResponse<{ report_id: string }>> {
  try {
    const parsed = parseShopReviewReport(input)
    const userId = await resolveUserId(accessContext?.userId)

    const { data, error } = await supabase
      .from('shop_review_reports')
      .insert({
        review_id: parsed.review_id,
        reporter_id: userId,
        report_reason: parsed.report_reason,
        report_description: parsed.report_description,
      })
      .select('id')
      .single()

    if (error) throw error

    return ok({ report_id: data.id }, SHOP_REVIEW_SUCCESS_MESSAGES.REPORTED)
  } catch (error) {
    return fail(error)
  }
}

// ============= ELIGIBILITY =============

export async function checkShopReviewEligibility(
  shopId: string,
  accessContext?: ShopReviewAccessContext,
): Promise<ShopReviewServiceResponse<ShopReviewEligibility>> {
  try {
    const userId = await resolveUserId(accessContext?.userId).catch(() => null)
    if (!userId) {
      return ok({ can_review: false, reason: SHOP_REVIEW_ELIGIBILITY_REASONS.NOT_AUTHENTICATED })
    }

    const { data: shop, error } = await supabase
      .from('shops')
      .select('id, user_id, is_active')
      .eq('id', shopId)
      .maybeSingle()

    if (error) throw error
    if (!shop) {
      return ok({ can_review: false, reason: SHOP_REVIEW_ELIGIBILITY_REASONS.SHOP_NOT_FOUND })
    }

    if (!shop.is_active) {
      return ok({ can_review: false, reason: SHOP_REVIEW_ELIGIBILITY_REASONS.SHOP_INACTIVE })
    }

    if (shop.user_id === userId) {
      return ok({ can_review: false, reason: SHOP_REVIEW_ELIGIBILITY_REASONS.OWN_SHOP })
    }

    const { data: existingReview, error: reviewError } = await supabase
      .from('shop_reviews')
      .select('id')
      .eq('shop_id', shopId)
      .eq('reviewer_id', userId)
      .maybeSingle()

    if (reviewError && reviewError.code !== 'PGRST116') throw reviewError
    if (existingReview) {
      return ok({ can_review: false, reason: SHOP_REVIEW_ELIGIBILITY_REASONS.ALREADY_REVIEWED })
    }

    return ok({ can_review: true, reason: null })
  } catch (error) {
    return ok({ can_review: false, reason: SHOP_REVIEW_ELIGIBILITY_REASONS.CHECK_FAILED })
  }
}

export async function fetchUserShopReview(
  shopId: string,
  accessContext?: ShopReviewAccessContext,
): Promise<ShopReviewServiceResponse<ShopReviewWithRelations | null>> {
  try {
    const userId = await resolveUserId(accessContext?.userId)

    const { data, error } = await supabase
      .from('shop_reviews')
      .select(PUBLIC_REVIEW_SELECT)
      .eq('shop_id', shopId)
      .eq('reviewer_id', userId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') throw error

    return ok(data ? normalizeShopReviewRow(data as unknown as ShopReviewWithRelations) : null)
  } catch (error) {
    return fail(error)
  }
}
