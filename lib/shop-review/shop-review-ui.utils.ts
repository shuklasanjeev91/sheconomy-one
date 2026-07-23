import { SHOP_REVIEW_STATUS, SHOP_REVIEW_VALIDATION } from './shop-review.constants'
import { SHOP_REVIEW_UI_COPY } from './shop-review-ui.copy'
import type { ShopReviewStats, ShopReviewWithRelations } from './shop-review.type'
import {
  formatShopReviewStatus,
  generateShopReviewSummary,
  sortShopReviews,
} from './shop-review.utils'

export type ShopReviewHubTab = 'overview' | 'all' | 'pending' | 'responses'

export type ShopReviewHubStats = {
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

export type ShopReviewStatusBadge = {
  label: string
  tone: 'success' | 'warning' | 'muted' | 'danger'
}

export type ShopReviewHubTabDef = {
  id: ShopReviewHubTab
  label: string
  count?: number
  alert?: boolean
}

export function getShopReviewReviewerName(review: ShopReviewWithRelations): string {
  return (
    review.reviewer_name ??
    review.profiles?.full_name ??
    review.profiles?.username ??
    'Customer'
  )
}

export function reviewNeedsResponse(review: ShopReviewWithRelations): boolean {
  return (
    review.review_status === SHOP_REVIEW_STATUS.APPROVED &&
    !(review.shop_review_responses?.length ?? review.has_response)
  )
}

export function computeShopReviewHubStats(reviews: ShopReviewWithRelations[]): ShopReviewHubStats {
  const summary = generateShopReviewSummary(reviews)
  const pendingCount = reviews.filter((row) => row.review_status === SHOP_REVIEW_STATUS.PENDING).length
  const needResponseCount = reviews.filter((row) => reviewNeedsResponse(row)).length
  const now = Date.now()
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const monthMs = 30 * 24 * 60 * 60 * 1000

  const thisWeekCount = reviews.filter((row) => {
    const created = new Date(row.created_at).getTime()
    return Number.isFinite(created) && now - created <= weekMs
  }).length

  const thisMonthCount = reviews.filter((row) => {
    const created = new Date(row.created_at).getTime()
    return Number.isFinite(created) && now - created <= monthMs
  }).length

  const approvedCount = summary.total
  const respondedCount = summary.with_responses
  const responseRate =
    approvedCount > 0 ? Math.round((respondedCount / approvedCount) * 100) : 0

  return {
    totalCount: reviews.length,
    averageRating: summary.average_rating,
    pendingCount,
    needResponseCount,
    verifiedCount: summary.verified_purchases,
    withPhotosCount: summary.with_images,
    respondedCount,
    thisWeekCount,
    thisMonthCount,
    responseRate,
  }
}

export function getShopReviewHubTabs(stats: ShopReviewHubStats): ShopReviewHubTabDef[] {
  return [
    { id: 'overview', label: SHOP_REVIEW_UI_COPY.tabOverview },
    { id: 'all', label: SHOP_REVIEW_UI_COPY.tabAllReviews, count: stats.totalCount },
    { id: 'pending', label: SHOP_REVIEW_UI_COPY.tabPending, count: stats.pendingCount, alert: stats.pendingCount > 0 },
    {
      id: 'responses',
      label: SHOP_REVIEW_UI_COPY.tabResponses,
      count: stats.needResponseCount,
      alert: stats.needResponseCount > 0,
    },
  ]
}

export function filterShopReviewsByQuery(
  reviews: ShopReviewWithRelations[],
  query: string,
): ShopReviewWithRelations[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return reviews

  return reviews.filter((review) => {
    const reviewer = getShopReviewReviewerName(review).toLowerCase()
    const haystack = `${review.title ?? ''} ${review.review_text ?? ''} ${reviewer}`.toLowerCase()
    return haystack.includes(needle)
  })
}

export function filterShopReviewsByTab(
  reviews: ShopReviewWithRelations[],
  tab: ShopReviewHubTab,
): ShopReviewWithRelations[] {
  switch (tab) {
    case 'pending':
      return reviews.filter((row) => row.review_status === SHOP_REVIEW_STATUS.PENDING)
    case 'responses':
      return reviews.filter((row) => reviewNeedsResponse(row))
    case 'all':
    case 'overview':
    default:
      return reviews
  }
}

export function filterShopReviewsForHub(
  reviews: ShopReviewWithRelations[],
  tab: ShopReviewHubTab,
  query: string,
): ShopReviewWithRelations[] {
  const byTab = filterShopReviewsByTab(reviews, tab === 'overview' ? 'all' : tab)
  const filtered = filterShopReviewsByQuery(byTab, query)
  return sortShopReviews(filtered)
}

export function shopReviewSearchResultsCount(resultCount: number, totalCount: number): string {
  if (resultCount === totalCount) {
    return `${resultCount} ${resultCount === 1 ? 'review' : 'reviews'}`
  }
  return `${resultCount} of ${totalCount} reviews`
}

export function getShopReviewStatusBadge(review: ShopReviewWithRelations): ShopReviewStatusBadge {
  const { label, value } = formatShopReviewStatus(review.review_status)

  switch (value) {
    case SHOP_REVIEW_STATUS.APPROVED:
      return { label, tone: 'success' }
    case SHOP_REVIEW_STATUS.PENDING:
      return { label, tone: 'warning' }
    case SHOP_REVIEW_STATUS.REJECTED:
    case SHOP_REVIEW_STATUS.FLAGGED:
      return { label, tone: 'danger' }
    default:
      return { label, tone: 'muted' }
  }
}

export function buildShopReviewExportRows(reviews: ShopReviewWithRelations[]) {
  return reviews.map((review) => ({
    id: review.id,
    status: review.review_status,
    rating: review.rating,
    title: review.title ?? '',
    review_text: review.review_text ?? '',
    reviewer: getShopReviewReviewerName(review),
    verified: review.is_verified_purchase ? 'yes' : 'no',
    helpful_count: review.helpful_count ?? 0,
    has_response: review.shop_review_responses?.length ? 'yes' : 'no',
    created_at: review.created_at,
  }))
}

export function getImprovementCategories(stats: ShopReviewStats | null) {
  if (!stats?.categories) return []

  return Object.entries(stats.categories)
    .filter(([, value]) => value > 0 && value < 4)
    .map(([key, value]) => ({
      key,
      label: key
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
      rating: value,
    }))
    .sort((left, right) => left.rating - right.rating)
}

export function formatShopReviewResponseCounter(length: number): string {
  return `${length}/${SHOP_REVIEW_VALIDATION.RESPONSE_TEXT.MAX_LENGTH}`
}
