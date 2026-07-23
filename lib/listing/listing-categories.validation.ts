/**
 * Category validation — **Zod** schemas (source of truth) plus thin
 * `useFormValidation`-compatible field validators. Ported from the legacy Yup
 * `categories-schema.js` and kept symmetric with `listing.validation`.
 */

import { compose, maxLength, minLength, pattern, required, type Validator } from '~/lib/validation'

import {
  CATEGORY_ID_PATTERN,
  CATEGORY_LANGUAGE_CODES,
  CATEGORY_LIMITS,
  CATEGORY_SEO_NAME_PATTERN,
  CATEGORY_STATUS,
  type CategoryFormData,
  type CategoryValidationResult,
} from './listing-categories.type'
import { z } from '~/lib/zod'

// ============= SHARED PRIMITIVES =============

const STATUS_VALUES = [CATEGORY_STATUS.ACTIVE, CATEGORY_STATUS.DISABLED, CATEGORY_STATUS.HIDDEN] as const

const optionalTrimmedString = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((value) => (value ? value : null))

const parentIdSchema = z
  .string()
  .trim()
  .regex(CATEGORY_ID_PATTERN, 'Invalid parent category ID format.')
  .nullish()
  .transform((value) => (value ? value : null))

const seoNameSchema = z
  .string()
  .trim()
  .min(1, 'SEO name is required.')
  .max(CATEGORY_LIMITS.MAX_SEO_NAME_LENGTH, 'SEO name is too long.')
  .regex(
    CATEGORY_SEO_NAME_PATTERN,
    'SEO name may only contain lowercase letters, numbers, hyphens and underscores.',
  )
  .nullish()
  .transform((value) => (value ? value : null))

// ============= FIELD VALIDATORS (for `useFormValidation`) =============

export const categoryNameValidator: Validator = compose(
  required('Category name is required.'),
  minLength(1, 'Category name is required.'),
  maxLength(
    CATEGORY_LIMITS.MAX_NAME_LENGTH,
    `Category name must be ${CATEGORY_LIMITS.MAX_NAME_LENGTH} characters or fewer.`,
  ),
)

export const categoryDescriptionValidator: Validator = maxLength(
  CATEGORY_LIMITS.MAX_DESCRIPTION_LENGTH,
  `Description must be ${CATEGORY_LIMITS.MAX_DESCRIPTION_LENGTH} characters or fewer.`,
)

export const categorySeoNameValidator: Validator = compose(
  maxLength(
    CATEGORY_LIMITS.MAX_SEO_NAME_LENGTH,
    `SEO name must be ${CATEGORY_LIMITS.MAX_SEO_NAME_LENGTH} characters or fewer.`,
  ),
  pattern(
    CATEGORY_SEO_NAME_PATTERN,
    'SEO name may only contain lowercase letters, numbers, hyphens and underscores.',
  ),
)

// ============= ZOD SCHEMAS =============

/** Fields common to create + update. */
const baseCategoryShape = {
  category: z
    .string()
    .trim()
    .min(1, 'Category name is required.')
    .max(CATEGORY_LIMITS.MAX_NAME_LENGTH, 'Category name is too long.'),
  description: optionalTrimmedString(
    CATEGORY_LIMITS.MAX_DESCRIPTION_LENGTH,
    'Description is too long.',
  ),
  parent_id: parentIdSchema,
  status: z.enum(STATUS_VALUES).default(CATEGORY_STATUS.ACTIVE),
  position: z.number().int().min(0, 'Position must be non-negative.').default(0),
  lang_code: z.enum(CATEGORY_LANGUAGE_CODES).default('en'),
  seo_name: seoNameSchema,
  meta_keywords: optionalTrimmedString(
    CATEGORY_LIMITS.MAX_META_KEYWORDS_LENGTH,
    'Meta keywords are too long.',
  ),
  meta_description: optionalTrimmedString(
    CATEGORY_LIMITS.MAX_META_DESCRIPTION_LENGTH,
    'Meta description is too long.',
  ),
  meta_title: optionalTrimmedString(
    CATEGORY_LIMITS.MAX_PAGE_TITLE_LENGTH,
    'Meta title is too long.',
  ),
  page_title: optionalTrimmedString(
    CATEGORY_LIMITS.MAX_PAGE_TITLE_LENGTH,
    'Page title is too long.',
  ),
  category_image_url: z.string().trim().url('Enter a valid image URL.').nullish(),
  category_icon: z.string().trim().nullish(),
  og_image: z.string().trim().url('Enter a valid image URL.').nullish(),
}

export const createCategorySchema = z.object(baseCategoryShape)

export const updateCategorySchema = z.object({
  ...baseCategoryShape,
  category_id: z
    .string()
    .trim()
    .regex(CATEGORY_ID_PATTERN, 'Invalid category ID format.'),
})

export const categoryQuerySchema = z.object({
  parent_id: parentIdSchema,
  status: z.enum(STATUS_VALUES).nullish(),
  lang_code: z.enum(CATEGORY_LANGUAGE_CODES).nullish(),
  level: z.number().int().min(0).max(CATEGORY_LIMITS.MAX_HIERARCHY_DEPTH).nullish(),
  search_term: z.string().trim().max(100, 'Search term is too long.').nullish(),
  limit: z.number().int().min(1).max(500).default(20),
  offset: z.number().int().min(0).default(0),
})

export const moveCategorySchema = z.object({
  category_id: z.string().trim().regex(CATEGORY_ID_PATTERN, 'Invalid category ID format.'),
  new_parent_id: parentIdSchema,
  new_position: z.number().int().min(0, 'Position must be non-negative.').nullish(),
})

export const categoryAssignmentSchema = z.object({
  category_id: z.string().trim().regex(CATEGORY_ID_PATTERN, 'Invalid category ID format.'),
  listing_id: z.string().uuid('Invalid listing ID format.'),
  is_primary: z.boolean().default(false),
})

export const bulkCategoryAssignmentSchema = z.object({
  listing_id: z.string().uuid('Invalid listing ID format.'),
  categories: z
    .array(
      z.object({
        category_id: z
          .string()
          .trim()
          .regex(CATEGORY_ID_PATTERN, 'Invalid category ID format.'),
        is_primary: z.boolean().default(false),
      }),
    )
    .min(1, 'Select at least one category.')
    .max(
      CATEGORY_LIMITS.MAX_CATEGORIES_PER_LISTING,
      `A listing can have at most ${CATEGORY_LIMITS.MAX_CATEGORIES_PER_LISTING} categories.`,
    )
    .refine(
      (cats) => cats.filter((c) => c.is_primary).length <= 1,
      'Only one category can be marked as primary.',
    ),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type CategoryQueryInput = z.infer<typeof categoryQuerySchema>
export type MoveCategoryInput = z.infer<typeof moveCategorySchema>
export type BulkCategoryAssignmentInput = z.infer<typeof bulkCategoryAssignmentSchema>

// ============= HELPERS =============

function zodErrorToMap(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : 'form'
    if (!errors[key]) errors[key] = issue.message
  }
  return errors
}

/**
 * Validate a category form payload with Zod and return the profile/shop-style
 * result. `category` is always required; every other field is optional and gets
 * a sensible default, so this works for both create and edit flows.
 */
export function validateCategoryData(data: Partial<CategoryFormData>): CategoryValidationResult {
  const result = createCategorySchema.safeParse(data)
  if (result.success) return { isValid: true, errors: {} }
  return { isValid: false, errors: zodErrorToMap(result.error) }
}

export type CategoryOperation =
  | 'create'
  | 'update'
  | 'query'
  | 'move'
  | 'assignment'
  | 'bulk-assignment'

const OPERATION_SCHEMAS = {
  create: createCategorySchema,
  update: updateCategorySchema,
  query: categoryQuerySchema,
  move: moveCategorySchema,
  assignment: categoryAssignmentSchema,
  'bulk-assignment': bulkCategoryAssignmentSchema,
} as const

/**
 * Validate data for a specific operation, returning the parsed data on success
 * or a field→message map on failure. Mirrors the legacy `validateCategoryOperation`.
 */
export function validateCategoryOperation<Op extends CategoryOperation>(
  data: unknown,
  operation: Op,
): { isValid: boolean; data: z.infer<(typeof OPERATION_SCHEMAS)[Op]> | null; errors: Record<string, string> } {
  const schema = OPERATION_SCHEMAS[operation]
  const result = schema.safeParse(data)
  if (result.success) {
    return { isValid: true, data: result.data as z.infer<(typeof OPERATION_SCHEMAS)[Op]>, errors: {} }
  }
  return { isValid: false, data: null, errors: zodErrorToMap(result.error) }
}

/**
 * Normalise a validated payload before hitting the DB: attach the CS-Cart epoch
 * timestamp and default the JSONB columns (the legacy `transformCategoryData`).
 */
export function transformCategoryData<T extends Record<string, unknown>>(categoryData: T): T & {
  timestamp: number
  main_pair: Record<string, unknown>
  category_meta: Record<string, unknown>
} {
  return {
    ...categoryData,
    timestamp: Math.floor(Date.now() / 1000),
    main_pair: (categoryData.main_pair as Record<string, unknown>) ?? {},
    category_meta: (categoryData.category_meta as Record<string, unknown>) ?? {},
  }
}
