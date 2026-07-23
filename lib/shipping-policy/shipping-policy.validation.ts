import { z } from 'zod'

import { getAllGeoCountries, resolveCountryCode } from '~/lib/geo'

import {
  DEFAULT_SHIPPING_POLICY_VALUES,
  SHIPPING_POLICY_VALIDATION,
  SHIPPING_RATE_TYPE_VALUES,
  SHIPPING_ZONE_TYPE_VALUES,
} from './shipping-policy.constants'
import type {
  ShippingPolicyFormData,
  ShippingPolicyInput,
  ShippingPolicyValidationResult,
  ShippingRate,
  ShippingZone,
} from './shipping-policy.type'

// ============= ZOD SCHEMAS =============

export const shippingRateSchema = z.object({
  fee: z.coerce.number().min(SHIPPING_POLICY_VALIDATION.FIXED_FEE.MIN, 'Shipping fee must be 0 or greater.'),
  min_order: z.coerce
    .number()
    .min(SHIPPING_POLICY_VALIDATION.FREE_SHIPPING_THRESHOLD.MIN, 'Minimum order must be 0 or greater.'),
  max_order: z.coerce.number().nullable().optional(),
  max_weight: z.coerce.number().positive('Maximum weight must be greater than 0.').nullable().optional(),
  estimated_days: z.coerce
    .number()
    .int()
    .min(1, 'Estimated days must be at least 1.')
    .nullable()
    .optional(),
})

export const shippingZoneSchema = z.object({
  zone: z.union([z.enum(SHIPPING_ZONE_TYPE_VALUES), z.string().min(1)]),
  zone_name: z
    .string()
    .max(
      SHIPPING_POLICY_VALIDATION.ZONE_NAME.MAX_LENGTH,
      `Zone name must be ${SHIPPING_POLICY_VALIDATION.ZONE_NAME.MAX_LENGTH} characters or less.`,
    )
    .nullable()
    .optional(),
  description: z
    .string()
    .max(
      SHIPPING_POLICY_VALIDATION.ZONE_DESCRIPTION.MAX_LENGTH,
      `Description must be ${SHIPPING_POLICY_VALIDATION.ZONE_DESCRIPTION.MAX_LENGTH} characters or less.`,
    )
    .nullable()
    .optional(),
  countries: z.array(z.string().min(2)).min(1, 'At least one country must be selected.'),
  rates: z.array(shippingRateSchema).optional(),
})

export const shippingRateTypeSchema = z.enum(SHIPPING_RATE_TYPE_VALUES)

export const shippingPolicyInputBaseSchema = z.object({
  profile_name: z
    .string()
    .trim()
    .min(
      SHIPPING_POLICY_VALIDATION.PROFILE_NAME.MIN_LENGTH,
      'Profile name is required.',
    )
    .max(
      SHIPPING_POLICY_VALIDATION.PROFILE_NAME.MAX_LENGTH,
      `Profile name must be ${SHIPPING_POLICY_VALIDATION.PROFILE_NAME.MAX_LENGTH} characters or less.`,
    ),
  is_default: z.boolean().default(DEFAULT_SHIPPING_POLICY_VALUES.IS_DEFAULT),
  is_active: z.boolean().default(DEFAULT_SHIPPING_POLICY_VALUES.IS_ACTIVE),
  processing_time_min: z.coerce
    .number()
    .int()
    .min(
      SHIPPING_POLICY_VALIDATION.PROCESSING_TIME.MIN,
      `Minimum processing time must be at least ${SHIPPING_POLICY_VALIDATION.PROCESSING_TIME.MIN} day.`,
    )
    .default(DEFAULT_SHIPPING_POLICY_VALUES.PROCESSING_TIME_MIN),
  processing_time_max: z.coerce
    .number()
    .int()
    .max(
      SHIPPING_POLICY_VALIDATION.PROCESSING_TIME.MAX,
      `Maximum processing time cannot exceed ${SHIPPING_POLICY_VALIDATION.PROCESSING_TIME.MAX} days.`,
    )
    .default(DEFAULT_SHIPPING_POLICY_VALUES.PROCESSING_TIME_MAX),
  shipping_zones: z.array(shippingZoneSchema).default([]),
  free_shipping_threshold: z.coerce.number().min(0).nullable().optional(),
  delivery_metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  shipping_rate_type: shippingRateTypeSchema.default(DEFAULT_SHIPPING_POLICY_VALUES.SHIPPING_RATE_TYPE),
  fixed_fee: z.coerce
    .number()
    .min(SHIPPING_POLICY_VALIDATION.FIXED_FEE.MIN)
    .nullable()
    .optional()
    .default(DEFAULT_SHIPPING_POLICY_VALUES.FIXED_FEE),
})

function refineShippingPolicyCrossFields(
  value: {
    processing_time_min?: number
    processing_time_max?: number
    free_shipping_threshold?: number | null
  },
  ctx: z.RefinementCtx,
): void {
  if (
    value.processing_time_min != null &&
    value.processing_time_max != null &&
    value.processing_time_max < value.processing_time_min
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Maximum processing time must be greater than or equal to minimum.',
      path: ['processing_time_max'],
    })
  }

  if (
    value.free_shipping_threshold != null &&
    value.free_shipping_threshold < SHIPPING_POLICY_VALIDATION.FREE_SHIPPING_THRESHOLD.MIN
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Free shipping threshold must be a positive number.',
      path: ['free_shipping_threshold'],
    })
  }
}

export const shippingPolicyInputSchema = shippingPolicyInputBaseSchema.superRefine((value, ctx) => {
  refineShippingPolicyCrossFields(value, ctx)
})

/** Zod v4: `.partial()` must be applied before refinements, not after `.superRefine()`. */
export const shippingPolicyUpdateSchema = shippingPolicyInputBaseSchema
  .partial()
  .superRefine((value, ctx) => {
    refineShippingPolicyCrossFields(value, ctx)
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required to update a shipping policy.',
  })

export const assignShippingPolicySchema = z.object({
  listingId: z.string().uuid('A valid listing is required.'),
  deliveryProfileId: z.string().uuid('A valid shipping policy is required.'),
})

// ============= ZONE VALIDATION (ported from shippingZoneUtils) =============

function getValidCountryCodes(): string[] {
  return getAllGeoCountries().map((country) => country.isoCode.toUpperCase())
}

export function validateShippingRate(rate: ShippingRate): ShippingPolicyValidationResult {
  const parsed = shippingRateSchema.safeParse(rate)
  if (parsed.success) return { isValid: true, errors: {}, fieldErrors: [] }

  const fieldErrors = parsed.error.issues.map((issue) => issue.message)
  return { isValid: false, errors: { rate: fieldErrors[0] ?? 'Invalid rate.' }, fieldErrors }
}

export function validateShippingZone(zone: ShippingZone): ShippingPolicyValidationResult {
  const parsed = shippingZoneSchema.safeParse(zone)
  const fieldErrors: string[] = []

  if (!parsed.success) {
    for (const issue of parsed.error.issues) fieldErrors.push(issue.message)
    return { isValid: false, errors: { zone: fieldErrors[0] ?? 'Invalid zone.' }, fieldErrors }
  }

  const masterCodes = getValidCountryCodes()
  const invalidCountries = zone.countries.filter(
    (code) => !masterCodes.includes(resolveCountryCode(code)),
  )
  if (invalidCountries.length > 0) {
    fieldErrors.push(`Invalid country codes: ${invalidCountries.join(', ')}`)
  }

  if (zone.rates?.length) {
    for (const rate of zone.rates) {
      const rateResult = validateShippingRate(rate)
      if (!rateResult.isValid) fieldErrors.push(...rateResult.fieldErrors)
    }

    const sorted = [...zone.rates].sort((a, b) => a.min_order - b.min_order)
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const current = sorted[i]
      const next = sorted[i + 1]
      if (current.max_order != null && next.min_order < current.max_order) {
        fieldErrors.push('Overlapping rate ranges detected in a shipping zone.')
        break
      }
    }
  }

  if (fieldErrors.length > 0) {
    return { isValid: false, errors: { zone: fieldErrors[0] }, fieldErrors }
  }

  return { isValid: true, errors: {}, fieldErrors: [] }
}

export function validateShippingZones(zones: ShippingZone[] | null | undefined): ShippingPolicyValidationResult {
  if (!Array.isArray(zones)) {
    return { isValid: false, errors: { shipping_zones: 'Shipping zones must be an array.' }, fieldErrors: ['Shipping zones must be an array.'] }
  }

  if (zones.length === 0) {
    return { isValid: true, errors: {}, fieldErrors: [] }
  }

  const fieldErrors: string[] = []
  const seenCountries: string[] = []

  zones.forEach((zone, index) => {
    const zoneResult = validateShippingZone(zone)
    if (!zoneResult.isValid) {
      fieldErrors.push(`Zone ${index + 1}: ${zoneResult.fieldErrors.join(', ')}`)
    }

    for (const country of zone.countries ?? []) {
      const code = resolveCountryCode(country)
      if (seenCountries.includes(code)) {
        fieldErrors.push(`Country ${code} is assigned to multiple zones.`)
      } else {
        seenCountries.push(code)
      }
    }
  })

  if (fieldErrors.length > 0) {
    return { isValid: false, errors: { shipping_zones: fieldErrors[0] }, fieldErrors }
  }

  return { isValid: true, errors: {}, fieldErrors: [] }
}

// ============= PROFILE VALIDATION =============

function zodErrorsToResult(error: z.ZodError): ShippingPolicyValidationResult {
  const errors: Record<string, string> = {}
  const fieldErrors: string[] = []

  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    if (!errors[key]) errors[key] = issue.message
    fieldErrors.push(issue.message)
  }

  return { isValid: false, errors, fieldErrors }
}

export function validateShippingPolicyInput(
  input: ShippingPolicyInput | ShippingPolicyFormData,
): ShippingPolicyValidationResult {
  const parsed = shippingPolicyInputSchema.safeParse(input)
  if (!parsed.success) return zodErrorsToResult(parsed.error)

  if (parsed.data.shipping_zones?.length) {
    const zonesResult = validateShippingZones(parsed.data.shipping_zones)
    if (!zonesResult.isValid) return zonesResult
  }

  return { isValid: true, errors: {}, fieldErrors: [] }
}

export function validateShippingPolicyUpdate(
  input: Partial<ShippingPolicyInput>,
): ShippingPolicyValidationResult {
  const parsed = shippingPolicyUpdateSchema.safeParse(input)
  if (!parsed.success) return zodErrorsToResult(parsed.error)

  if (parsed.data.shipping_zones?.length) {
    const zonesResult = validateShippingZones(parsed.data.shipping_zones)
    if (!zonesResult.isValid) return zonesResult
  }

  return { isValid: true, errors: {}, fieldErrors: [] }
}

export function parseShippingPolicyInput(input: ShippingPolicyInput | ShippingPolicyFormData) {
  return shippingPolicyInputSchema.parse(input)
}

export function parseShippingPolicyUpdate(input: Partial<ShippingPolicyInput>) {
  return shippingPolicyUpdateSchema.parse(input)
}

export function buildDefaultShippingPolicyFormData(
  shopName?: string | null,
  shopCountry?: string | null,
): ShippingPolicyFormData {
  const name = shopName?.trim() || 'Shop'
  const country = resolveCountryCode(shopCountry ?? undefined)

  return {
    profile_name: `${name} Standard Delivery`,
    is_default: DEFAULT_SHIPPING_POLICY_VALUES.IS_DEFAULT,
    is_active: DEFAULT_SHIPPING_POLICY_VALUES.IS_ACTIVE,
    processing_time_min: DEFAULT_SHIPPING_POLICY_VALUES.PROCESSING_TIME_MIN,
    processing_time_max: DEFAULT_SHIPPING_POLICY_VALUES.PROCESSING_TIME_MAX,
    shipping_rate_type: DEFAULT_SHIPPING_POLICY_VALUES.SHIPPING_RATE_TYPE,
    fixed_fee: DEFAULT_SHIPPING_POLICY_VALUES.FIXED_FEE,
    free_shipping_threshold: null,
    shipping_zones: [
      {
        zone: 'shop',
        zone_name: 'Shop Shipping',
        countries: [country],
        rates: [],
      },
    ],
    delivery_metadata: {},
  }
}
