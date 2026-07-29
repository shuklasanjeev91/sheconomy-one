/**
 * Listing review service — typed data-access for buyer, vendor, admin, and shared flows.
 *
 * Ported from legacy `listing-reviews.js`. Components should dispatch thunks from
 * `listing-reviews.store` rather than calling these functions directly.
 */

import { canManageShop, isAdminRole } from '~/lib/shop/shop.utils'
import { supabase } from '~/lib/supabase'

import {
  DEFAULT_VENDOR_REVIEW_STATUSES,
  LISTING_REVIEW_ELIGIBILITY_REASONS,
  LISTING_REVIEW_STATUS,
  LISTING_REVIEW_SUCCESS_MESSAGES,
  LISTING_REVIEW_VALIDATION,
} from '~/lib/listing-reviews/listing-reviews.constants'
import {
  ListingReviewError,
  LISTING_REVIEW_ERROR_CODES,
  toFriendlyListingReviewError,
} from '~/lib/listing-reviews/listing-reviews.errors'
import type {
  DeleteListingReviewResult,
  ListingReviewAccessContext,
  ListingReviewAnalyticsParams,
  ListingReviewBatchModerationInput,
  ListingReviewCreateInput,
  ListingReviewEligibility,
  ListingReviewFetchResult,
  ListingReviewFetchScope,
  ListingReviewFilterInput,
  ListingReviewHelpfulnessInput,
  ListingReviewModerationInput,
  ListingReviewReplyCreateInput,
  ListingReviewReplyUpdateInput,
  ListingReviewReportInput,
  ListingReviewReply,
  ListingReviewServiceResponse,
  ListingReviewSummary,
  ListingReviewUpdateInput,
  ListingReviewVendorDashboard,
  ListingReviewWithRelations,
} from '~/lib/listing-reviews/listing-reviews.type'
import {
  buildDefaultListingReviewSummary,
  fillListingReviewSummaries,
  resolveListingReviewSortColumn,
} from '~/lib/listing-reviews/listing-reviews.utils'
import {
  parseListingReviewAnalyticsParams,
  parseListingReviewBatchModeration,
  parseListingReviewCreate,
  parseListingReviewFilter,
  parseListingReviewHelpfulness,
  parseListingReviewReplyCreate,
  parseListingReviewReplyUpdate,
  parseListingReviewReport,
  parseListingReviewUpdate,
} from '~/lib/listing-reviews/listing-reviews.validation'

// ============= RESPONSE HELPERS =============

function ok<T>(data: T, message?: string | null): ListingReviewServiceResponse<T> {
  return { success: true, data, error: null, message: message ?? null }
}

function fail<T>(error: unknown, fallback?: string): ListingReviewServiceResponse<T> {
  return { success: false, data: null, error: toFriendlyListingReviewError(error, fallback) }
}

async function resolveUserId(userId?: string | null): Promise<string> {
  if (userId) return userId

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user?.id) {
    throw new ListingReviewError(LISTING_REVIEW_ERROR_CODES.NOT_AUTHENTICATED)
  }
  return data.user.id
}

const REVIEW_DETAIL_SELECT =
  '*, listing:listings(id, title, listing_type, slug, price, shop_id, shop:shops(id, shop_name, logo_url, verified, user_id)), reviewer:profiles!listing_reviews_reviewer_id_fkey(id, username, full_name, avatar_url), variation:listing_variations(id, variation_name, variation_value), replies:listing_review_replies(id, reply_text, is_vendor_reply, is_pinned, is_public, created_at, updated_at, replier_id, parent_reply_id, replier:profiles(id, username, full_name, avatar_url)), helpfulness_votes:listing_review_helpfulness(id, is_helpful, user_id)'

/** Vendor management reads — inner-join listings so shop_id filters work reliably. */
const MANAGEMENT_SHOP_REVIEW_SELECT =
  '*, listing:listings!inner(id, title, listing_type, slug, price, shop_id, shop:shops(id, shop_name, logo_url, verified, user_id)), reviewer:profiles!listing_reviews_reviewer_id_fkey(id, username, full_name, avatar_url), variation:listing_variations(id, variation_name, variation_value), replies:listing_review_replies(id, reply_text, is_vendor_reply, is_pinned, is_public, created_at, updated_at, replier_id, parent_reply_id, replier:profiles(id, username, full_name, avatar_url)), helpfulness_votes:listing_review_helpfulness(id, is_helpful, user_id)'

const PUBLIC_REVIEW_SELECT =
  '*, listing:listings(id, title, listing_type, shop_id), reviewer:profiles!listing_reviews_reviewer_id_fkey(id, username, full_name, avatar_url)'

async function fetchListingIdsForShop(shopId: string): Promise<string[]> {
  const { data, error } = await supabase.from('listings').select('id').eq('shop_id', shopId)
  if (error) throw error
  return (data ?? []).map((row) => row.id)
}

async function assertShopReviewAccess(
  shopId: string,
  context?: ListingReviewAccessContext,
): Promise<{ shopId: string; userId: string }> {
  const userId = await resolveUserId(context?.userId)

  const { data: shop, error } = await supabase
    .from('shops')
    .select('id, user_id')
    .eq('id', shopId)
    .maybeSingle()

  if (error || !shop) {
    throw new ListingReviewError(LISTING_REVIEW_ERROR_CODES.ACCESS_DENIED)
  }

  if (!canManageShop(shop, userId, context?.role)) {
    throw new ListingReviewError(LISTING_REVIEW_ERROR_CODES.MODERATION_DENIED)
  }

  return { shopId: shop.id, userId }
}

async function assertReviewModerationAccess(
  reviewId: string,
  context?: ListingReviewAccessContext,
): Promise<{ review: ListingReviewWithRelations; userId: string }> {
  const userId = await resolveUserId(context?.userId)

  const { data: review, error } = await supabase
    .from('listing_reviews')
    .select(`${REVIEW_DETAIL_SELECT}`)
    .eq('id', reviewId)
    .maybeSingle()

  if (error || !review) {
    throw new ListingReviewError(LISTING_REVIEW_ERROR_CODES.REVIEW_NOT_FOUND)
  }

  const typedReview = review as unknown as ListingReviewWithRelations
  const shop = typedReview.listing?.shop

  if (isAdminRole(context?.role)) {
    return { review: typedReview, userId }
  }

  if (shop && canManageShop({ user_id: shop.user_id }, userId, context?.role)) {
    return { review: typedReview, userId }
  }

  throw new ListingReviewError(LISTING_REVIEW_ERROR_CODES.MODERATION_DENIED)
}

// ============= READ =============

export async function fetchListingReviews(
  filters: ListingReviewFilterInput = {},
  options: {
    scope?: ListingReviewFetchScope
    accessContext?: ListingReviewAccessContext
    forceRefresh?: boolean
  } = {},
): Promise<ListingReviewServiceResponse<ListingReviewFetchResult>> {
  try {
    const scope = options.scope ?? 'public'
    const parsedFilters = parseListingReviewFilter(filters)

    if (scope === 'management') {
      if (!parsedFilters.shop_id && !parsedFilters.listing_ids?.length) {
        throw new ListingReviewError(LISTING_REVIEW_ERROR_CODES.INVALID_INPUT)
      }
      if (parsedFilters.shop_id) {
        await assertShopReviewAccess(parsedFilters.shop_id, options.accessContext)
      }
    }

    const useShopJoin = scope === 'management' && Boolean(parsedFilters.shop_id)
    let listingIds = parsedFilters.listing_ids ?? null

    if (parsedFilters.shop_id && !useShopJoin) {
      const shopListingIds = await fetchListingIdsForShop(parsedFilters.shop_id)
      if (!shopListingIds.length) {
        return ok({ reviews: [], total: 0, hasMore: false })
      }
      listingIds = listingIds?.length
        ? listingIds.filter((id) => shopListingIds.includes(id))
        : shopListingIds
      if (!listingIds.length) {
        return ok({ reviews: [], total: 0, hasMore: false })
      }
    }

    const effectiveFilters = {
      ...parsedFilters,
      listing_ids: useShopJoin ? null : listingIds,
      shop_id: useShopJoin ? parsedFilters.shop_id : null,
      status:
        scope === 'public'
          ? [LISTING_REVIEW_STATUS.APPROVED]
          : parsedFilters.status ?? [...DEFAULT_VENDOR_REVIEW_STATUSES],
    }

    const sortColumn = resolveListingReviewSortColumn(effectiveFilters.sort_by)
    const select = useShopJoin
      ? MANAGEMENT_SHOP_REVIEW_SELECT
      : scope === 'public'
        ? PUBLIC_REVIEW_SELECT
        : REVIEW_DETAIL_SELECT

    let query = supabase.from('listing_reviews').select(select, { count: 'exact' })

    if (useShopJoin && effectiveFilters.shop_id) {
      query = query.eq('listing.shop_id', effectiveFilters.shop_id)
    } else if (effectiveFilters.listing_ids?.length) {
      query = query.in('listing_id', effectiveFilters.listing_ids)
    }
    if (effectiveFilters.rating?.length) {
      query = query.in('rating', effectiveFilters.rating)
    }
    if (scope === 'public') {
      query = query.eq('review_status', LISTING_REVIEW_STATUS.APPROVED)
    } else if (effectiveFilters.status?.length) {
      query = query.in('review_status', effectiveFilters.status)
    }
    if (effectiveFilters.verified_only) {
      query = query.eq('is_verified_purchase', true)
    }
    if (effectiveFilters.sentiment?.length) {
      query = query.in('auto_sentiment', effectiveFilters.sentiment)
    }
    if (effectiveFilters.date_from) {
      query = query.gte('created_at', effectiveFilters.date_from)
    }
    if (effectiveFilters.date_to) {
      query = query.lte('created_at', effectiveFilters.date_to)
    }
    if (effectiveFilters.search_term) {
      query = query.or(
        `title.ilike.%${effectiveFilters.search_term}%,review_text.ilike.%${effectiveFilters.search_term}%`,
      )
    }
    if (effectiveFilters.has_images) {
      query = query.not('review_images', 'eq', '[]')
    }
    if (effectiveFilters.has_replies) {
      query = query.gt('reply_count', 0)
    }
    if (effectiveFilters.min_helpfulness != null) {
      query = query.gte('helpful_count', effectiveFilters.min_helpfulness)
    }

    query = query.order(sortColumn, { ascending: effectiveFilters.sort_order === 'asc' })

    if (scope === 'public' && sortColumn === 'created_at') {
      query = query
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
    }

    const { data, error, count } = await query.range(
      effectiveFilters.offset,
      effectiveFilters.offset + effectiveFilters.limit - 1,
    )
    if (error) throw error

    const reviews = (data ?? []) as unknown as ListingReviewWithRelations[]
    const total = count ?? reviews.length
    const hasMore = reviews.length === effectiveFilters.limit && total > effectiveFilters.offset + reviews.length

    return ok({ reviews, total, hasMore })
  } catch (error) {
    return fail(error)
  }
}

export async function fetchListingReviewById(
  reviewId: string,
  options: { scope?: ListingReviewFetchScope; accessContext?: ListingReviewAccessContext } = {},
): Promise<ListingReviewServiceResponse<ListingReviewWithRelations>> {
  try {
    const scope = options.scope ?? 'public'
    const select = scope === 'public' ? PUBLIC_REVIEW_SELECT : REVIEW_DETAIL_SELECT

    let query = supabase.from('listing_reviews').select(select).eq('id', reviewId)
    if (scope === 'public') {
      query = query.eq('review_status', LISTING_REVIEW_STATUS.APPROVED)
    }

    const { data, error } = await query.maybeSingle()
    if (error) throw error
    if (!data) {
      throw new ListingReviewError(LISTING_REVIEW_ERROR_CODES.REVIEW_NOT_FOUND)
    }

    if (scope === 'management') {
      const shopId = (data as unknown as ListingReviewWithRelations).listing?.shop_id
      if (shopId) {
        await assertShopReviewAccess(shopId, options.accessContext)
      }
    }

    return ok(data as unknown as ListingReviewWithRelations)
  } catch (error) {
    return fail(error)
  }
}

export async function fetchListingReviewSummaries(
  listingIds: string[] | null | undefined,
): Promise<ListingReviewServiceResponse<ListingReviewSummary[]>> {
  const ids = listingIds ?? []
  try {
    if (!ids.length) return ok([])

    const { data, error } = await supabase
      .from('listing_review_analytics')
      .select(
        'listing_id, total_reviews, average_rating, rating_distribution, verified_purchase_percentage, updated_at, total_helpfulness_votes',
      )
      .in('listing_id', ids)
      .order('updated_at', { ascending: false })

    if (error) throw error

    const latestByListing = new Map<string, ListingReviewSummary>()
    for (const row of data ?? []) {
      if (latestByListing.has(row.listing_id)) continue

      const distribution =
        row.rating_distribution && typeof row.rating_distribution === 'object'
          ? (row.rating_distribution as Record<string, number>)
          : {}

      latestByListing.set(row.listing_id, {
        listing_id: row.listing_id,
        total_reviews: row.total_reviews ?? 0,
        average_rating: Number(row.average_rating ?? 0),
        rating_1_count: Number(distribution['1'] ?? distribution.rating_1_count ?? 0),
        rating_2_count: Number(distribution['2'] ?? distribution.rating_2_count ?? 0),
        rating_3_count: Number(distribution['3'] ?? distribution.rating_3_count ?? 0),
        rating_4_count: Number(distribution['4'] ?? distribution.rating_4_count ?? 0),
        rating_5_count: Number(distribution['5'] ?? distribution.rating_5_count ?? 0),
        verified_percentage: Number(row.verified_purchase_percentage ?? 0),
        latest_review_date: row.updated_at ?? null,
        total_helpful_votes: row.total_helpfulness_votes ?? 0,
      })
    }

    const summaries = fillListingReviewSummaries(ids, [...latestByListing.values()])
    return ok(summaries)
  } catch (error) {
    const fallback = ids.map((listingId) => buildDefaultListingReviewSummary(listingId))
    return ok(fallback)
  }
}

// ============= CREATE / UPDATE / DELETE =============

export async function createListingReview(
  input: ListingReviewCreateInput,
  accessContext?: ListingReviewAccessContext,
): Promise<ListingReviewServiceResponse<ListingReviewWithRelations>> {
  try {
    const parsed = parseListingReviewCreate(input)
    const userId = await resolveUserId(accessContext?.userId)

    const eligibility = await checkListingReviewEligibility(parsed.listing_id, accessContext)
    if (!eligibility.data?.canReview) {
      throw new ListingReviewError(
        LISTING_REVIEW_ERROR_CODES.INVALID_INPUT,
        eligibility.data?.reason ?? LISTING_REVIEW_ELIGIBILITY_REASONS.CHECK_FAILED,
      )
    }

    const { data, error } = await supabase
      .from('listing_reviews')
      .insert({
        ...parsed,
        reviewer_id: userId,
        review_status: LISTING_REVIEW_STATUS.PENDING,
      })
      .select(REVIEW_DETAIL_SELECT)
      .single()

    if (error) throw error

    return ok(data as unknown as ListingReviewWithRelations, LISTING_REVIEW_SUCCESS_MESSAGES.CREATED)
  } catch (error) {
    return fail(error)
  }
}

export async function updateListingReview(
  reviewId: string,
  input: ListingReviewUpdateInput,
  accessContext?: ListingReviewAccessContext,
): Promise<ListingReviewServiceResponse<ListingReviewWithRelations>> {
  try {
    const parsed = parseListingReviewUpdate(input)
    const userId = await resolveUserId(accessContext?.userId)

    const { data: existing, error: fetchError } = await supabase
      .from('listing_reviews')
      .select('id, reviewer_id, review_status')
      .eq('id', reviewId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!existing) {
      throw new ListingReviewError(LISTING_REVIEW_ERROR_CODES.REVIEW_NOT_FOUND)
    }

    if (existing.reviewer_id !== userId) {
      throw new ListingReviewError(LISTING_REVIEW_ERROR_CODES.REVIEW_ACCESS_DENIED)
    }

    if (existing.review_status !== LISTING_REVIEW_STATUS.PENDING) {
      throw new ListingReviewError(LISTING_REVIEW_ERROR_CODES.PENDING_ONLY)
    }

    const { data, error } = await supabase
      .from('listing_reviews')
      .update({
        ...parsed,
        title: parsed.title === undefined ? undefined : parsed.title?.trim() || null,
        review_text: parsed.review_text?.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .eq('reviewer_id', userId)
      .eq('review_status', LISTING_REVIEW_STATUS.PENDING)
      .select(REVIEW_DETAIL_SELECT)
      .single()

    if (error) throw error

    return ok(data as unknown as ListingReviewWithRelations, LISTING_REVIEW_SUCCESS_MESSAGES.UPDATED)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteListingReview(
  reviewId: string,
  accessContext?: ListingReviewAccessContext,
): Promise<ListingReviewServiceResponse<DeleteListingReviewResult>> {
  try {
    const userId = await resolveUserId(accessContext?.userId)

    const { data, error } = await supabase
      .from('listing_reviews')
      .delete()
      .eq('id', reviewId)
      .eq('reviewer_id', userId)
      .eq('review_status', LISTING_REVIEW_STATUS.PENDING)
      .select('id, listing_id')
      .single()

    if (error) throw error
    if (!data) {
      throw new ListingReviewError(LISTING_REVIEW_ERROR_CODES.PENDING_ONLY)
    }

    return ok(
      { reviewId: data.id, listingId: data.listing_id },
      LISTING_REVIEW_SUCCESS_MESSAGES.DELETED,
    )
  } catch (error) {
    return fail(error)
  }
}

export async function moderateListingReviews(
  input: ListingReviewBatchModerationInput,
  accessContext?: ListingReviewAccessContext,
): Promise<ListingReviewServiceResponse<ListingReviewWithRelations[]>> {
  try {
    const parsed = parseListingReviewBatchModeration(input)
    const userId = await resolveUserId(accessContext?.userId)

    for (const reviewId of parsed.review_ids) {
      await assertReviewModerationAccess(reviewId, accessContext)
    }

    const updates = {
      ...parsed.updates,
      moderated_by: userId,
      moderated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('listing_reviews')
      .update(updates)
      .in('id', parsed.review_ids)
      .select(REVIEW_DETAIL_SELECT)

    if (error) throw error

    return ok(
      (data ?? []) as unknown as ListingReviewWithRelations[],
      LISTING_REVIEW_SUCCESS_MESSAGES.MODERATED,
    )
  } catch (error) {
    return fail(error)
  }
}

export async function moderateListingReview(
  reviewId: string,
  updates: ListingReviewModerationInput,
  accessContext?: ListingReviewAccessContext,
): Promise<ListingReviewServiceResponse<ListingReviewWithRelations>> {
  const batch = await moderateListingReviews({ review_ids: [reviewId], updates }, accessContext)
  if (!batch.success || !batch.data?.length) {
    return { success: false, data: null, error: batch.error, message: batch.message }
  }
  return ok(batch.data[0], batch.message)
}

// ============= REPLIES =============

async function resolveVendorReplyFlag(reviewId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('listing_reviews')
    .select('listing:listings(shop:shops(user_id))')
    .eq('id', reviewId)
    .maybeSingle()

  const shopUserId = (data as { listing?: { shop?: { user_id?: string } } } | null)?.listing?.shop
    ?.user_id
  return shopUserId === userId
}

export async function createListingReviewReply(
  input: ListingReviewReplyCreateInput,
  accessContext?: ListingReviewAccessContext,
): Promise<ListingReviewServiceResponse<ListingReviewReply>> {
  try {
    const parsed = parseListingReviewReplyCreate(input)
    const userId = await resolveUserId(accessContext?.userId)
    const isVendorReply = await resolveVendorReplyFlag(parsed.review_id, userId)

    const { data, error } = await supabase
      .from('listing_review_replies')
      .insert({
        ...parsed,
        replier_id: userId,
        is_vendor_reply: isVendorReply,
      })
      .select(
        `
        *,
        replier:profiles(id, username, full_name, avatar_url),
        parent_reply:listing_review_replies(id, reply_text, replier:profiles(username))
      `,
      )
      .single()

    if (error) throw error

    return ok(data as ListingReviewReply, LISTING_REVIEW_SUCCESS_MESSAGES.REPLY_CREATED)
  } catch (error) {
    return fail(error)
  }
}

export async function updateListingReviewReply(
  replyId: string,
  input: ListingReviewReplyUpdateInput,
  accessContext?: ListingReviewAccessContext,
): Promise<ListingReviewServiceResponse<ListingReviewReply>> {
  try {
    const parsed = parseListingReviewReplyUpdate(input)
    const userId = await resolveUserId(accessContext?.userId)

    const { data, error } = await supabase
      .from('listing_review_replies')
      .update({
        ...parsed,
        reply_text: parsed.reply_text?.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', replyId)
      .eq('replier_id', userId)
      .select(
        `
        *,
        replier:profiles(id, username, full_name, avatar_url)
      `,
      )
      .single()

    if (error) throw error
    if (!data) {
      throw new ListingReviewError(LISTING_REVIEW_ERROR_CODES.REPLY_NOT_FOUND)
    }

    return ok(data as ListingReviewReply, LISTING_REVIEW_SUCCESS_MESSAGES.REPLY_UPDATED)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteListingReviewReply(
  replyId: string,
  accessContext?: ListingReviewAccessContext,
): Promise<ListingReviewServiceResponse<{ replyId: string }>> {
  try {
    const userId = await resolveUserId(accessContext?.userId)

    const { data, error } = await supabase
      .from('listing_review_replies')
      .delete()
      .eq('id', replyId)
      .eq('replier_id', userId)
      .select('id')
      .single()

    if (error) throw error
    if (!data) {
      throw new ListingReviewError(LISTING_REVIEW_ERROR_CODES.REPLY_NOT_FOUND)
    }

    return ok({ replyId: data.id }, LISTING_REVIEW_SUCCESS_MESSAGES.REPLY_DELETED)
  } catch (error) {
    return fail(error)
  }
}

// ============= HELPFULNESS / REPORTS =============

export async function voteListingReviewHelpfulness(
  input: ListingReviewHelpfulnessInput,
  accessContext?: ListingReviewAccessContext,
): Promise<ListingReviewServiceResponse<ListingReviewWithRelations>> {
  try {
    const parsed = parseListingReviewHelpfulness(input)
    const userId = await resolveUserId(accessContext?.userId)

    const { error: voteError } = await supabase.from('listing_review_helpfulness').upsert({
      review_id: parsed.review_id,
      user_id: userId,
      is_helpful: parsed.is_helpful,
      updated_at: new Date().toISOString(),
    })

    if (voteError) throw voteError

    const review = await fetchListingReviewById(parsed.review_id, { scope: 'public' })
    if (!review.success || !review.data) throw review.error

    return ok(review.data, LISTING_REVIEW_SUCCESS_MESSAGES.VOTE_RECORDED)
  } catch (error) {
    return fail(error)
  }
}

export async function removeListingReviewHelpfulnessVote(
  reviewId: string,
  accessContext?: ListingReviewAccessContext,
): Promise<ListingReviewServiceResponse<ListingReviewWithRelations>> {
  try {
    const userId = await resolveUserId(accessContext?.userId)

    const { error } = await supabase
      .from('listing_review_helpfulness')
      .delete()
      .eq('review_id', reviewId)
      .eq('user_id', userId)

    if (error) throw error

    const review = await fetchListingReviewById(reviewId, { scope: 'public' })
    if (!review.success || !review.data) throw review.error

    return ok(review.data, LISTING_REVIEW_SUCCESS_MESSAGES.VOTE_REMOVED)
  } catch (error) {
    return fail(error)
  }
}

export async function reportListingReview(
  input: ListingReviewReportInput,
  accessContext?: ListingReviewAccessContext,
): Promise<ListingReviewServiceResponse<{ reportId: string }>> {
  try {
    const parsed = parseListingReviewReport(input)
    const userId = await resolveUserId(accessContext?.userId)

    const { data, error } = await supabase
      .from('listing_review_reports')
      .insert({
        review_id: parsed.review_id,
        report_reason: parsed.report_reason,
        report_description: parsed.report_description,
        evidence_urls: parsed.evidence_urls,
        reporter_id: userId,
      })
      .select('id')
      .single()

    if (error) throw error

    return ok({ reportId: data.id }, LISTING_REVIEW_SUCCESS_MESSAGES.REPORTED)
  } catch (error) {
    return fail(error)
  }
}

// ============= ANALYTICS / VENDOR =============

export async function fetchListingReviewAnalytics(
  params: ListingReviewAnalyticsParams,
  accessContext?: ListingReviewAccessContext,
): Promise<ListingReviewServiceResponse<unknown>> {
  try {
    const parsed = parseListingReviewAnalyticsParams(params)

    if (parsed.shop_id) {
      await assertShopReviewAccess(parsed.shop_id, accessContext)
    }

    const { data, error } = await supabase.rpc('get_listing_review_analytics', {
      p_listing_ids: parsed.listing_ids ?? undefined,
      p_shop_id: parsed.shop_id ?? undefined,
      p_date_from: parsed.date_from ?? undefined,
      p_date_to: parsed.date_to ?? undefined,
      p_rating_filter: parsed.rating_filter ?? undefined,
      p_status_filter: parsed.status_filter ?? undefined,
      p_verified_only: parsed.verified_only ?? false,
      p_sentiment_filter: parsed.sentiment_filter ?? undefined,
      p_group_by: parsed.group_by ?? 'listing',
      p_include_trends: parsed.include_trends !== false,
    })

    if (error) throw error

    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function fetchVendorListingReviewDashboard(
  shopId: string,
  timeframe: { date_from?: string | null; date_to?: string | null } = {},
  accessContext?: ListingReviewAccessContext,
): Promise<ListingReviewServiceResponse<ListingReviewVendorDashboard>> {
  try {
    await assertShopReviewAccess(shopId, accessContext)

    const analyticsResult = await fetchListingReviewAnalytics(
      {
        shop_id: shopId,
        date_from: timeframe.date_from ?? null,
        date_to: timeframe.date_to ?? null,
        include_trends: true,
      },
      accessContext,
    )

    if (!analyticsResult.success) throw analyticsResult.error

    const listingIds = await fetchListingIdsForShop(shopId)

    const { count: pendingCount } = await supabase
      .from('listing_reviews')
      .select('id', { count: 'exact', head: true })
      .in('listing_id', listingIds.length ? listingIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('review_status', LISTING_REVIEW_STATUS.PENDING)

    const recentResult = await fetchListingReviews(
      {
        shop_id: shopId,
        limit: LISTING_REVIEW_VALIDATION.VENDOR_DASHBOARD_RECENT_LIMIT,
        sort_by: 'created_at',
        sort_order: 'desc',
        status: [...DEFAULT_VENDOR_REVIEW_STATUSES],
      },
      { scope: 'management', accessContext },
    )

    return ok({
      analytics: analyticsResult.data,
      pending_reviews_count: pendingCount ?? 0,
      recent_reviews: recentResult.data?.reviews ?? [],
      timeframe: {
        from: timeframe.date_from,
        to: timeframe.date_to,
      },
    })
  } catch (error) {
    return fail(error)
  }
}

// ============= ELIGIBILITY =============

export async function checkListingReviewEligibility(
  listingId: string,
  accessContext?: ListingReviewAccessContext,
): Promise<ListingReviewServiceResponse<ListingReviewEligibility>> {
  try {
    const userId = await resolveUserId(accessContext?.userId).catch(() => null)
    if (!userId) {
      return ok({
        canReview: false,
        reason: LISTING_REVIEW_ELIGIBILITY_REASONS.NOT_AUTHENTICATED,
      })
    }

    const { data: listing, error } = await supabase
      .from('listings')
      .select('id, is_active, listing_status, shop:shops(user_id)')
      .eq('id', listingId)
      .maybeSingle()

    if (error) throw error
    if (!listing) {
      return ok({ canReview: false, reason: LISTING_REVIEW_ELIGIBILITY_REASONS.LISTING_NOT_FOUND })
    }

    if (!listing.is_active || listing.listing_status !== 'active') {
      return ok({ canReview: false, reason: LISTING_REVIEW_ELIGIBILITY_REASONS.LISTING_INACTIVE })
    }

    const shop = Array.isArray(listing.shop) ? listing.shop[0] : listing.shop
    if (shop?.user_id === userId) {
      return ok({ canReview: false, reason: LISTING_REVIEW_ELIGIBILITY_REASONS.OWN_LISTING })
    }

    const { data: existingReview, error: reviewError } = await supabase
      .from('listing_reviews')
      .select('id')
      .eq('listing_id', listingId)
      .eq('reviewer_id', userId)
      .maybeSingle()

    if (reviewError && reviewError.code !== 'PGRST116') throw reviewError
    if (existingReview) {
      return ok({ canReview: false, reason: LISTING_REVIEW_ELIGIBILITY_REASONS.ALREADY_REVIEWED })
    }

    return ok({ canReview: true, reason: null })
  } catch (error) {
    return ok({
      canReview: false,
      reason: LISTING_REVIEW_ELIGIBILITY_REASONS.CHECK_FAILED,
    })
  }
}

export async function fetchUserListingReview(
  listingId: string,
  accessContext?: ListingReviewAccessContext,
): Promise<ListingReviewServiceResponse<ListingReviewWithRelations | null>> {
  try {
    const userId = await resolveUserId(accessContext?.userId)

    const { data, error } = await supabase
      .from('listing_reviews')
      .select(
        `
        *,
        listing:listings(id, title, listing_type),
        helpfulness_votes:listing_review_helpfulness(id, is_helpful)
      `,
      )
      .eq('listing_id', listingId)
      .eq('reviewer_id', userId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') throw error

    return ok((data as unknown as ListingReviewWithRelations | null) ?? null)
  } catch (error) {
    return fail(error)
  }
}
