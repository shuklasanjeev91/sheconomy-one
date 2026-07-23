/**
 * Shop review constants — defaults, limits, labels, and success messages.
 */

export const SHOP_REVIEW_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FLAGGED: 'flagged',
  HIDDEN: 'hidden',
} as const

export const SHOP_REVIEW_STATUS_VALUES = [
  SHOP_REVIEW_STATUS.PENDING,
  SHOP_REVIEW_STATUS.APPROVED,
  SHOP_REVIEW_STATUS.REJECTED,
  SHOP_REVIEW_STATUS.FLAGGED,
  SHOP_REVIEW_STATUS.HIDDEN,
] as const

export const SHOP_REVIEW_REPORT_REASON = {
  SPAM: 'spam',
  INAPPROPRIATE_LANGUAGE: 'inappropriate_language',
  FAKE_REVIEW: 'fake_review',
  PERSONAL_ATTACK: 'personal_attack',
  OFF_TOPIC: 'off_topic',
  COPYRIGHT_VIOLATION: 'copyright_violation',
  OTHER: 'other',
} as const

export const SHOP_REVIEW_REPORT_REASON_VALUES = [
  SHOP_REVIEW_REPORT_REASON.SPAM,
  SHOP_REVIEW_REPORT_REASON.INAPPROPRIATE_LANGUAGE,
  SHOP_REVIEW_REPORT_REASON.FAKE_REVIEW,
  SHOP_REVIEW_REPORT_REASON.PERSONAL_ATTACK,
  SHOP_REVIEW_REPORT_REASON.OFF_TOPIC,
  SHOP_REVIEW_REPORT_REASON.COPYRIGHT_VIOLATION,
  SHOP_REVIEW_REPORT_REASON.OTHER,
] as const

export const SHOP_REVIEW_SORT_BY = {
  CREATED_AT: 'created_at',
  RATING: 'rating',
  HELPFULNESS: 'helpfulness',
} as const

export const SHOP_REVIEW_SORT_BY_VALUES = [
  SHOP_REVIEW_SORT_BY.CREATED_AT,
  SHOP_REVIEW_SORT_BY.RATING,
  SHOP_REVIEW_SORT_BY.HELPFULNESS,
] as const

export const SHOP_REVIEW_SORT_ORDER = {
  ASC: 'asc',
  DESC: 'desc',
} as const

export const SHOP_REVIEW_SORT_ORDER_VALUES = [
  SHOP_REVIEW_SORT_ORDER.ASC,
  SHOP_REVIEW_SORT_ORDER.DESC,
] as const

export const SHOP_REVIEW_BULK_ACTION = {
  APPROVE: 'approve',
  REJECT: 'reject',
  FLAG: 'flag',
  HIDE: 'hide',
} as const

export const SHOP_REVIEW_BULK_ACTION_VALUES = [
  SHOP_REVIEW_BULK_ACTION.APPROVE,
  SHOP_REVIEW_BULK_ACTION.REJECT,
  SHOP_REVIEW_BULK_ACTION.FLAG,
  SHOP_REVIEW_BULK_ACTION.HIDE,
] as const

export const SHOP_REVIEW_BULK_ACTION_TO_STATUS = {
  [SHOP_REVIEW_BULK_ACTION.APPROVE]: SHOP_REVIEW_STATUS.APPROVED,
  [SHOP_REVIEW_BULK_ACTION.REJECT]: SHOP_REVIEW_STATUS.REJECTED,
  [SHOP_REVIEW_BULK_ACTION.FLAG]: SHOP_REVIEW_STATUS.FLAGGED,
  [SHOP_REVIEW_BULK_ACTION.HIDE]: SHOP_REVIEW_STATUS.HIDDEN,
} as const

export const SHOP_REVIEW_VALIDATION = {
  RATING: { MIN: 1, MAX: 5 },
  TITLE: { MIN_LENGTH: 3, MAX_LENGTH: 200 },
  REVIEW_TEXT: { MIN_LENGTH: 10, MAX_LENGTH: 5000 },
  RESPONSE_TEXT: { MIN_LENGTH: 10, MAX_LENGTH: 2000 },
  REPORT_DESCRIPTION: { MAX_LENGTH: 1000 },
  MODERATION_REASON: { MAX_LENGTH: 500 },
  SEARCH_TERM: { MAX_LENGTH: 100 },
  MAX_IMAGES: 5,
  MAX_IMAGE_SIZE_MB: 10,
  IMAGE_ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
  PAGINATION: { MIN: 5, MAX: 50, DEFAULT: 10 },
  PAGE: { MIN: 1, DEFAULT: 1 },
  MAX_BATCH_REVIEW_IDS: 50,
  CACHE_TTL_MS: 5 * 60 * 1000,
} as const

export const DEFAULT_SHOP_REVIEW_FILTERS = {
  status: SHOP_REVIEW_STATUS.APPROVED,
  min_rating: null as number | null,
  max_rating: null as number | null,
  verified_only: false,
  date_from: null as string | null,
  date_to: null as string | null,
  search_term: '',
  sort_by: SHOP_REVIEW_SORT_BY.CREATED_AT,
  sort_order: SHOP_REVIEW_SORT_ORDER.DESC,
  include_responses: true,
} as const

export const DEFAULT_SHOP_REVIEW_PAGINATION = {
  page: SHOP_REVIEW_VALIDATION.PAGE.DEFAULT,
  limit: SHOP_REVIEW_VALIDATION.PAGINATION.DEFAULT,
  total: 0,
  has_more: false,
  total_pages: 0,
} as const

export const DEFAULT_VENDOR_SHOP_REVIEW_STATUSES = [
  SHOP_REVIEW_STATUS.PENDING,
  SHOP_REVIEW_STATUS.APPROVED,
  SHOP_REVIEW_STATUS.REJECTED,
  SHOP_REVIEW_STATUS.FLAGGED,
] as const

export const SHOP_REVIEW_CATEGORY_FIELDS = {
  PRODUCT_QUALITY: 'product_quality_rating',
  CUSTOMER_SERVICE: 'customer_service_rating',
  SHIPPING_SPEED: 'shipping_speed_rating',
  VALUE_FOR_MONEY: 'value_for_money_rating',
} as const

export const SHOP_REVIEW_CATEGORY_LABELS = {
  [SHOP_REVIEW_CATEGORY_FIELDS.PRODUCT_QUALITY]: 'Product Quality',
  [SHOP_REVIEW_CATEGORY_FIELDS.CUSTOMER_SERVICE]: 'Customer Service',
  [SHOP_REVIEW_CATEGORY_FIELDS.SHIPPING_SPEED]: 'Shipping Speed',
  [SHOP_REVIEW_CATEGORY_FIELDS.VALUE_FOR_MONEY]: 'Value for Money',
} as const

export const SHOP_REVIEW_DISPLAY = {
  RATING_LABELS: {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent',
  },
  STATUS_LABELS: {
    [SHOP_REVIEW_STATUS.PENDING]: 'Pending Review',
    [SHOP_REVIEW_STATUS.APPROVED]: 'Approved',
    [SHOP_REVIEW_STATUS.REJECTED]: 'Rejected',
    [SHOP_REVIEW_STATUS.FLAGGED]: 'Flagged',
    [SHOP_REVIEW_STATUS.HIDDEN]: 'Hidden',
  },
  ANONYMOUS_REVIEWER: 'Anonymous',
  UNRATED: 'Unrated',
  JUST_NOW: 'Just now',
} as const

export const SHOP_REVIEW_SUCCESS_MESSAGES = {
  CREATED: 'Review submitted successfully.',
  UPDATED: 'Review updated successfully.',
  DELETED: 'Review deleted successfully.',
  RESPONSE_CREATED: 'Response posted successfully.',
  VOTE_RECORDED: 'Thanks for your feedback.',
  VOTE_REMOVED: 'Vote removed.',
  REPORTED: 'Review reported. Our team will review it shortly.',
  MODERATED: 'Reviews updated successfully.',
  RATINGS_REFRESHED: 'Shop ratings refreshed successfully.',
} as const

export const SHOP_REVIEW_ELIGIBILITY_REASONS = {
  NOT_AUTHENTICATED: 'Please sign in to leave a review.',
  SHOP_NOT_FOUND: 'This shop was not found.',
  SHOP_INACTIVE: 'Reviews are only available for active shops.',
  OWN_SHOP: 'You cannot review your own shop.',
  ALREADY_REVIEWED: 'You have already reviewed this shop.',
  CHECK_FAILED: 'We could not verify review eligibility. Please try again.',
} as const
