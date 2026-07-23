/**
 * Discount Zod validation schemas and parse helpers.
 *
 * Ported from legacy `discounts-schema.js`.
 */

import { z } from 'zod'

import {
  ALLOWED_POSTER_DIMENSIONS,
  APPLIES_TO,
  BOGO_GET_DISCOUNT_TYPES,
  DEFAULT_BOGO_RULE_FORM,
  DEFAULT_DISCOUNT_FILTERS,
  DEFAULT_DISCOUNT_FORM,
  DEFAULT_DISCOUNT_PAGINATION,
  DISCOUNT_POSTER_CONFIG,
  DISCOUNT_TYPES,
  DISCOUNT_USER_TYPES,
  DISCOUNT_VALIDATION,
} from './discount.constants'
import type {
  BogoRuleInput,
  DiscountApplicationInput,
  DiscountCartItem,
  DiscountCreateInput,
  DiscountFilterInput,
  DiscountFormInput,
  DiscountUpdateInput,
  DiscountValidationContext,
  DiscountValidationResult,
} from './discount.type'

// ============= PRIMITIVE SCHEMAS =============

export const discountTypeSchema = z.enum([
  DISCOUNT_TYPES.PERCENTAGE,
  DISCOUNT_TYPES.FIXED,
  DISCOUNT_TYPES.BOGO,
  DISCOUNT_TYPES.FREE_SHIPPING,
])

export const appliesToSchema = z.enum([
  APPLIES_TO.ORDER,
  APPLIES_TO.ITEM,
  APPLIES_TO.SHIPPING,
  APPLIES_TO.CATEGORY,
])

export const discountUserTypeSchema = z.enum([
  DISCOUNT_USER_TYPES.ALL,
  DISCOUNT_USER_TYPES.NEW,
  DISCOUNT_USER_TYPES.RETURNING,
  DISCOUNT_USER_TYPES.VIP,
])

export const bogoGetDiscountTypeSchema = z.enum([
  BOGO_GET_DISCOUNT_TYPES.FREE,
  BOGO_GET_DISCOUNT_TYPES.PERCENTAGE,
])

const optionalNumberFromString = z.union([
  z.number(),
  z.string().transform((val) => (val === '' || val == null ? undefined : Number(val))),
])

const requiredNumberFromString = z.union([
  z.number(),
  z.string().transform((val) => (val === '' || val == null ? 0 : Number(val))),
])

// ============= BOGO =============

export const bogoRuleFormSchema = z
  .object({
    buy_listing_ids: z.array(z.string().uuid()).default([]),
    get_listing_ids: z.array(z.string().uuid()).default([]),
    buy_categories: z.array(z.string()).default([]),
    get_categories: z.array(z.string()).default([]),
    buy_quantity: z
      .union([
        z.number().int().positive('Buy quantity must be positive.'),
        z.string().transform((val) => (val ? parseInt(val, 10) : 1)),
      ])
      .default(1),
    get_quantity: z
      .union([
        z.number().int().positive('Get quantity must be positive.'),
        z.string().transform((val) => (val ? parseInt(val, 10) : 1)),
      ])
      .default(1),
    get_discount_type: bogoGetDiscountTypeSchema.default(BOGO_GET_DISCOUNT_TYPES.FREE),
    get_discount_value: z
      .union([
        z.number().min(1).max(DISCOUNT_VALIDATION.PERCENTAGE.MAX),
        z.string().transform((val) => (val ? parseFloat(val) : 100)),
      ])
      .default(100),
    template_id: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.get_discount_type === BOGO_GET_DISCOUNT_TYPES.FREE) {
        return data.get_discount_value === 100
      }
      return data.get_discount_value > 0 && data.get_discount_value <= DISCOUNT_VALIDATION.PERCENTAGE.MAX
    },
    {
      message:
        "For 'free' type, discount value must be 100. For percentage, must be 1–100.",
      path: ['get_discount_value'],
    },
  )
  .refine(
    (data) => {
      const hasBuyProducts = data.buy_listing_ids.length > 0
      const hasBuyCategories = data.buy_categories.length > 0
      return hasBuyProducts || hasBuyCategories
    },
    {
      message: "At least one 'Buy' product or category is required.",
      path: ['buy_listing_ids'],
    },
  )
  .refine(
    (data) => {
      const hasGetProducts = data.get_listing_ids.length > 0
      const hasGetCategories = data.get_categories.length > 0
      const hasBuyProducts = data.buy_listing_ids.length > 0
      const hasBuyCategories = data.buy_categories.length > 0
      return hasGetProducts || hasGetCategories || hasBuyProducts || hasBuyCategories
    },
    {
      message: "At least one 'Get' product or category is required.",
      path: ['get_listing_ids'],
    },
  )

// ============= FORM / CRUD =============

export const discountFormSchema = z
  .object({
    discount_name: z
      .string()
      .trim()
      .min(DISCOUNT_VALIDATION.NAME.MIN_LENGTH, 'Discount name is required.')
      .max(DISCOUNT_VALIDATION.NAME.MAX_LENGTH, 'Name is too long.'),
    discount_code: z
      .string()
      .trim()
      .min(DISCOUNT_VALIDATION.CODE.MIN_LENGTH, 'Code must be at least 3 characters.')
      .max(DISCOUNT_VALIDATION.CODE.MAX_LENGTH, 'Code is too long.')
      .regex(/^[A-Z0-9_-]+$/, 'Only uppercase letters, numbers, hyphens and underscores allowed.')
      .optional()
      .or(z.literal('')),
    description: z
      .string()
      .max(DISCOUNT_VALIDATION.DESCRIPTION.MAX_LENGTH, 'Description is too long.')
      .optional(),
    discount_type: discountTypeSchema,
    discount_value: requiredNumberFromString,
    max_discount_amount: optionalNumberFromString.optional(),
    applies_to: appliesToSchema,
    min_order_amount: optionalNumberFromString.optional(),
    max_uses_total: optionalNumberFromString.optional(),
    max_uses_per_customer: z
      .union([
        z.number().int().positive().default(1),
        z.string().transform((val) => (val ? parseInt(val, 10) : 1)),
      ])
      .default(1),
    eligible_user_types: z.array(discountUserTypeSchema).default([DISCOUNT_USER_TYPES.ALL]),
    is_active: z.boolean().default(true),
    valid_from: z.string().optional(),
    valid_until: z.string().optional(),
    bogo_rule: bogoRuleFormSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.discount_type === DISCOUNT_TYPES.BOGO) return true
      if (data.discount_type === DISCOUNT_TYPES.PERCENTAGE) {
        return data.discount_value > 0 && data.discount_value <= DISCOUNT_VALIDATION.PERCENTAGE.MAX
      }
      return true
    },
    {
      message: 'Percentage must be between 0 and 100.',
      path: ['discount_value'],
    },
  )
  .refine(
    (data) => {
      if (data.discount_type === DISCOUNT_TYPES.BOGO) return data.bogo_rule != null
      return true
    },
    {
      message: 'BOGO configuration is required.',
      path: ['bogo_rule'],
    },
  )

export const discountProfileSchema = z
  .object({
    shop_id: z.string().uuid().nullable().optional(),
    discount_name: z
      .string()
      .trim()
      .min(DISCOUNT_VALIDATION.NAME.MIN_LENGTH, 'Discount name is required.')
      .max(DISCOUNT_VALIDATION.NAME.MAX_LENGTH),
    discount_code: z.string().min(DISCOUNT_VALIDATION.CODE.MIN_LENGTH).max(DISCOUNT_VALIDATION.CODE.MAX_LENGTH).optional().nullable(),
    description: z.string().max(DISCOUNT_VALIDATION.DESCRIPTION.MAX_LENGTH).optional().nullable(),
    discount_type: discountTypeSchema,
    discount_value: z.number().positive('Discount value must be positive.'),
    max_discount_amount: z.number().positive().optional().nullable(),
    applies_to: appliesToSchema,
    min_order_amount: z.number().nonnegative().optional().nullable(),
    max_uses_total: z.number().int().positive().optional().nullable(),
    max_uses_per_customer: z.number().int().positive().default(1),
    eligible_user_types: z.array(discountUserTypeSchema).default([DISCOUNT_USER_TYPES.ALL]),
    eligible_categories: z.array(z.string()).optional().nullable(),
    eligible_listings: z.array(z.string().uuid()).optional().nullable(),
    is_active: z.boolean().default(true),
    valid_from: z.string().datetime().optional(),
    valid_until: z.string().datetime().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.discount_type === DISCOUNT_TYPES.PERCENTAGE) {
        return data.discount_value > 0 && data.discount_value <= DISCOUNT_VALIDATION.PERCENTAGE.MAX
      }
      return true
    },
    {
      message: 'Percentage discount must be between 0 and 100.',
      path: ['discount_value'],
    },
  )
  .refine(
    (data) => {
      if (data.valid_from && data.valid_until) {
        return new Date(data.valid_from) < new Date(data.valid_until)
      }
      return true
    },
    {
      message: 'valid_until must be after valid_from.',
      path: ['valid_until'],
    },
  )

export const discountUpdateSchema = z.object({
  discount_name: z.string().min(1).max(DISCOUNT_VALIDATION.NAME.MAX_LENGTH).optional(),
  discount_code: z.string().min(DISCOUNT_VALIDATION.CODE.MIN_LENGTH).max(DISCOUNT_VALIDATION.CODE.MAX_LENGTH).optional().nullable(),
  description: z.string().max(DISCOUNT_VALIDATION.DESCRIPTION.MAX_LENGTH).optional().nullable(),
  discount_value: z.number().positive().optional(),
  max_discount_amount: z.number().positive().optional().nullable(),
  min_order_amount: z.number().nonnegative().optional().nullable(),
  max_uses_total: z.number().int().positive().optional().nullable(),
  max_uses_per_customer: z.number().int().positive().optional(),
  eligible_user_types: z.array(discountUserTypeSchema).optional(),
  eligible_categories: z.array(z.string()).optional().nullable(),
  eligible_listings: z.array(z.string().uuid()).optional().nullable(),
  is_active: z.boolean().optional(),
  valid_from: z.string().datetime().optional(),
  valid_until: z.string().datetime().optional().nullable(),
})

export const validationContextSchema = z.object({
  user_id: z.string().uuid().optional(),
  order_total: z.number().nonnegative().optional(),
  shipping_amount: z.number().nonnegative().optional(),
  listing_ids: z.array(z.string().uuid()).optional(),
  categories: z.array(z.string()).optional(),
  user_type: discountUserTypeSchema.optional(),
  shop_id: z.string().uuid().optional(),
})

export const discountApplicationSchema = z.object({
  order_item_id: z.string().uuid(),
  discount_profile_id: z.string().uuid(),
  listing_discount_id: z.string().uuid().optional().nullable(),
  discount_name: z.string(),
  discount_type: discountTypeSchema,
  discount_amount: z.number().nonnegative(),
  applied_by_code: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
})

export const cartItemSchema = z.object({
  listing_id: z.string().uuid(),
  price: z.number().positive(),
  quantity: z.number().int().positive(),
  category: z.string().optional(),
  category_id: z.string().optional(),
})

export const discountFilterSchema = z.object({
  active_only: z.boolean().optional(),
  include_expired: z.boolean().optional(),
  discount_type: discountTypeSchema.nullable().optional(),
  applies_to: appliesToSchema.nullable().optional(),
  search: z.string().nullable().optional(),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  source: z.enum(['manual', 'event']).nullable().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
})

export const posterMetadataSchema = z.object({
  name: z
    .string()
    .trim()
    .min(DISCOUNT_VALIDATION.POSTER_NAME.MIN_LENGTH, 'Poster name is required.')
    .max(DISCOUNT_VALIDATION.POSTER_NAME.MAX_LENGTH, 'Poster name is too long.')
    .regex(
      /^[a-zA-Z0-9\s-_]+$/,
      'Name can only contain letters, numbers, spaces, hyphens and underscores.',
    ),
  width: z.number().int().positive('Width must be a positive integer.'),
  height: z.number().int().positive('Height must be a positive integer.'),
})

export const posterDimensionsSchema = z
  .object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .refine(
    (data) =>
      ALLOWED_POSTER_DIMENSIONS.some((dim) => dim.width === data.width && dim.height === data.height),
    {
      message: `Invalid dimensions. Allowed: ${ALLOWED_POSTER_DIMENSIONS.map((d) => d.label).join(', ')}`,
    },
  )

// ============= DEFAULT BUILDERS =============

export function buildDefaultDiscountFilters(): DiscountFilterInput {
  return { ...DEFAULT_DISCOUNT_FILTERS }
}

export function buildDefaultDiscountPagination() {
  return { ...DEFAULT_DISCOUNT_PAGINATION }
}

export function buildDefaultDiscountFormValues(): DiscountFormInput {
  return {
    ...DEFAULT_DISCOUNT_FORM,
    eligible_user_types: [...DEFAULT_DISCOUNT_FORM.eligible_user_types],
  }
}

export function buildDefaultBogoRuleFormValues(): BogoRuleInput {
  return { ...DEFAULT_BOGO_RULE_FORM }
}

// ============= PARSE HELPERS =============

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? `${issue.path.join('.')}: ` : ''
    return `${path}${issue.message}`
  })
}

function toValidationResult<T>(result: { success: boolean; data?: T; error?: z.ZodError }): DiscountValidationResult<T> {
  if (!result.success || result.error) {
    return {
      isValid: false,
      errors: result.error ? formatZodErrors(result.error) : ['Validation failed.'],
      data: null,
    }
  }
  return { isValid: true, errors: [], data: result.data as T }
}

export function parseDiscountCreate(data: unknown): DiscountValidationResult<DiscountCreateInput> {
  const result = discountProfileSchema.safeParse(data)
  if (!result.success) {
    return { isValid: false, errors: formatZodErrors(result.error), data: null }
  }
  return {
    isValid: true,
    errors: [],
    data: {
      shop_id: String((data as DiscountCreateInput).shop_id),
      discount_name: result.data.discount_name,
      description: result.data.description,
      discount_code: result.data.discount_code,
      discount_type: result.data.discount_type,
      discount_value: result.data.discount_value,
      max_discount_amount: result.data.max_discount_amount,
      applies_to: result.data.applies_to,
      eligible_categories: result.data.eligible_categories,
      eligible_listings: result.data.eligible_listings,
      min_order_amount: result.data.min_order_amount,
      max_uses_total: result.data.max_uses_total,
      max_uses_per_customer: result.data.max_uses_per_customer,
      eligible_user_types: result.data.eligible_user_types,
      valid_from: result.data.valid_from,
      valid_until: result.data.valid_until,
      is_active: result.data.is_active,
    },
  }
}

export function parseDiscountUpdate(data: unknown): DiscountValidationResult<DiscountUpdateInput> {
  return toValidationResult(discountUpdateSchema.safeParse(data))
}

export function parseDiscountForm(data: unknown): DiscountValidationResult<DiscountFormInput> {
  return toValidationResult(discountFormSchema.safeParse(data))
}

export function parseBogoRule(data: unknown): DiscountValidationResult<BogoRuleInput> {
  return toValidationResult(bogoRuleFormSchema.safeParse(data))
}

export function parseValidationContext(
  data: unknown,
): DiscountValidationResult<DiscountValidationContext> {
  return toValidationResult(validationContextSchema.safeParse(data))
}

export function parseDiscountApplication(
  data: unknown,
): DiscountValidationResult<DiscountApplicationInput> {
  return toValidationResult(discountApplicationSchema.safeParse(data))
}

export function parseCartItems(data: unknown): DiscountValidationResult<DiscountCartItem[]> {
  return toValidationResult(z.array(cartItemSchema).safeParse(data))
}

export function parseDiscountFilters(data: unknown): DiscountValidationResult<DiscountFilterInput> {
  const result = discountFilterSchema.safeParse(data)
  if (!result.success) {
    return { isValid: false, errors: formatZodErrors(result.error), data: null }
  }
  return { isValid: true, errors: [], data: result.data as DiscountFilterInput }
}

export function validateDiscountCreate(data: unknown): DiscountValidationResult<DiscountCreateInput> {
  return parseDiscountCreate(data)
}

export function validateDiscountUpdate(data: unknown): DiscountValidationResult<DiscountUpdateInput> {
  return parseDiscountUpdate(data)
}

export function validateBogoRule(data: unknown): DiscountValidationResult<BogoRuleInput> {
  return parseBogoRule(data)
}

export function validatePosterMetadata(
  name: string,
  dimensions: { width: number; height: number },
): DiscountValidationResult<{ name: string; width: number; height: number }> {
  return toValidationResult(posterMetadataSchema.safeParse({ name, ...dimensions }))
}

export function validatePosterDimensions(dimensions: {
  width: number
  height: number
}): DiscountValidationResult<{ width: number; height: number }> {
  return toValidationResult(posterDimensionsSchema.safeParse(dimensions))
}

export function validatePosterFile(file: File | null | undefined): DiscountValidationResult<File> {
  if (!file) {
    return { isValid: false, errors: ['No file provided.'], data: null }
  }

  if (!DISCOUNT_POSTER_CONFIG.ALLOWED_MIME_TYPES.includes(file.type as (typeof DISCOUNT_POSTER_CONFIG.ALLOWED_MIME_TYPES)[number])) {
    return {
      isValid: false,
      errors: [`Invalid file type. Allowed types: ${DISCOUNT_POSTER_CONFIG.ALLOWED_MIME_TYPES.join(', ')}`],
      data: null,
    }
  }

  if (file.size > DISCOUNT_POSTER_CONFIG.MAX_FILE_SIZE_BYTES) {
    const maxMb = DISCOUNT_POSTER_CONFIG.MAX_FILE_SIZE_BYTES / 1024 / 1024
    return {
      isValid: false,
      errors: [`File too large. Maximum size: ${maxMb}MB`],
      data: null,
    }
  }

  return { isValid: true, errors: [], data: file }
}

/** @deprecated Use parseDiscountCreate — kept for 1:1 legacy naming. */
export function validateContext(data: unknown): DiscountValidationResult<DiscountValidationContext> {
  return parseValidationContext(data)
}

/** @deprecated Use parseDiscountApplication — kept for 1:1 legacy naming. */
export function validateDiscountApplication(
  data: unknown,
): DiscountValidationResult<DiscountApplicationInput> {
  return parseDiscountApplication(data)
}

/** @deprecated Use parseCartItems — kept for 1:1 legacy naming. */
export function validateCartItems(data: unknown): DiscountValidationResult<DiscountCartItem[]> {
  return parseCartItems(data)
}
