import {
  DEFAULT_SHOP_REVIEW_FILTERS,
  DEFAULT_SHOP_REVIEW_PAGINATION,
  SHOP_REVIEW_CATEGORY_FIELDS,
  SHOP_REVIEW_CATEGORY_LABELS,
  SHOP_REVIEW_DISPLAY,
  SHOP_REVIEW_SORT_BY,
  SHOP_REVIEW_STATUS,
  SHOP_REVIEW_VALIDATION,
} from './shop-review.constants'
import type {
  ShopReview,
  ShopReviewCreateInput,
  ShopReviewFilterInput,
  ShopReviewPagination,
  ShopReviewRatingDistribution,
  ShopReviewRatingDistributionDisplay,
  ShopReviewStats,
  ShopReviewSummary,
  ShopReviewWithRelations,
} from './shop-review.type'

// ============= DEFAULTS =============

export function buildDefaultShopReviewStats(): ShopReviewStats {
  return {
    total_reviews: 0,
    verified_reviews: 0,
    average_rating: 0,
    rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    rating_percentages: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    verification_rate: 0,
    categories: {
      product_quality: 0,
      customer_service: 0,
      shipping_speed: 0,
      value_for_money: 0,
    },
  }
}

export function buildDefaultShopReviewSummary(): ShopReviewSummary {
  return {
    total: 0,
    average_rating: 0,
    distribution: {},
    categories: {
      product_quality: 0,
      customer_service: 0,
      shipping_speed: 0,
      value_for_money: 0,
    },
    verified_purchases: 0,
    with_images: 0,
    with_responses: 0,
  }
}

export function buildDefaultShopReviewPagination(
  overrides: Partial<ShopReviewPagination> = {},
): ShopReviewPagination {
  return {
    ...DEFAULT_SHOP_REVIEW_PAGINATION,
    ...overrides,
  }
}

// ============= SORT / FILTER =============

export function resolveShopReviewSortColumn(sortBy: ShopReviewFilterInput['sort_by']): string {
  switch (sortBy) {
    case SHOP_REVIEW_SORT_BY.RATING:
      return 'rating'
    case SHOP_REVIEW_SORT_BY.HELPFULNESS:
      return 'helpful_count'
    case SHOP_REVIEW_SORT_BY.CREATED_AT:
    default:
      return 'created_at'
  }
}

export function sortShopReviews<T extends Pick<ShopReview, 'created_at' | 'rating' | 'helpful_count' | 'not_helpful_count'>>(
  reviews: T[],
  sortBy: ShopReviewFilterInput['sort_by'] = DEFAULT_SHOP_REVIEW_FILTERS.sort_by,
  sortOrder: ShopReviewFilterInput['sort_order'] = DEFAULT_SHOP_REVIEW_FILTERS.sort_order,
): T[] {
  const direction = sortOrder === 'asc' ? 1 : -1

  return [...reviews].sort((left, right) => {
    let leftValue: number | string | Date
    let rightValue: number | string | Date

    if (sortBy === SHOP_REVIEW_SORT_BY.HELPFULNESS) {
      leftValue = (left.helpful_count ?? 0) - (left.not_helpful_count ?? 0)
      rightValue = (right.helpful_count ?? 0) - (right.not_helpful_count ?? 0)
    } else if (sortBy === SHOP_REVIEW_SORT_BY.RATING) {
      leftValue = left.rating
      rightValue = right.rating
    } else {
      leftValue = new Date(left.created_at)
      rightValue = new Date(right.created_at)
    }

    if (leftValue > rightValue) return direction
    if (leftValue < rightValue) return -direction
    return 0
  })
}

export function filterShopReviews(
  reviews: ShopReviewWithRelations[],
  filters: ShopReviewFilterInput,
): ShopReviewWithRelations[] {
  return reviews.filter((review) => {
    if (filters.min_rating != null && review.rating < filters.min_rating) return false
    if (filters.max_rating != null && review.rating > filters.max_rating) return false
    if (filters.verified_only && !review.is_verified_purchase) return false

    if (filters.date_from && new Date(review.created_at) < new Date(filters.date_from)) return false
    if (filters.date_to && new Date(review.created_at) > new Date(filters.date_to)) return false

    if (filters.search_term) {
      const needle = filters.search_term.toLowerCase()
      const haystack = `${review.title ?? ''} ${review.review_text ?? ''}`.toLowerCase()
      if (!haystack.includes(needle)) return false
    }

    return true
  })
}

export function shouldUseShopReviewCache(
  lastFetch: number | null | undefined,
  forceRefresh?: boolean,
): boolean {
  if (forceRefresh) return false
  if (!lastFetch) return false
  return Date.now() - lastFetch < SHOP_REVIEW_VALIDATION.CACHE_TTL_MS
}

// ============= STATS =============

export function calculateAverageShopReviewRating(
  reviews: Pick<ShopReview, 'rating' | 'review_status'>[] | null | undefined,
  ratingField: keyof ShopReview = 'rating',
): number {
  if (!reviews?.length) return 0

  const valid = reviews.filter(
    (review) =>
      review.review_status === SHOP_REVIEW_STATUS.APPROVED &&
      typeof review[ratingField] === 'number' &&
      (review[ratingField] as number) >= 1 &&
      (review[ratingField] as number) <= 5,
  )

  if (!valid.length) return 0

  const sum = valid.reduce((total, review) => total + (review[ratingField] as number), 0)
  return Math.round((sum / valid.length) * 10) / 10
}

export function calculateShopReviewRatingDistribution(
  reviews: Pick<ShopReview, 'rating' | 'review_status'>[] | null | undefined,
): ShopReviewRatingDistribution {
  const distribution: ShopReviewRatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  if (!reviews?.length) return distribution

  for (const review of reviews) {
    if (review.review_status !== SHOP_REVIEW_STATUS.APPROVED) continue
    if (review.rating >= 1 && review.rating <= 5) {
      distribution[review.rating as 1 | 2 | 3 | 4 | 5] += 1
    }
  }

  return distribution
}

export function toRatingDistributionDisplay(
  distribution: ShopReviewRatingDistribution,
  total: number,
): ShopReviewRatingDistributionDisplay {
  const result: ShopReviewRatingDistributionDisplay = {}
  for (const [rating, count] of Object.entries(distribution)) {
    result[rating] = {
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }
  }
  return result
}

export function generateShopReviewSummary(
  reviews: ShopReviewWithRelations[] | null | undefined,
): ShopReviewSummary {
  if (!reviews?.length) return buildDefaultShopReviewSummary()

  const approved = reviews.filter((review) => review.review_status === SHOP_REVIEW_STATUS.APPROVED)
  const total = approved.length
  const distribution = calculateShopReviewRatingDistribution(approved)

  return {
    total,
    average_rating: calculateAverageShopReviewRating(approved),
    distribution: toRatingDistributionDisplay(distribution, total),
    categories: {
      product_quality: calculateAverageShopReviewRating(approved, 'product_quality_rating'),
      customer_service: calculateAverageShopReviewRating(approved, 'customer_service_rating'),
      shipping_speed: calculateAverageShopReviewRating(approved, 'shipping_speed_rating'),
      value_for_money: calculateAverageShopReviewRating(approved, 'value_for_money_rating'),
    },
    verified_purchases: approved.filter((review) => review.is_verified_purchase).length,
    with_images: approved.filter((review) => parseShopReviewImages(review.review_images).length > 0).length,
    with_responses: approved.filter((review) => Boolean(review.shop_review_responses?.length)).length,
  }
}

export function buildShopReviewStatsFromReviews(
  reviews: Pick<ShopReview, 'rating' | 'review_status' | 'is_verified_purchase' | 'product_quality_rating' | 'customer_service_rating' | 'shipping_speed_rating' | 'value_for_money_rating'>[],
  includeCategoryRatings = true,
): ShopReviewStats {
  const approved = reviews.filter((review) => review.review_status === SHOP_REVIEW_STATUS.APPROVED)
  const totalReviews = approved.length
  const verifiedReviews = approved.filter((review) => review.is_verified_purchase).length
  const distribution = calculateShopReviewRatingDistribution(approved)

  const ratingPercentages: Record<string, number> = {}
  for (const [rating, count] of Object.entries(distribution)) {
    ratingPercentages[rating] =
      totalReviews > 0 ? Math.round((count / totalReviews) * 1000) / 10 : 0
  }

  const stats: ShopReviewStats = {
    total_reviews: totalReviews,
    verified_reviews: verifiedReviews,
    average_rating: calculateAverageShopReviewRating(approved),
    rating_distribution: distribution,
    rating_percentages: ratingPercentages,
    verification_rate:
      totalReviews > 0 ? Math.round((verifiedReviews / totalReviews) * 1000) / 10 : 0,
  }

  if (includeCategoryRatings) {
    stats.categories = {
      product_quality: calculateAverageShopReviewRating(approved, 'product_quality_rating'),
      customer_service: calculateAverageShopReviewRating(approved, 'customer_service_rating'),
      shipping_speed: calculateAverageShopReviewRating(approved, 'shipping_speed_rating'),
      value_for_money: calculateAverageShopReviewRating(approved, 'value_for_money_rating'),
    }
  }

  return stats
}

// ============= MEDIA / FORMAT =============

export function parseShopReviewImages(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && 'url' in item && typeof item.url === 'string') {
        return item.url
      }
      return null
    })
    .filter((item): item is string => Boolean(item))
}

export function formatShopReviewRating(
  rating: number | null | undefined,
  showNumber = true,
): { stars: string; text: string; ariaLabel: string; value: number } {
  if (!rating || rating < 1 || rating > 5) {
    return {
      stars: '☆☆☆☆☆',
      text: showNumber ? SHOP_REVIEW_DISPLAY.UNRATED : '',
      ariaLabel: 'No rating',
      value: 0,
    }
  }

  const fullStars = '★'.repeat(Math.floor(rating))
  const halfStar = rating % 1 >= 0.5 ? '½' : ''
  const emptyStars = '☆'.repeat(5 - Math.ceil(rating))

  return {
    stars: fullStars + halfStar + emptyStars,
    text: showNumber ? `(${rating})` : '',
    ariaLabel: `${rating} out of 5 stars`,
    value: rating,
  }
}

export function formatShopReviewDate(date: string | Date | null | undefined): string {
  if (!date) return ''

  const reviewDate = new Date(date)
  const now = new Date()
  const diffSeconds = Math.floor(Math.abs(now.getTime() - reviewDate.getTime()) / 1000)

  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
  ]

  for (const interval of intervals) {
    const count = Math.floor(diffSeconds / interval.seconds)
    if (count >= 1) return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`
  }

  return SHOP_REVIEW_DISPLAY.JUST_NOW
}

export function formatShopReviewStatus(status: string | null | undefined): {
  value: string
  label: string
} {
  const value = status ?? SHOP_REVIEW_STATUS.PENDING
  return {
    value,
    label:
      SHOP_REVIEW_DISPLAY.STATUS_LABELS[value as keyof typeof SHOP_REVIEW_DISPLAY.STATUS_LABELS] ??
      value,
  }
}

export function truncateShopReviewText(text: string | null | undefined, maxLength = 150): string {
  if (!text || text.length <= maxLength) return text ?? ''
  return `${text.substring(0, maxLength).trim()}...`
}

export function extractShopReviewCategoryRatings(review: ShopReviewWithRelations) {
  return Object.values(SHOP_REVIEW_CATEGORY_FIELDS)
    .filter((field) => review[field as keyof ShopReviewWithRelations])
    .map((field) => ({
      key: field,
      label: SHOP_REVIEW_CATEGORY_LABELS[field as keyof typeof SHOP_REVIEW_CATEGORY_LABELS],
      rating: review[field as keyof ShopReviewWithRelations] as number,
      displayRating: formatShopReviewRating(review[field as keyof ShopReviewWithRelations] as number, false),
    }))
}

export function calculateShopReviewHelpfulness(review: Pick<ShopReview, 'helpful_count' | 'not_helpful_count'>) {
  const helpful = review.helpful_count ?? 0
  const notHelpful = review.not_helpful_count ?? 0
  const total = helpful + notHelpful

  return {
    score: helpful - notHelpful,
    total,
    percentage: total > 0 ? Math.round((helpful / total) * 100) : 0,
    helpful,
    notHelpful,
  }
}

// ============= PERMISSIONS =============

export function canEditShopReview(
  review: Pick<ShopReview, 'reviewer_id' | 'review_status'> | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!review || !userId) return false
  return review.reviewer_id === userId && review.review_status === SHOP_REVIEW_STATUS.PENDING
}

export function canRespondToShopReview(
  review: ShopReviewWithRelations | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!review || !userId) return false
  const shopOwnerId = review.shops?.user_id
  return (
    shopOwnerId === userId &&
    review.review_status === SHOP_REVIEW_STATUS.APPROVED &&
    !(review.shop_review_responses?.length ?? 0)
  )
}

export function canDeleteShopReview(
  review: ShopReviewWithRelations | null | undefined,
  userId: string | null | undefined,
  isAdmin = false,
): boolean {
  if (!review || !userId) return false
  if (isAdmin) return true
  return review.reviewer_id === userId || review.shops?.user_id === userId
}

// ============= STATE HELPERS =============

export function normalizeShopReviewRow(row: ShopReviewWithRelations): ShopReviewWithRelations {
  const profile = row.profiles ?? null
  const responses = row.shop_review_responses ?? []
  const response = responses[0] ?? null

  return {
    ...row,
    reviewer_name:
      row.reviewer_name ??
      profile?.full_name?.trim() ??
      profile?.username?.trim() ??
      SHOP_REVIEW_DISPLAY.ANONYMOUS_REVIEWER,
    reviewer_avatar: row.reviewer_avatar ?? profile?.avatar_url ?? null,
    has_response: responses.length > 0,
    response,
  }
}

export function normalizeShopReviewRows(rows: ShopReviewWithRelations[]): ShopReviewWithRelations[] {
  return rows.map(normalizeShopReviewRow)
}

export function upsertShopReview(
  reviews: ShopReviewWithRelations[],
  review: ShopReviewWithRelations,
): ShopReviewWithRelations[] {
  if (reviews.some((row) => row.id === review.id)) {
    return reviews.map((row) => (row.id === review.id ? { ...row, ...review } : row))
  }
  return [review, ...reviews]
}

export function removeShopReviewById(
  reviews: ShopReviewWithRelations[],
  reviewId: string,
): ShopReviewWithRelations[] {
  return reviews.filter((review) => review.id !== reviewId)
}

export function indexShopReviewsById(
  reviews: ShopReviewWithRelations[],
): Record<string, ShopReviewWithRelations> {
  return Object.fromEntries(reviews.map((review) => [review.id, review]))
}

export function mergeShopReviewsById(
  current: Record<string, ShopReviewWithRelations>,
  reviews: ShopReviewWithRelations[],
): Record<string, ShopReviewWithRelations> {
  const next = { ...current }
  for (const review of reviews) {
    next[review.id] = review
  }
  return next
}

export function buildOptimisticShopReview(
  requestId: string,
  reviewerId: string,
  input: ShopReviewCreateInput,
): ShopReviewWithRelations {
  const now = new Date().toISOString()
  return {
    id: `temp-${requestId}`,
    shop_id: input.shop_id,
    reviewer_id: reviewerId,
    rating: input.rating,
    title: input.title?.trim() || null,
    review_text: input.review_text?.trim() || null,
    product_quality_rating: input.product_quality_rating ?? null,
    customer_service_rating: input.customer_service_rating ?? null,
    shipping_speed_rating: input.shipping_speed_rating ?? null,
    value_for_money_rating: input.value_for_money_rating ?? null,
    is_verified_purchase: input.is_verified_purchase ?? false,
    order_id: input.order_id ?? null,
    review_images: input.review_images ?? [],
    review_metadata: input.review_metadata ?? {},
    review_status: SHOP_REVIEW_STATUS.PENDING,
    helpful_count: 0,
    not_helpful_count: 0,
    moderated_at: null,
    moderated_by: null,
    moderation_reason: null,
    created_at: now,
    updated_at: now,
    has_response: false,
    response: null,
  }
}

export function applyShopReviewUpdate(
  review: ShopReviewWithRelations,
  input: Partial<ShopReviewWithRelations>,
): ShopReviewWithRelations {
  return {
    ...review,
    ...input,
    title: input.title === undefined ? review.title : input.title?.trim() || null,
    review_text: input.review_text === undefined ? review.review_text : input.review_text?.trim() || null,
    updated_at: new Date().toISOString(),
  }
}

export function computeShopReviewPagination(
  page: number,
  limit: number,
  total: number,
): ShopReviewPagination {
  const totalPages = total > 0 ? Math.ceil(total / limit) : 0
  return {
    page,
    limit,
    total,
    has_more: page * limit < total,
    total_pages: totalPages,
  }
}

export function reviewMatchesShopReviewFilters(
  review: ShopReviewWithRelations,
  filters: ShopReviewFilterInput,
): boolean {
  if (filters.status && review.review_status !== filters.status) return false
  return filterShopReviews([review], filters).length > 0
}
