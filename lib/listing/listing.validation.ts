import {
  compose,
  maxLength,
  minLength,
  numeric,
  pattern,
  required,
  type Validator,
} from '~/lib/validation'

import {
  LISTING_STATUS,
  LISTING_TYPES,
  LISTING_VALIDATION,
  type ListingFormData,
  type ListingType,
  type ListingValidationResult,
} from './listing.type'
import { z } from '~/lib/zod'

// ============= SHARED PRIMITIVES =============

/** Slugs are lowercase letters, digits and single hyphens. */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const LISTING_TYPE_VALUES: readonly ListingType[] = [
  LISTING_TYPES.PHYSICAL,
  LISTING_TYPES.DIGITAL,
  LISTING_TYPES.SERVICE,
]

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

// ============= FIELD VALIDATORS (for `useFormValidation`) =============
//
// Pure `(value: string) => string | null` validators that plug straight into
// `useFormValidation` schemas — identical pattern to shop/profile.

export const listingTitleValidator: Validator = compose(
  required('Title is required.'),
  minLength(
    LISTING_VALIDATION.TITLE.MIN_LENGTH,
    `Title must be at least ${LISTING_VALIDATION.TITLE.MIN_LENGTH} characters long.`,
  ),
  maxLength(
    LISTING_VALIDATION.TITLE.MAX_LENGTH,
    `Title must be less than ${LISTING_VALIDATION.TITLE.MAX_LENGTH} characters.`,
  ),
)

export const listingDescriptionValidator: Validator = maxLength(
  LISTING_VALIDATION.DESCRIPTION.MAX_LENGTH,
  `Description must be less than ${LISTING_VALIDATION.DESCRIPTION.MAX_LENGTH} characters.`,
)

export const listingPriceValidator: Validator = compose(
  required('Please enter a price.'),
  numeric('Please enter a valid price.'),
  (value: string) =>
    Number(value) >= LISTING_VALIDATION.PRICE.MIN
      ? null
      : `Price must be ${LISTING_VALIDATION.PRICE.MIN} or greater.`,
)

export const listingSkuValidator: Validator = maxLength(
  LISTING_VALIDATION.SKU.MAX_LENGTH,
  `SKU must not exceed ${LISTING_VALIDATION.SKU.MAX_LENGTH} characters.`,
)

export const listingMetaTitleValidator: Validator = maxLength(
  LISTING_VALIDATION.META_TITLE.MAX_LENGTH,
  `Meta title should not exceed ${LISTING_VALIDATION.META_TITLE.MAX_LENGTH} characters.`,
)

export const listingMetaDescriptionValidator: Validator = maxLength(
  LISTING_VALIDATION.META_DESCRIPTION.MAX_LENGTH,
  `Meta description should not exceed ${LISTING_VALIDATION.META_DESCRIPTION.MAX_LENGTH} characters.`,
)

export const listingSlugValidator: Validator = pattern(
  SLUG_REGEX,
  'Slug can only contain lowercase letters, numbers, and hyphens.',
)

/** Named lookup so callers can validate a single field generically. */
export const listingFieldValidators: Partial<Record<keyof ListingFormData, Validator>> = {
  title: listingTitleValidator,
  description: listingDescriptionValidator,
  price: listingPriceValidator,
  sku: listingSkuValidator,
  meta_title: listingMetaTitleValidator,
  meta_description: listingMetaDescriptionValidator,
  slug: listingSlugValidator,
}

/** Validate a single field value. Unknown fields are treated as valid. */
export function validateListingField(
  field: keyof ListingFormData,
  value: unknown,
): { isValid: boolean; error: string | null } {
  const validator = listingFieldValidators[field]
  if (!validator) return { isValid: true, error: null }
  const error = validator(typeof value === 'string' ? value : (value ?? '').toString())
  return { isValid: !error, error }
}

// ============= ZOD SCHEMAS =============

const nonNegativeNumberSchema = z
  .union([z.number(), z.string()])
  .transform(toNumber)
  .refine((val) => val === null || val >= 0, 'Must be 0 or greater.')

const priceSchema = z
  .union([z.number(), z.string()])
  .transform(toNumber)
  .refine((val) => val !== null, 'Please enter a price.')
  .refine(
    (val) => val === null || val >= LISTING_VALIDATION.PRICE.MIN,
    `Price must be ${LISTING_VALIDATION.PRICE.MIN} or greater.`,
  )

/** Base fields common to every listing type. */
const baseListingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(
      LISTING_VALIDATION.TITLE.MIN_LENGTH,
      `Title must be at least ${LISTING_VALIDATION.TITLE.MIN_LENGTH} characters long.`,
    )
    .max(
      LISTING_VALIDATION.TITLE.MAX_LENGTH,
      `Title must be less than ${LISTING_VALIDATION.TITLE.MAX_LENGTH} characters.`,
    ),
  description: z
    .string()
    .max(
      LISTING_VALIDATION.DESCRIPTION.MAX_LENGTH,
      `Description must be less than ${LISTING_VALIDATION.DESCRIPTION.MAX_LENGTH} characters.`,
    )
    .optional()
    .default(''),
  listing_type: z.enum([LISTING_TYPES.PHYSICAL, LISTING_TYPES.DIGITAL, LISTING_TYPES.SERVICE], {
    message: 'Please select a listing type.',
  }),
  price: priceSchema,
  meta_title: z
    .string()
    .max(LISTING_VALIDATION.META_TITLE.MAX_LENGTH, 'Meta title is too long.')
    .optional()
    .default(''),
  meta_description: z
    .string()
    .max(LISTING_VALIDATION.META_DESCRIPTION.MAX_LENGTH, 'Meta description is too long.')
    .optional()
    .default(''),
  slug: z
    .string()
    .trim()
    .refine((val) => !val || SLUG_REGEX.test(val), 'Invalid slug format.')
    .optional()
    .default(''),
})

/**
 * Full create/update payload schema. Type-specific requirements (physical stock
 * + materials + variations, digital file url/type, service booking duration)
 * are enforced with a `superRefine` so error paths map cleanly onto fields.
 */
export const listingSchema = baseListingSchema
  .extend({
    quantity: nonNegativeNumberSchema.nullable().optional(),
    stock: nonNegativeNumberSchema.nullable().optional(),
    sku: z
      .string()
      .max(LISTING_VALIDATION.SKU.MAX_LENGTH, 'SKU is too long.')
      .optional()
      .default(''),
    weight: nonNegativeNumberSchema.nullable().optional(),
    digital_file_url: z.string().optional().default(''),
    digital_file_type: z
      .string()
      .max(LISTING_VALIDATION.DIGITAL_FILE_TYPE.MAX_LENGTH, 'File type is too long.')
      .optional()
      .default(''),
    booking_duration_minutes: nonNegativeNumberSchema.nullable().optional(),
    max_attendees: nonNegativeNumberSchema.nullable().optional(),
    materials: z.array(z.unknown()).optional(),
    variations: z.array(z.unknown()).optional(),
    categories: z.array(z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.listing_type === LISTING_TYPES.PHYSICAL) {
      if (data.stock === null || data.stock === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['stock'],
          message: 'Stock quantity is required for physical products.',
        })
      }
      if (!Array.isArray(data.materials) || data.materials.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['materials'],
          message: 'At least one material is required for physical products.',
        })
      }
      if (!Array.isArray(data.variations) || data.variations.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['variations'],
          message: 'At least one product variation is required for physical products.',
        })
      }
    }

    if (data.listing_type === LISTING_TYPES.DIGITAL) {
      if (!data.digital_file_type?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['digital_file_type'],
          message: 'File type is required for digital products.',
        })
      }
      if (!data.digital_file_url?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['digital_file_url'],
          message: 'File URL is required for digital products.',
        })
      }
    }

    if (data.listing_type === LISTING_TYPES.SERVICE) {
      if (
        data.booking_duration_minutes === null ||
        data.booking_duration_minutes === undefined ||
        data.booking_duration_minutes < LISTING_VALIDATION.BOOKING_DURATION.MIN
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['booking_duration_minutes'],
          message: 'Booking duration is required for services.',
        })
      }
    }
  })

export type ListingSchemaInput = z.input<typeof listingSchema>
export type ListingSchemaOutput = z.output<typeof listingSchema>

/** Convert a Zod error into the flat `{ field: message }` map used by forms. */
function zodErrorToMap(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : 'form'
    if (!errors[key]) errors[key] = issue.message
  }
  return errors
}

/**
 * Validate a listing payload with Zod and return the profile/shop-style result.
 * Accepts partial data so it can be used for both create and edit flows.
 */
export function validateListingData(data: Partial<ListingFormData>): ListingValidationResult {
  const result = listingSchema.safeParse(data)
  if (result.success) return { isValid: true, errors: {} }
  return { isValid: false, errors: zodErrorToMap(result.error) }
}

// ============= STEP / TYPE-SPECIFIC VALIDATION =============

/**
 * Validate only the "core" fields (title / type / price) — useful for a first
 * step before the user has filled type-specific detail.
 */
export function validateListingCore(data: Partial<ListingFormData>): ListingValidationResult {
  const errors: Record<string, string> = {}
  const { error: titleError } = validateListingField('title', data.title)
  if (titleError) errors.title = titleError
  const { error: priceError } = validateListingField('price', data.price)
  if (priceError) errors.price = priceError
  if (!data.listing_type || !LISTING_TYPE_VALUES.includes(data.listing_type)) {
    errors.listing_type = 'Please select a listing type.'
  }
  return { isValid: Object.keys(errors).length === 0, errors }
}

/** Whether the minimum required fields are present to submit a listing. */
export function isListingReadyForSubmission(data: Partial<ListingFormData>): {
  isReady: boolean
  missingFields: string[]
} {
  const missingFields: string[] = []
  if (!data.title || !data.title.trim()) missingFields.push('title')
  if (toNumber(data.price) === null) missingFields.push('price')
  if (!data.listing_type) missingFields.push('listing_type')
  return { isReady: missingFields.length === 0, missingFields }
}

// ============= CHILD-COLLECTION VALIDATION =============

/**
 * Normalise + validate category assignments: dedupe, cap at the max, and ensure
 * exactly one primary. Returns a prepared list plus optional warning/error.
 */
export function validateCategoryData(
  categories: { category_id?: string; is_primary?: boolean }[] | undefined,
): {
  isValid: boolean
  data: { category_id: string; is_primary: boolean }[]
  warning?: string
  error?: string
} {
  const valid = (categories ?? []).filter(
    (cat): cat is { category_id: string; is_primary?: boolean } =>
      !!cat && typeof cat.category_id === 'string' && cat.category_id.length > 0,
  )

  if (valid.length === 0) {
    return {
      isValid: true,
      data: [],
      warning: 'No categories selected. Adding categories improves discoverability.',
    }
  }

  if (valid.length > LISTING_VALIDATION.CATEGORIES.MAX_SELECTED) {
    return {
      isValid: false,
      error: `Maximum ${LISTING_VALIDATION.CATEGORIES.MAX_SELECTED} categories allowed per listing.`,
      data: valid
        .slice(0, LISTING_VALIDATION.CATEGORIES.MAX_SELECTED)
        .map((cat, index) => ({ category_id: cat.category_id, is_primary: index === 0 })),
    }
  }

  let foundPrimary = false
  const data = valid.map((cat, index) => {
    const isPrimary = (cat.is_primary || index === 0) && !foundPrimary
    if (isPrimary) foundPrimary = true
    return { category_id: cat.category_id, is_primary: isPrimary }
  })
  if (!foundPrimary && data.length > 0) data[0].is_primary = true

  return { isValid: true, data }
}
