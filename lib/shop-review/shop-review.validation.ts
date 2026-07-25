import { z } from 'zod'

import {
  DEFAULT_SHOP_REVIEW_FILTERS,
  DEFAULT_SHOP_REVIEW_PAGINATION,
  SHOP_REVIEW_BULK_ACTION_VALUES,
  SHOP_REVIEW_REPORT_REASON_VALUES,
  SHOP_REVIEW_SORT_BY_VALUES,
  SHOP_REVIEW_SORT_ORDER_VALUES,
  SHOP_REVIEW_STATUS_VALUES,
  SHOP_REVIEW_VALIDATION,
} from '~/lib/shop-review/shop-review.constants'
import type {
  ShopReviewBulkModerationInput,
  ShopReviewCreateInput,
  ShopReviewFilterInput,
  ShopReviewHelpfulnessInput,
  ShopReviewModerationInput,
  ShopReviewQueryInput,
  ShopReviewReportInput,
  ShopReviewResponseCreateInput,
  ShopReviewStatsQueryInput,
  ShopReviewUpdateInput,
  ShopReviewValidationResult,
} from '~/lib/shop-review/shop-review.type'

export const shopReviewStatusSchema = z.enum(SHOP_REVIEW_STATUS_VALUES)
export const shopReviewReportReasonSchema = z.enum(SHOP_REVIEW_REPORT_REASON_VALUES)
export const shopReviewSortBySchema = z.enum(SHOP_REVIEW_SORT_BY_VALUES)
export const shopReviewSortOrderSchema = z.enum(SHOP_REVIEW_SORT_ORDER_VALUES)
export const shopReviewBulkActionSchema = z.enum(SHOP_REVIEW_BULK_ACTION_VALUES)

export const shopReviewRatingSchema = z.coerce
  .number()
  .int('Rating must be a whole number.')
  .min(SHOP_REVIEW_VALIDATION.RATING.MIN, 'Rating must be at least 1.')
  .max(SHOP_REVIEW_VALIDATION.RATING.MAX, 'Rating cannot exceed 5.')

export const shopReviewOptionalRatingSchema = shopReviewRatingSchema.nullable().optional()

export const shopReviewTitleSchema = z
  .string()
  .trim()
  .min(SHOP_REVIEW_VALIDATION.TITLE.MIN_LENGTH, `Title must be at least ${SHOP_REVIEW_VALIDATION.TITLE.MIN_LENGTH} characters.`)
  .max(SHOP_REVIEW_VALIDATION.TITLE.MAX_LENGTH, `Title cannot exceed ${SHOP_REVIEW_VALIDATION.TITLE.MAX_LENGTH} characters.`)
  .nullable()
  .optional()

export const shopReviewTextSchema = z
  .string()
  .trim()
  .min(SHOP_REVIEW_VALIDATION.REVIEW_TEXT.MIN_LENGTH, `Review must be at least ${SHOP_REVIEW_VALIDATION.REVIEW_TEXT.MIN_LENGTH} characters.`)
  .max(SHOP_REVIEW_VALIDATION.REVIEW_TEXT.MAX_LENGTH, `Review cannot exceed ${SHOP_REVIEW_VALIDATION.REVIEW_TEXT.MAX_LENGTH} characters.`)
  .nullable()
  .optional()

export const shopReviewResponseTextSchema = z
  .string()
  .trim()
  .min(SHOP_REVIEW_VALIDATION.RESPONSE_TEXT.MIN_LENGTH, `Response must be at least ${SHOP_REVIEW_VALIDATION.RESPONSE_TEXT.MIN_LENGTH} characters.`)
  .max(SHOP_REVIEW_VALIDATION.RESPONSE_TEXT.MAX_LENGTH, `Response cannot exceed ${SHOP_REVIEW_VALIDATION.RESPONSE_TEXT.MAX_LENGTH} characters.`)

export const shopReviewImageSchema = z.object({
  url: z.string().url('Invalid image URL.'),
  alt: z.string().max(200).nullable().optional(),
  caption: z.string().max(200).nullable().optional(),
})

export const shopReviewCreateSchema = z.object({
  shop_id: z.string().uuid('A valid shop is required.'),
  rating: shopReviewRatingSchema,
  title: shopReviewTitleSchema,
  review_text: shopReviewTextSchema,
  product_quality_rating: shopReviewOptionalRatingSchema,
  customer_service_rating: shopReviewOptionalRatingSchema,
  shipping_speed_rating: shopReviewOptionalRatingSchema,
  value_for_money_rating: shopReviewOptionalRatingSchema,
  is_verified_purchase: z.boolean().default(false),
  order_id: z.string().uuid('Invalid order.').nullable().optional(),
  review_images: z
    .array(shopReviewImageSchema)
    .max(SHOP_REVIEW_VALIDATION.MAX_IMAGES, `Maximum ${SHOP_REVIEW_VALIDATION.MAX_IMAGES} images allowed.`)
    .default([]),
  review_metadata: z.record(z.string(), z.unknown()).default({}),
})

export const shopReviewUpdateBaseSchema = z.object({
  rating: shopReviewRatingSchema.optional(),
  title: shopReviewTitleSchema,
  review_text: shopReviewTextSchema,
  product_quality_rating: shopReviewOptionalRatingSchema,
  customer_service_rating: shopReviewOptionalRatingSchema,
  shipping_speed_rating: shopReviewOptionalRatingSchema,
  value_for_money_rating: shopReviewOptionalRatingSchema,
  review_images: z.array(shopReviewImageSchema).max(SHOP_REVIEW_VALIDATION.MAX_IMAGES).optional(),
  review_metadata: z.record(z.string(), z.unknown()).optional(),
})

export const shopReviewUpdateSchema = shopReviewUpdateBaseSchema.refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field is required to update a review.' },
)

export const shopReviewResponseCreateSchema = z.object({
  review_id: z.string().uuid('A valid review is required.'),
  response_text: shopReviewResponseTextSchema,
  is_public: z.boolean().default(true),
})

export const shopReviewReportSchema = z.object({
  review_id: z.string().uuid('A valid review is required.'),
  report_reason: shopReviewReportReasonSchema,
  report_description: z
    .string()
    .trim()
    .max(
      SHOP_REVIEW_VALIDATION.REPORT_DESCRIPTION.MAX_LENGTH,
      `Description cannot exceed ${SHOP_REVIEW_VALIDATION.REPORT_DESCRIPTION.MAX_LENGTH} characters.`,
    )
    .nullable()
    .optional()
    .transform((value) => value?.trim() || null),
})

export const shopReviewHelpfulnessSchema = z.object({
  review_id: z.string().uuid('A valid review is required.'),
  is_helpful: z.boolean(),
})

export const shopReviewFilterBaseSchema = z.object({
  status: shopReviewStatusSchema.nullable().optional(),
  min_rating: shopReviewRatingSchema.nullable().optional(),
  max_rating: shopReviewRatingSchema.nullable().optional(),
  verified_only: z.boolean().optional(),
  date_from: z.string().nullable().optional(),
  date_to: z.string().nullable().optional(),
  search_term: z
    .string()
    .max(SHOP_REVIEW_VALIDATION.SEARCH_TERM.MAX_LENGTH, 'Search term is too long.')
    .nullable()
    .optional()
    .transform((value) => value?.trim() || null),
  sort_by: shopReviewSortBySchema.default(DEFAULT_SHOP_REVIEW_FILTERS.sort_by),
  sort_order: shopReviewSortOrderSchema.default(DEFAULT_SHOP_REVIEW_FILTERS.sort_order),
  include_responses: z.boolean().default(true),
})

export const shopReviewFilterSchema = shopReviewFilterBaseSchema.superRefine((value, ctx) => {
  if (value.date_from && value.date_to && new Date(value.date_from) > new Date(value.date_to)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Start date must be before end date.',
      path: ['date_from'],
    })
  }
  if (value.min_rating != null && value.max_rating != null && value.min_rating > value.max_rating) {
    ctx.addIssue({
      code: 'custom',
      message: 'Minimum rating cannot exceed maximum rating.',
      path: ['min_rating'],
    })
  }
})

export const shopReviewPaginationSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(SHOP_REVIEW_VALIDATION.PAGE.MIN)
    .default(DEFAULT_SHOP_REVIEW_PAGINATION.page),
  limit: z.coerce
    .number()
    .int()
    .min(SHOP_REVIEW_VALIDATION.PAGINATION.MIN)
    .max(SHOP_REVIEW_VALIDATION.PAGINATION.MAX)
    .default(DEFAULT_SHOP_REVIEW_PAGINATION.limit),
})

export const shopReviewQuerySchema = shopReviewFilterBaseSchema
  .extend({
    shop_id: z.string().uuid('A valid shop is required.'),
    page: shopReviewPaginationSchema.shape.page,
    limit: shopReviewPaginationSchema.shape.limit,
  })
  .superRefine((value, ctx) => {
    if (value.date_from && value.date_to && new Date(value.date_from) > new Date(value.date_to)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Start date must be before end date.',
        path: ['date_from'],
      })
    }
  })

export const shopReviewModerationSchema = z.object({
  review_status: shopReviewStatusSchema,
  moderation_reason: z
    .string()
    .max(
      SHOP_REVIEW_VALIDATION.MODERATION_REASON.MAX_LENGTH,
      `Moderation reason must be ${SHOP_REVIEW_VALIDATION.MODERATION_REASON.MAX_LENGTH} characters or less.`,
    )
    .nullable()
    .optional()
    .transform((value) => value?.trim() || null),
})

export const shopReviewBulkModerationSchema = z.object({
  review_ids: z
    .array(z.string().uuid('Invalid review ID.'))
    .min(1, 'At least one review ID is required.')
    .max(
      SHOP_REVIEW_VALIDATION.MAX_BATCH_REVIEW_IDS,
      `Maximum ${SHOP_REVIEW_VALIDATION.MAX_BATCH_REVIEW_IDS} reviews per batch.`,
    ),
  action: shopReviewBulkActionSchema,
  reason: z
    .string()
    .max(SHOP_REVIEW_VALIDATION.MODERATION_REASON.MAX_LENGTH)
    .nullable()
    .optional()
    .transform((value) => value?.trim() || null),
})

export const shopReviewStatsQuerySchema = z.object({
  shop_id: z.string().uuid('A valid shop is required.'),
  date_from: z.string().nullable().optional(),
  date_to: z.string().nullable().optional(),
  include_category_ratings: z.boolean().default(true),
})

function zodErrorsToResult(error: z.ZodError): ShopReviewValidationResult {
  const errors: Record<string, string> = {}
  const fieldErrors: string[] = []

  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    if (!errors[key]) errors[key] = issue.message
    fieldErrors.push(issue.message)
  }

  return { isValid: false, errors, fieldErrors }
}

export function validateShopReviewCreate(input: ShopReviewCreateInput): ShopReviewValidationResult {
  const parsed = shopReviewCreateSchema.safeParse(input)
  if (parsed.success) return { isValid: true, errors: {}, fieldErrors: [] }
  return zodErrorsToResult(parsed.error)
}

export function validateShopReviewUpdate(input: ShopReviewUpdateInput): ShopReviewValidationResult {
  const parsed = shopReviewUpdateSchema.safeParse(input)
  if (parsed.success) return { isValid: true, errors: {}, fieldErrors: [] }
  return zodErrorsToResult(parsed.error)
}

export function validateShopReviewFilter(input: ShopReviewFilterInput): ShopReviewValidationResult {
  const parsed = shopReviewFilterSchema.safeParse(input)
  if (parsed.success) return { isValid: true, errors: {}, fieldErrors: [] }
  return zodErrorsToResult(parsed.error)
}

export function parseShopReviewCreate(input: ShopReviewCreateInput) {
  return shopReviewCreateSchema.parse(input)
}

export function parseShopReviewUpdate(input: ShopReviewUpdateInput) {
  return shopReviewUpdateSchema.parse(input)
}

export function parseShopReviewQuery(input: ShopReviewQueryInput) {
  return shopReviewQuerySchema.parse(input)
}

export function parseShopReviewResponseCreate(input: ShopReviewResponseCreateInput) {
  return shopReviewResponseCreateSchema.parse(input)
}

export function parseShopReviewReport(input: ShopReviewReportInput) {
  return shopReviewReportSchema.parse(input)
}

export function parseShopReviewHelpfulness(input: ShopReviewHelpfulnessInput) {
  return shopReviewHelpfulnessSchema.parse(input)
}

export function parseShopReviewModeration(input: ShopReviewModerationInput) {
  return shopReviewModerationSchema.parse(input)
}

export function parseShopReviewBulkModeration(input: ShopReviewBulkModerationInput) {
  return shopReviewBulkModerationSchema.parse(input)
}

export function parseShopReviewStatsQuery(input: ShopReviewStatsQueryInput) {
  return shopReviewStatsQuerySchema.parse(input)
}

export function buildDefaultShopReviewFilters(): ShopReviewFilterInput {
  return { ...DEFAULT_SHOP_REVIEW_FILTERS }
}

export function buildDefaultShopReviewPagination() {
  return { ...DEFAULT_SHOP_REVIEW_PAGINATION }
}
