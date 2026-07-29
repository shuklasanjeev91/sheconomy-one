import { z } from 'zod'

import {
  DEFAULT_LISTING_REVIEW_FILTERS,
  LISTING_REVIEW_ANALYTICS_GROUP_BY_VALUES,
  LISTING_REVIEW_REPORT_REASON_VALUES,
  LISTING_REVIEW_SENTIMENT_VALUES,
  LISTING_REVIEW_SORT_BY_VALUES,
  LISTING_REVIEW_SORT_ORDER_VALUES,
  LISTING_REVIEW_STATUS_VALUES,
  LISTING_REVIEW_TYPE_VALUES,
  LISTING_REVIEW_VALIDATION,
} from '~/lib/listing-reviews/listing-reviews.constants'
import type {
  ListingReviewAnalyticsParams,
  ListingReviewBatchModerationInput,
  ListingReviewCreateInput,
  ListingReviewFilterInput,
  ListingReviewHelpfulnessInput,
  ListingReviewModerationInput,
  ListingReviewReplyCreateInput,
  ListingReviewReplyUpdateInput,
  ListingReviewReportInput,
  ListingReviewUpdateInput,
  ListingReviewValidationResult,
} from '~/lib/listing-reviews/listing-reviews.type'

// ============= PRIMITIVE SCHEMAS =============

export const listingReviewStatusSchema = z.enum(LISTING_REVIEW_STATUS_VALUES)
export const listingReviewTypeSchema = z.enum(LISTING_REVIEW_TYPE_VALUES)
export const listingReviewSentimentSchema = z.enum(LISTING_REVIEW_SENTIMENT_VALUES)
export const listingReviewReportReasonSchema = z.enum(LISTING_REVIEW_REPORT_REASON_VALUES)
export const listingReviewSortBySchema = z.enum(LISTING_REVIEW_SORT_BY_VALUES)
export const listingReviewSortOrderSchema = z.enum(LISTING_REVIEW_SORT_ORDER_VALUES)
export const listingReviewAnalyticsGroupBySchema = z.enum(LISTING_REVIEW_ANALYTICS_GROUP_BY_VALUES)

export const listingReviewRatingSchema = z.coerce
  .number()
  .int('Rating must be a whole number.')
  .min(LISTING_REVIEW_VALIDATION.RATING.MIN, 'Rating must be at least 1.')
  .max(LISTING_REVIEW_VALIDATION.RATING.MAX, 'Rating cannot exceed 5.')

export const listingReviewTitleSchema = z
  .string()
  .trim()
  .min(LISTING_REVIEW_VALIDATION.TITLE.MIN_LENGTH, `Title must be at least ${LISTING_REVIEW_VALIDATION.TITLE.MIN_LENGTH} characters.`)
  .max(LISTING_REVIEW_VALIDATION.TITLE.MAX_LENGTH, `Title cannot exceed ${LISTING_REVIEW_VALIDATION.TITLE.MAX_LENGTH} characters.`)

export const listingReviewTextSchema = z
  .string()
  .trim()
  .min(LISTING_REVIEW_VALIDATION.REVIEW_TEXT.MIN_LENGTH, `Review text must be at least ${LISTING_REVIEW_VALIDATION.REVIEW_TEXT.MIN_LENGTH} characters.`)
  .max(LISTING_REVIEW_VALIDATION.REVIEW_TEXT.MAX_LENGTH, `Review text cannot exceed ${LISTING_REVIEW_VALIDATION.REVIEW_TEXT.MAX_LENGTH} characters.`)

export const listingReviewReplyTextSchema = z
  .string()
  .trim()
  .min(LISTING_REVIEW_VALIDATION.REPLY_TEXT.MIN_LENGTH, `Reply must be at least ${LISTING_REVIEW_VALIDATION.REPLY_TEXT.MIN_LENGTH} characters.`)
  .max(LISTING_REVIEW_VALIDATION.REPLY_TEXT.MAX_LENGTH, `Reply cannot exceed ${LISTING_REVIEW_VALIDATION.REPLY_TEXT.MAX_LENGTH} characters.`)

export const listingReviewImageSchema = z.object({
  url: z.string().url('Invalid image URL.'),
  alt_text: z.string().max(200, 'Alt text is too long.').nullable().optional(),
  width: z.number().positive('Width must be positive.').nullable().optional(),
  height: z.number().positive('Height must be positive.').nullable().optional(),
  file_size: z.number().positive('File size must be positive.').nullable().optional(),
})

export const listingReviewVideoSchema = z.object({
  url: z.string().url('Invalid video URL.'),
  thumbnail_url: z.string().url('Invalid thumbnail URL.').nullable().optional(),
  duration: z.number().positive('Duration must be positive.').nullable().optional(),
  file_size: z.number().positive('File size must be positive.').nullable().optional(),
})

// ============= MAIN SCHEMAS =============

export const listingReviewCreateSchema = z
  .object({
    listing_id: z.string().uuid('A valid listing is required.'),
    rating: listingReviewRatingSchema,
    title: listingReviewTitleSchema.nullable().optional(),
    review_text: listingReviewTextSchema,
    quality_rating: listingReviewRatingSchema.nullable().optional(),
    value_rating: listingReviewRatingSchema.nullable().optional(),
    shipping_rating: listingReviewRatingSchema.nullable().optional(),
    service_rating: listingReviewRatingSchema.nullable().optional(),
    variation_id: z.string().uuid('Invalid variation.').nullable().optional(),
    review_type: listingReviewTypeSchema.default('listing'),
    review_images: z
      .array(listingReviewImageSchema)
      .max(LISTING_REVIEW_VALIDATION.MAX_IMAGES, `Maximum ${LISTING_REVIEW_VALIDATION.MAX_IMAGES} images allowed.`)
      .default([]),
    review_videos: z
      .array(listingReviewVideoSchema)
      .max(LISTING_REVIEW_VALIDATION.MAX_VIDEOS, `Maximum ${LISTING_REVIEW_VALIDATION.MAX_VIDEOS} videos allowed.`)
      .default([]),
    order_id: z.string().uuid('Invalid order.').nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.review_type === 'variation' && !value.variation_id) {
      ctx.addIssue({
        code: 'custom',
        message: 'Variation ID is required for variation reviews.',
        path: ['variation_id'],
      })
    }
  })

export const listingReviewUpdateBaseSchema = z.object({
  rating: listingReviewRatingSchema.optional(),
  title: listingReviewTitleSchema.nullable().optional(),
  review_text: listingReviewTextSchema.optional(),
  quality_rating: listingReviewRatingSchema.nullable().optional(),
  value_rating: listingReviewRatingSchema.nullable().optional(),
  shipping_rating: listingReviewRatingSchema.nullable().optional(),
  service_rating: listingReviewRatingSchema.nullable().optional(),
  variation_id: z.string().uuid('Invalid variation.').nullable().optional(),
  review_images: z
    .array(listingReviewImageSchema)
    .max(LISTING_REVIEW_VALIDATION.MAX_IMAGES)
    .optional(),
  review_videos: z
    .array(listingReviewVideoSchema)
    .max(LISTING_REVIEW_VALIDATION.MAX_VIDEOS)
    .optional(),
  order_id: z.string().uuid('Invalid order.').nullable().optional(),
})

export const listingReviewUpdateSchema = listingReviewUpdateBaseSchema.refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field is required to update a review.' },
)

export const listingReviewModerationSchema = z
  .object({
    review_status: listingReviewStatusSchema.optional(),
    moderation_reason: z
      .string()
      .max(
        LISTING_REVIEW_VALIDATION.MODERATION_REASON.MAX_LENGTH,
        `Moderation reason must be ${LISTING_REVIEW_VALIDATION.MODERATION_REASON.MAX_LENGTH} characters or less.`,
      )
      .nullable()
      .optional()
      .transform((value) => value?.trim() || null),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one moderation field is required.',
  })

export const listingReviewFilterBaseSchema = z.object({
  listing_ids: z
    .array(z.string().uuid('Invalid listing ID.'))
    .max(LISTING_REVIEW_VALIDATION.MAX_LISTING_IDS, 'Too many listing IDs.')
    .nullable()
    .optional(),
  shop_id: z.string().uuid('Invalid shop ID.').nullable().optional(),
  rating: z.array(listingReviewRatingSchema).max(5, 'Invalid rating filter.').nullable().optional(),
  status: z.array(listingReviewStatusSchema).max(10, 'Invalid status filter.').nullable().optional(),
  verified_only: z.boolean().default(false),
  sentiment: z.array(listingReviewSentimentSchema).max(10, 'Invalid sentiment filter.').nullable().optional(),
  date_from: z.string().nullable().optional(),
  date_to: z.string().nullable().optional(),
  search_term: z
    .string()
    .max(LISTING_REVIEW_VALIDATION.SEARCH_TERM.MAX_LENGTH, 'Search term is too long.')
    .nullable()
    .optional()
    .transform((value) => value?.trim() || null),
  has_images: z.boolean().optional(),
  has_replies: z.boolean().optional(),
  min_helpfulness: z.number().min(0, 'Minimum helpfulness must be non-negative.').nullable().optional(),
  sort_by: listingReviewSortBySchema.default(DEFAULT_LISTING_REVIEW_FILTERS.sort_by),
  sort_order: listingReviewSortOrderSchema.default(DEFAULT_LISTING_REVIEW_FILTERS.sort_order),
  limit: z.coerce
    .number()
    .int()
    .min(LISTING_REVIEW_VALIDATION.FILTER_LIMIT.MIN)
    .max(LISTING_REVIEW_VALIDATION.FILTER_LIMIT.MAX)
    .default(LISTING_REVIEW_VALIDATION.FILTER_LIMIT.DEFAULT),
  offset: z.coerce
    .number()
    .int()
    .min(LISTING_REVIEW_VALIDATION.FILTER_OFFSET.MIN)
    .default(LISTING_REVIEW_VALIDATION.FILTER_OFFSET.DEFAULT),
})

export const listingReviewFilterSchema = listingReviewFilterBaseSchema.superRefine((value, ctx) => {
  if (value.date_from && value.date_to && new Date(value.date_from) > new Date(value.date_to)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Start date must be before end date.',
      path: ['date_from'],
    })
  }
})

export const listingReviewReplyCreateSchema = z.object({
  review_id: z.string().uuid('A valid review is required.'),
  reply_text: listingReviewReplyTextSchema,
  parent_reply_id: z.string().uuid('Invalid parent reply.').nullable().optional(),
  is_public: z.boolean().default(true),
  is_pinned: z.boolean().default(false),
})

export const listingReviewReplyUpdateSchema = z
  .object({
    reply_text: listingReviewReplyTextSchema.optional(),
    is_public: z.boolean().optional(),
    is_pinned: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required to update a reply.',
  })

export const listingReviewHelpfulnessSchema = z.object({
  review_id: z.string().uuid('A valid review is required.'),
  is_helpful: z.boolean(),
})

export const listingReviewReportSchema = z.object({
  review_id: z.string().uuid('A valid review is required.'),
  report_reason: listingReviewReportReasonSchema,
  report_description: z
    .string()
    .trim()
    .min(
      LISTING_REVIEW_VALIDATION.REPORT_DESCRIPTION.MIN_LENGTH,
      `Description must be at least ${LISTING_REVIEW_VALIDATION.REPORT_DESCRIPTION.MIN_LENGTH} characters.`,
    )
    .max(
      LISTING_REVIEW_VALIDATION.REPORT_DESCRIPTION.MAX_LENGTH,
      `Description cannot exceed ${LISTING_REVIEW_VALIDATION.REPORT_DESCRIPTION.MAX_LENGTH} characters.`,
    )
    .nullable()
    .optional()
    .transform((value) => value?.trim() || null),
  evidence_urls: z
    .array(z.string().url('Invalid evidence URL.'))
    .max(LISTING_REVIEW_VALIDATION.MAX_EVIDENCE_URLS, `Maximum ${LISTING_REVIEW_VALIDATION.MAX_EVIDENCE_URLS} evidence URLs allowed.`)
    .default([]),
})

export const listingReviewAnalyticsParamsSchema = listingReviewFilterBaseSchema
  .pick({
    date_from: true,
    date_to: true,
    verified_only: true,
  })
  .extend({
    listing_ids: z
      .array(z.string().uuid('Invalid listing ID.'))
      .max(LISTING_REVIEW_VALIDATION.MAX_LISTING_IDS)
      .nullable()
      .optional(),
    shop_id: z.string().uuid('Invalid shop ID.').nullable().optional(),
    rating_filter: z.array(listingReviewRatingSchema).max(5).nullable().optional(),
    status_filter: z.array(listingReviewStatusSchema).max(10).nullable().optional(),
    sentiment_filter: z.array(listingReviewSentimentSchema).max(10).nullable().optional(),
    group_by: listingReviewAnalyticsGroupBySchema.default('listing'),
    include_trends: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (!value.listing_ids?.length && !value.shop_id) {
      ctx.addIssue({
        code: 'custom',
        message: 'Either listing IDs or a shop ID is required.',
        path: ['listing_ids'],
      })
    }
    if (value.date_from && value.date_to && new Date(value.date_from) > new Date(value.date_to)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Start date must be before end date.',
        path: ['date_from'],
      })
    }
  })

export const listingReviewBatchModerationSchema = z.object({
  review_ids: z
    .array(z.string().uuid('Invalid review ID.'))
    .min(1, 'At least one review ID is required.')
    .max(
      LISTING_REVIEW_VALIDATION.MAX_BATCH_REVIEW_IDS,
      `Maximum ${LISTING_REVIEW_VALIDATION.MAX_BATCH_REVIEW_IDS} reviews per batch.`,
    ),
  updates: listingReviewModerationSchema,
})

// ============= VALIDATION HELPERS =============

function zodErrorsToResult(error: z.ZodError): ListingReviewValidationResult {
  const errors: Record<string, string> = {}
  const fieldErrors: string[] = []

  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    if (!errors[key]) errors[key] = issue.message
    fieldErrors.push(issue.message)
  }

  return { isValid: false, errors, fieldErrors }
}

export function validateListingReviewCreate(
  input: ListingReviewCreateInput,
): ListingReviewValidationResult {
  const parsed = listingReviewCreateSchema.safeParse(input)
  if (parsed.success) return { isValid: true, errors: {}, fieldErrors: [] }
  return zodErrorsToResult(parsed.error)
}

export function validateListingReviewUpdate(
  input: ListingReviewUpdateInput,
): ListingReviewValidationResult {
  const parsed = listingReviewUpdateSchema.safeParse(input)
  if (parsed.success) return { isValid: true, errors: {}, fieldErrors: [] }
  return zodErrorsToResult(parsed.error)
}

export function validateListingReviewFilter(
  input: ListingReviewFilterInput,
): ListingReviewValidationResult {
  const parsed = listingReviewFilterSchema.safeParse(input)
  if (parsed.success) return { isValid: true, errors: {}, fieldErrors: [] }
  return zodErrorsToResult(parsed.error)
}

export function parseListingReviewCreate(input: ListingReviewCreateInput) {
  return listingReviewCreateSchema.parse(input)
}

export function parseListingReviewUpdate(input: ListingReviewUpdateInput) {
  return listingReviewUpdateSchema.parse(input)
}

export function parseListingReviewFilter(input: ListingReviewFilterInput) {
  return listingReviewFilterSchema.parse(input)
}

export function parseListingReviewReplyCreate(input: ListingReviewReplyCreateInput) {
  return listingReviewReplyCreateSchema.parse(input)
}

export function parseListingReviewReplyUpdate(input: ListingReviewReplyUpdateInput) {
  return listingReviewReplyUpdateSchema.parse(input)
}

export function parseListingReviewHelpfulness(input: ListingReviewHelpfulnessInput) {
  return listingReviewHelpfulnessSchema.parse(input)
}

export function parseListingReviewReport(input: ListingReviewReportInput) {
  return listingReviewReportSchema.parse(input)
}

export function parseListingReviewAnalyticsParams(input: ListingReviewAnalyticsParams) {
  return listingReviewAnalyticsParamsSchema.parse(input)
}

export function parseListingReviewBatchModeration(input: ListingReviewBatchModerationInput) {
  return listingReviewBatchModerationSchema.parse(input)
}

export function buildDefaultListingReviewFilters(): ListingReviewFilterInput {
  return { ...DEFAULT_LISTING_REVIEW_FILTERS }
}
