/**
 * Sale Events — Zod validation schemas + runners.
 *
 * Ported 1:1 from `sales.event-validation.js`. Currency codes are derived from
 * the shared `SALE_CURRENCY_CODES` (reused from the shop module) so validation
 * can never drift from the currencies the UI actually offers.
 */

import { z } from 'zod'

import {
  DEFAULT_SALE_CURRENCY,
  DISCOUNT_TYPE,
  ENROLLMENT_STATUS,
  OFFER_APPLIES_TO,
  SALE_CURRENCY_CODES,
  SALE_EVENT_STATUS,
} from './sale-event.type'

// ============= HELPERS =============

/** Coerce datetime-local / partial ISO strings into a full ISO timestamp. */
const toIso = (val: unknown): unknown => {
  if (typeof val !== 'string') return val
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val)) return `${val}:00.000Z`
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val)) return `${val}.000Z`
  const d = new Date(val)
  if (!Number.isNaN(d.getTime())) return d.toISOString()
  return val
}

const isoDatetime = (message: string) =>
  z.preprocess(
    toIso,
    z.union([z.string().datetime({ message }), z.date().transform((d) => d.toISOString())]),
  )

const optionalIsoDatetime = (message: string) =>
  z.preprocess(
    (val) => (!val || val === '' ? null : toIso(val)),
    z
      .union([
        z.string().datetime({ message }),
        z.date().transform((d) => d.toISOString()),
        z.null(),
      ])
      .optional()
      .nullable(),
  )

const currencySchema = z
  .string()
  .refine((val) => (SALE_CURRENCY_CODES as readonly string[]).includes(val), {
    message: `currency must be one of: ${SALE_CURRENCY_CODES.join(', ')}`,
  })

const safePositiveNumber = z.union([
  z.number().positive(),
  z.string().transform((val) => parseFloat(val)).pipe(z.number().positive()),
])

const safePositiveInt = z.union([
  z.number().int().positive(),
  z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()),
])

const safeNonNegativeNumber = z.union([
  z.number().min(0),
  z.string().transform((val) => parseFloat(val)).pipe(z.number().min(0)),
])

// ============= EVENT SCHEMAS =============

/** Base object schema — kept as a ZodObject so `.partial()` works for updates. */
const eventBaseSchema = z.object({
  event_name: z
    .string()
    .trim()
    .min(3, 'Event name must be at least 3 characters')
    .max(255, 'Event name cannot exceed 255 characters'),

  event_slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Slug must be at least 3 characters')
    .max(255, 'Slug cannot exceed 255 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens only'),

  description: z.string().max(2000, 'Description cannot exceed 2000 characters').optional().nullable(),

  start_date: isoDatetime('start_date must be a valid ISO datetime'),
  end_date: isoDatetime('end_date must be a valid ISO datetime'),

  banner_image: z.string().url('banner_image must be a valid URL').optional().nullable(),

  currency: currencySchema.default(DEFAULT_SALE_CURRENCY),

  registration_start_date: optionalIsoDatetime('registration_start_date must be a valid ISO datetime'),
  registration_end_date: optionalIsoDatetime('registration_end_date must be a valid ISO datetime'),

  status: z
    .enum([SALE_EVENT_STATUS.DRAFT, SALE_EVENT_STATUS.ACTIVE, SALE_EVENT_STATUS.EXPIRED])
    .default(SALE_EVENT_STATUS.DRAFT),
})

export const createEventSchema = eventBaseSchema
  .refine((data) => new Date(data.end_date) > new Date(data.start_date), {
    message: 'end_date must be after start_date',
    path: ['end_date'],
  })
  .refine(
    (data) =>
      !(data.registration_start_date && data.registration_end_date) ||
      new Date(data.registration_end_date) > new Date(data.registration_start_date),
    { message: 'registration_end_date must be after registration_start_date', path: ['registration_end_date'] },
  )

export const updateEventSchema = eventBaseSchema
  .partial()
  .refine(
    (data) =>
      !(data.start_date && data.end_date) || new Date(data.end_date) > new Date(data.start_date),
    { message: 'end_date must be after start_date', path: ['end_date'] },
  )
  .refine(
    (data) =>
      !(data.registration_start_date && data.registration_end_date) ||
      new Date(data.registration_end_date) > new Date(data.registration_start_date),
    { message: 'registration_end_date must be after registration_start_date', path: ['registration_end_date'] },
  )

// ============= OFFER SCHEMAS =============

export const createEventOfferSchema = z
  .object({
    event_id: z.string().uuid('event_id must be a valid UUID'),
    offer_name: z
      .string()
      .trim()
      .min(1, 'Offer name is required')
      .max(255, 'Offer name cannot exceed 255 characters'),
    discount_type: z.enum([DISCOUNT_TYPE.PERCENTAGE, DISCOUNT_TYPE.FIXED]),
    discount_value: safePositiveNumber,
    max_discount_amount: safePositiveNumber.optional().nullable(),
    min_order_amount: safeNonNegativeNumber.optional().default(0),
    max_uses_total: safePositiveInt.optional().nullable(),
    max_uses_per_customer: safePositiveInt.optional().default(1),
    applies_to: z.enum([OFFER_APPLIES_TO.ORDER, OFFER_APPLIES_TO.PRODUCT, OFFER_APPLIES_TO.CATEGORY]),
    currency: currencySchema.optional().default(DEFAULT_SALE_CURRENCY),
  })
  .refine((data) => data.discount_type !== DISCOUNT_TYPE.PERCENTAGE || data.discount_value <= 100, {
    message: 'Percentage discount cannot exceed 100',
    path: ['discount_value'],
  })

// ============= ATTACH SCHEMAS =============

/** category_id is TEXT in the categories table (e.g. '1', '10', '103'), not a UUID. */
export const attachOfferCategoriesSchema = z.object({
  offer_id: z.string().uuid('offer_id must be a valid UUID'),
  category_ids: z
    .array(z.string().min(1, 'category_id cannot be empty'))
    .min(1, 'At least one category is required'),
})

export const attachOfferListingsSchema = z.object({
  offer_id: z.string().uuid('offer_id must be a valid UUID'),
  listing_ids: z
    .array(z.string().uuid('Each listing_id must be a valid UUID'))
    .min(1, 'At least one listing is required'),
})

// ============= PICKER SCHEMAS =============

export const categoryQuerySchema = z.object({
  parent_id: z.string().optional().nullable(),
  level: z.number().int().min(0).optional().nullable(),
  status: z.string().optional().default('A'),
  search: z.string().optional().nullable(),
  lang_code: z.string().optional().default('en'),
})

export const listingPickerQuerySchema = z.object({
  shop_ids: z.array(z.string().uuid('Each shop_id must be a valid UUID')).optional(),
  search: z.string().optional().nullable(),
  listing_type: z.enum(['physical', 'digital', 'service']).optional().nullable(),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
})

// ============= ENROLLMENT SCHEMAS =============

export const vendorEnrollSchema = z.object({
  event_id: z.string().uuid('event_id must be a valid UUID'),
  shop_id: z.string().uuid('shop_id must be a valid UUID'),
})

export const updateEnrollmentStatusSchema = z.object({
  status: z.enum([ENROLLMENT_STATUS.ACCEPTED, ENROLLMENT_STATUS.REJECTED]),
})

// ============= RUNNERS =============

/** Parse and throw a single joined error message on failure (store thunks use this). */
export function parseOrThrow<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload)
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
      .join(' | ')
    throw new Error(messages)
  }
  return result.data
}

/** Non-throwing runner returning a normalised `{ success, data, errors }` shape. */
export function validate<T>(
  schema: z.ZodType<T>,
  payload: unknown,
): { success: boolean; data: T | null; errors: string[] | null } {
  const result = schema.safeParse(payload)
  if (result.success) return { success: true, data: result.data, errors: null }
  const errors = result.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
  return { success: false, data: null, errors }
}

// ============= INFERRED TYPES =============

export type CreateEventSchema = z.infer<typeof createEventSchema>
export type UpdateEventSchema = z.infer<typeof updateEventSchema>
export type CreateEventOfferSchema = z.infer<typeof createEventOfferSchema>
