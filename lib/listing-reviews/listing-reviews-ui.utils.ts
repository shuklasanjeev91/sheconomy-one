import {
  DEFAULT_VENDOR_REVIEW_STATUSES,
  LISTING_REVIEW_STATUS,
  LISTING_REVIEW_VALIDATION,
} from './listing-reviews.constants'
import { LISTING_REVIEW_UI_COPY } from './listing-reviews-ui.copy'
import type { ListingReviewWithRelations } from './listing-reviews.type'
import {
  calculateListingReviewStats,
  formatListingReviewStatus,
  parseListingReviewImages,
  sortListingReviews,
} from './listing-reviews.utils'

export type ListingReviewHubTab = 'overview' | 'all' | 'pending' | 'responses'

export type ListingReviewHubStats = {
  totalCount: number
  averageRating: number
  pendingCount: number
  needResponseCount: number
  verifiedCount: number
  withPhotosCount: number
  respondedCount: number
  thisWeekCount: number
  thisMonthCount: number
  responseRate: number
}

export type ListingReviewStatusBadge = {
  label: string
  tone: 'success' | 'warning' | 'muted' | 'danger'
}

export type ListingReviewHubTabDef = {
  id: ListingReviewHubTab
  label: string
  count?: number
  alert?: boolean
}

export const LISTING_REVIEW_CATEGORY_FIELDS = {
  QUALITY: 'quality_rating',
  VALUE: 'value_rating',
  SHIPPING: 'shipping_rating',
  SERVICE: 'service_rating',
} as const

export const LISTING_REVIEW_CATEGORY_LABELS = {
  [LISTING_REVIEW_CATEGORY_FIELDS.QUALITY]: 'Product Quality',
  [LISTING_REVIEW_CATEGORY_FIELDS.VALUE]: 'Value for Money',
  [LISTING_REVIEW_CATEGORY_FIELDS.SHIPPING]: 'Shipping Speed',
  [LISTING_REVIEW_CATEGORY_FIELDS.SERVICE]: 'Customer Service',
} as const

export function getListingReviewReviewerName(review: ListingReviewWithRelations): string {
  return (
    review.reviewer?.full_name ??
    review.reviewer?.username ??
    'Customer'
  )
}

export function getListingReviewProductTitle(review: ListingReviewWithRelations): string {
  return review.listing?.title?.trim() || 'Product listing'
}

export function listingReviewHasVendorReply(review: ListingReviewWithRelations): boolean {
  return Boolean(review.replies?.some((reply) => reply.is_vendor_reply))
}

export function listingReviewNeedsResponse(review: ListingReviewWithRelations): boolean {
  return (
    review.review_status === LISTING_REVIEW_STATUS.APPROVED &&
    !listingReviewHasVendorReply(review)
  )
}

export function canReplyToListingReview(
  review: ListingReviewWithRelations | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!review || !userId) return false
  const shopOwnerId = review.listing?.shop?.user_id
  return shopOwnerId === userId && listingReviewNeedsResponse(review)
}

export function computeListingReviewCategoryAverages(reviews: ListingReviewWithRelations[]) {
  const approved = reviews.filter((row) => row.review_status === LISTING_REVIEW_STATUS.APPROVED)

  const average = (field: keyof ListingReviewWithRelations) => {
    const values = approved
      .map((row) => row[field] as number | null | undefined)
      .filter((value): value is number => typeof value === 'number' && value >= 1 && value <= 5)
    if (!values.length) return 0
    const sum = values.reduce((total, value) => total + value, 0)
    return Math.round((sum / values.length) * 10) / 10
  }

  return {
    quality_rating: average('quality_rating'),
    value_rating: average('value_rating'),
    shipping_rating: average('shipping_rating'),
    service_rating: average('service_rating'),
  }
}

export function computeListingReviewHubStats(
  reviews: ListingReviewWithRelations[] | null | undefined,
): ListingReviewHubStats {
  const rows = reviews ?? []
  const stats = calculateListingReviewStats(rows)
  const approved = rows.filter((row) => row.review_status === LISTING_REVIEW_STATUS.APPROVED)
  const pendingCount = rows.filter((row) => row.review_status === LISTING_REVIEW_STATUS.PENDING).length
  const needResponseCount = rows.filter((row) => listingReviewNeedsResponse(row)).length
  const now = Date.now()
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const monthMs = 30 * 24 * 60 * 60 * 1000

  const thisWeekCount = rows.filter((row) => {
    const created = new Date(row.created_at).getTime()
    return Number.isFinite(created) && now - created <= weekMs
  }).length

  const thisMonthCount = rows.filter((row) => {
    const created = new Date(row.created_at).getTime()
    return Number.isFinite(created) && now - created <= monthMs
  }).length

  const respondedCount = approved.filter((row) => listingReviewHasVendorReply(row)).length
  const responseRate = approved.length > 0 ? Math.round((respondedCount / approved.length) * 100) : 0

  return {
    totalCount: rows.length,
    averageRating: stats.averageRating,
    pendingCount,
    needResponseCount,
    verifiedCount: approved.filter((row) => row.is_verified_purchase).length,
    withPhotosCount: approved.filter((row) => parseListingReviewImages(row.review_images).length > 0).length,
    respondedCount,
    thisWeekCount,
    thisMonthCount,
    responseRate,
  }
}

export function getListingReviewHubTabs(stats: ListingReviewHubStats): ListingReviewHubTabDef[] {
  return [
    { id: 'overview', label: LISTING_REVIEW_UI_COPY.tabOverview },
    { id: 'all', label: LISTING_REVIEW_UI_COPY.tabAllReviews, count: stats.totalCount },
    {
      id: 'pending',
      label: LISTING_REVIEW_UI_COPY.tabPending,
      count: stats.pendingCount,
      alert: stats.pendingCount > 0,
    },
    {
      id: 'responses',
      label: LISTING_REVIEW_UI_COPY.tabResponses,
      count: stats.needResponseCount,
      alert: stats.needResponseCount > 0,
    },
  ]
}

export function filterListingReviewsByQuery(
  reviews: ListingReviewWithRelations[],
  query: string,
): ListingReviewWithRelations[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return reviews

  return reviews.filter((review) => {
    const reviewer = getListingReviewReviewerName(review).toLowerCase()
    const product = getListingReviewProductTitle(review).toLowerCase()
    const haystack = `${review.title ?? ''} ${review.review_text ?? ''} ${reviewer} ${product}`.toLowerCase()
    return haystack.includes(needle)
  })
}

export function filterListingReviewsByTab(
  reviews: ListingReviewWithRelations[],
  tab: ListingReviewHubTab,
): ListingReviewWithRelations[] {
  switch (tab) {
    case 'pending':
      return reviews.filter((row) => row.review_status === LISTING_REVIEW_STATUS.PENDING)
    case 'responses':
      return reviews.filter((row) => listingReviewNeedsResponse(row))
    case 'all':
    case 'overview':
    default:
      return reviews
  }
}

export function filterListingReviewsForHub(
  reviews: ListingReviewWithRelations[],
  tab: ListingReviewHubTab,
  query: string,
): ListingReviewWithRelations[] {
  const byTab = filterListingReviewsByTab(reviews, tab === 'overview' ? 'all' : tab)
  const filtered = filterListingReviewsByQuery(byTab, query)
  return sortListingReviews(filtered)
}

export function listingReviewSearchResultsCount(resultCount: number, totalCount: number): string {
  if (resultCount === totalCount) {
    return `${resultCount} ${resultCount === 1 ? 'review' : 'reviews'}`
  }
  return `${resultCount} of ${totalCount} reviews`
}

export function getListingReviewStatusBadge(review: ListingReviewWithRelations): ListingReviewStatusBadge {
  const { label, value } = formatListingReviewStatus(review.review_status)

  switch (value) {
    case LISTING_REVIEW_STATUS.APPROVED:
      return { label, tone: 'success' }
    case LISTING_REVIEW_STATUS.PENDING:
      return { label, tone: 'warning' }
    case LISTING_REVIEW_STATUS.REJECTED:
    case LISTING_REVIEW_STATUS.FLAGGED:
    case LISTING_REVIEW_STATUS.SPAM:
      return { label, tone: 'danger' }
    default:
      return { label, tone: 'muted' }
  }
}

export function buildListingReviewExportRows(reviews: ListingReviewWithRelations[]) {
  return reviews.map((review) => ({
    id: review.id,
    listing_id: review.listing_id,
    product: getListingReviewProductTitle(review),
    status: review.review_status,
    rating: review.rating,
    title: review.title ?? '',
    review_text: review.review_text ?? '',
    reviewer: getListingReviewReviewerName(review),
    verified: review.is_verified_purchase ? 'yes' : 'no',
    helpful_count: review.helpful_count ?? 0,
    has_vendor_reply: listingReviewHasVendorReply(review) ? 'yes' : 'no',
    created_at: review.created_at,
  }))
}

export function getListingReviewImprovementCategories(reviews: ListingReviewWithRelations[]) {
  const categories = computeListingReviewCategoryAverages(reviews)
  return Object.entries(categories)
    .filter(([, value]) => value > 0 && value < 4)
    .map(([key, value]) => ({
      key,
      label: LISTING_REVIEW_CATEGORY_LABELS[key as keyof typeof LISTING_REVIEW_CATEGORY_LABELS] ?? key,
      rating: value,
    }))
    .sort((left, right) => left.rating - right.rating)
}

export function formatListingReviewReplyCounter(length: number): string {
  return `${length}/${LISTING_REVIEW_VALIDATION.REPLY_TEXT.MAX_LENGTH}`
}

export function getDefaultVendorListingReviewStatuses() {
  return [...DEFAULT_VENDOR_REVIEW_STATUSES]
}
