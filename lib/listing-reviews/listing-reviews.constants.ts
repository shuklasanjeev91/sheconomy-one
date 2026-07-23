/**
 * Listing review constants — defaults, limits, labels, and success messages.
 */

export const LISTING_REVIEW_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FLAGGED: 'flagged',
  HIDDEN: 'hidden',
  SPAM: 'spam',
} as const

export const LISTING_REVIEW_STATUS_VALUES = [
  LISTING_REVIEW_STATUS.PENDING,
  LISTING_REVIEW_STATUS.APPROVED,
  LISTING_REVIEW_STATUS.REJECTED,
  LISTING_REVIEW_STATUS.FLAGGED,
  LISTING_REVIEW_STATUS.HIDDEN,
  LISTING_REVIEW_STATUS.SPAM,
] as const

export const LISTING_REVIEW_TYPE = {
  LISTING: 'listing',
  VARIATION: 'variation',
  SERVICE: 'service',
} as const

export const LISTING_REVIEW_TYPE_VALUES = [
  LISTING_REVIEW_TYPE.LISTING,
  LISTING_REVIEW_TYPE.VARIATION,
  LISTING_REVIEW_TYPE.SERVICE,
] as const

export const LISTING_REVIEW_SENTIMENT = {
  VERY_POSITIVE: 'very_positive',
  POSITIVE: 'positive',
  NEUTRAL: 'neutral',
  NEGATIVE: 'negative',
  VERY_NEGATIVE: 'very_negative',
} as const

export const LISTING_REVIEW_SENTIMENT_VALUES = [
  LISTING_REVIEW_SENTIMENT.VERY_POSITIVE,
  LISTING_REVIEW_SENTIMENT.POSITIVE,
  LISTING_REVIEW_SENTIMENT.NEUTRAL,
  LISTING_REVIEW_SENTIMENT.NEGATIVE,
  LISTING_REVIEW_SENTIMENT.VERY_NEGATIVE,
] as const

export const LISTING_REVIEW_REPORT_REASON = {
  SPAM: 'spam',
  FAKE_REVIEW: 'fake_review',
  INAPPROPRIATE_LANGUAGE: 'inappropriate_language',
  PERSONAL_ATTACK: 'personal_attack',
  OFF_TOPIC: 'off_topic',
  COPYRIGHT_VIOLATION: 'copyright_violation',
  HARASSMENT: 'harassment',
  MISLEADING: 'misleading',
  OTHER: 'other',
} as const

export const LISTING_REVIEW_REPORT_REASON_VALUES = [
  LISTING_REVIEW_REPORT_REASON.SPAM,
  LISTING_REVIEW_REPORT_REASON.FAKE_REVIEW,
  LISTING_REVIEW_REPORT_REASON.INAPPROPRIATE_LANGUAGE,
  LISTING_REVIEW_REPORT_REASON.PERSONAL_ATTACK,
  LISTING_REVIEW_REPORT_REASON.OFF_TOPIC,
  LISTING_REVIEW_REPORT_REASON.COPYRIGHT_VIOLATION,
  LISTING_REVIEW_REPORT_REASON.HARASSMENT,
  LISTING_REVIEW_REPORT_REASON.MISLEADING,
  LISTING_REVIEW_REPORT_REASON.OTHER,
] as const

export const LISTING_REVIEW_SORT_BY = {
  CREATED_AT: 'created_at',
  RATING: 'rating',
  HELPFULNESS: 'helpfulness',
  REPLIES: 'replies',
} as const

export const LISTING_REVIEW_SORT_BY_VALUES = [
  LISTING_REVIEW_SORT_BY.CREATED_AT,
  LISTING_REVIEW_SORT_BY.RATING,
  LISTING_REVIEW_SORT_BY.HELPFULNESS,
  LISTING_REVIEW_SORT_BY.REPLIES,
] as const

export const LISTING_REVIEW_SORT_ORDER = {
  ASC: 'asc',
  DESC: 'desc',
} as const

export const LISTING_REVIEW_SORT_ORDER_VALUES = [
  LISTING_REVIEW_SORT_ORDER.ASC,
  LISTING_REVIEW_SORT_ORDER.DESC,
] as const

export const LISTING_REVIEW_ANALYTICS_GROUP_BY = {
  LISTING: 'listing',
  SHOP: 'shop',
  DATE: 'date',
  RATING: 'rating',
} as const

export const LISTING_REVIEW_ANALYTICS_GROUP_BY_VALUES = [
  LISTING_REVIEW_ANALYTICS_GROUP_BY.LISTING,
  LISTING_REVIEW_ANALYTICS_GROUP_BY.SHOP,
  LISTING_REVIEW_ANALYTICS_GROUP_BY.DATE,
  LISTING_REVIEW_ANALYTICS_GROUP_BY.RATING,
] as const

export const LISTING_REVIEW_VALIDATION = {
  RATING: { MIN: 1, MAX: 5 },
  TITLE: { MIN_LENGTH: 3, MAX_LENGTH: 200 },
  REVIEW_TEXT: { MIN_LENGTH: 10, MAX_LENGTH: 2000 },
  REPLY_TEXT: { MIN_LENGTH: 5, MAX_LENGTH: 1000 },
  REPORT_DESCRIPTION: { MIN_LENGTH: 10, MAX_LENGTH: 500 },
  MODERATION_REASON: { MAX_LENGTH: 500 },
  SEARCH_TERM: { MAX_LENGTH: 100 },
  MAX_IMAGES: 5,
  MAX_VIDEOS: 2,
  MAX_EVIDENCE_URLS: 5,
  MAX_LISTING_IDS: 100,
  MAX_BATCH_REVIEW_IDS: 50,
  FILTER_LIMIT: { MIN: 1, MAX: 100, DEFAULT: 20 },
  FILTER_OFFSET: { MIN: 0, DEFAULT: 0 },
  /** Skip refetch when reviews were loaded within this window (ms). */
  CACHE_TTL_MS: 5 * 60 * 1000,
  VENDOR_DASHBOARD_RECENT_LIMIT: 5,
} as const

export const DEFAULT_LISTING_REVIEW_FILTERS = {
  listing_ids: null as string[] | null,
  shop_id: null as string | null,
  rating: null as number[] | null,
  status: null as (typeof LISTING_REVIEW_STATUS_VALUES)[number][] | null,
  verified_only: false,
  sentiment: null as (typeof LISTING_REVIEW_SENTIMENT_VALUES)[number][] | null,
  date_from: null as string | null,
  date_to: null as string | null,
  search_term: '',
  has_images: false,
  has_replies: false,
  min_helpfulness: null as number | null,
  sort_by: LISTING_REVIEW_SORT_BY.CREATED_AT,
  sort_order: LISTING_REVIEW_SORT_ORDER.DESC,
  limit: LISTING_REVIEW_VALIDATION.FILTER_LIMIT.DEFAULT,
  offset: LISTING_REVIEW_VALIDATION.FILTER_OFFSET.DEFAULT,
} as const

export const DEFAULT_VENDOR_REVIEW_STATUSES = [
  LISTING_REVIEW_STATUS.PENDING,
  LISTING_REVIEW_STATUS.APPROVED,
  LISTING_REVIEW_STATUS.REJECTED,
  LISTING_REVIEW_STATUS.FLAGGED,
] as const

export const LISTING_REVIEW_DISPLAY = {
  RATING_LABELS: {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent',
  },
  STATUS_LABELS: {
    [LISTING_REVIEW_STATUS.PENDING]: 'Pending Review',
    [LISTING_REVIEW_STATUS.APPROVED]: 'Approved',
    [LISTING_REVIEW_STATUS.REJECTED]: 'Rejected',
    [LISTING_REVIEW_STATUS.FLAGGED]: 'Flagged',
    [LISTING_REVIEW_STATUS.HIDDEN]: 'Hidden',
    [LISTING_REVIEW_STATUS.SPAM]: 'Spam',
  },
  SENTIMENT_LABELS: {
    [LISTING_REVIEW_SENTIMENT.VERY_POSITIVE]: 'Very Positive',
    [LISTING_REVIEW_SENTIMENT.POSITIVE]: 'Positive',
    [LISTING_REVIEW_SENTIMENT.NEUTRAL]: 'Neutral',
    [LISTING_REVIEW_SENTIMENT.NEGATIVE]: 'Negative',
    [LISTING_REVIEW_SENTIMENT.VERY_NEGATIVE]: 'Very Negative',
  },
  UNRATED: 'Unrated',
  JUST_NOW: 'Just now',
  YESTERDAY: 'Yesterday',
} as const

export const LISTING_REVIEW_SUCCESS_MESSAGES = {
  CREATED: 'Review submitted successfully.',
  UPDATED: 'Review updated successfully.',
  DELETED: 'Review deleted successfully.',
  REPLY_CREATED: 'Reply posted successfully.',
  REPLY_UPDATED: 'Reply updated successfully.',
  REPLY_DELETED: 'Reply deleted successfully.',
  VOTE_RECORDED: 'Thanks for your feedback.',
  VOTE_REMOVED: 'Vote removed.',
  REPORTED: 'Review reported. Our team will review it shortly.',
  MODERATED: 'Reviews updated successfully.',
} as const

export const LISTING_REVIEW_ELIGIBILITY_REASONS = {
  NOT_AUTHENTICATED: 'Please sign in to leave a review.',
  LISTING_NOT_FOUND: 'This listing was not found.',
  LISTING_INACTIVE: 'Reviews are only available for active listings.',
  OWN_LISTING: 'You cannot review your own listing.',
  ALREADY_REVIEWED: 'You have already reviewed this listing.',
  CHECK_FAILED: 'We could not verify review eligibility. Please try again.',
} as const
