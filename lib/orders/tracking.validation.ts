/**
 * Tracking-number validation + courier catalog.
 *
 * Migrated from the legacy `lib/utils/orders/trackingValidation.js` (courier
 * formats, cleaning, per-courier validation, suggestions) and the delivery part
 * of `lib/utils/orders/validators.js` (`validateDeliveryData`). All courier data
 * lives in the constants below so nothing is hard-coded at the call sites.
 */

import { z } from 'zod'

// ============= COURIER CATALOG =============

export const COURIER_SLUGS = {
  FEDEX: 'fedex',
  UPS: 'ups',
  USPS: 'usps',
  DHL: 'dhl',
  ARAMEX: 'aramex',
  BLUE_DART: 'bluedart',
  DELHIVERY: 'delhivery',
  DTDC: 'dtdc',
  ECOM_EXPRESS: 'ecomexpress',
  INDIA_POST: 'indiapost',
  PROFESSIONAL_COURIERS: 'professional-couriers',
  XPRESSBEES: 'xpressbees',
} as const

export type CourierSlug = (typeof COURIER_SLUGS)[keyof typeof COURIER_SLUGS]

type CourierRule = {
  name: string
  patterns: RegExp[]
  /** Message shown when the number doesn't match any pattern. */
  hint: string
  /** Human-friendly formats / examples for the "formatting tips" UI. */
  formats: string[]
  examples: string[]
}

/**
 * Per-courier validation rules + display metadata. Keyed by courier slug; the
 * generic fallback is used for anything not listed here.
 */
export const COURIER_RULES: Record<string, CourierRule> = {
  [COURIER_SLUGS.FEDEX]: {
    name: 'FedEx',
    patterns: [/^\d{12}$/, /^\d{14}$/, /^\d{20}$/],
    hint: 'FedEx tracking numbers should be 12, 14, or 20 digits',
    formats: ['12 digits', '14 digits', '20 digits'],
    examples: ['123456789012', '12345678901234'],
  },
  [COURIER_SLUGS.UPS]: {
    name: 'UPS',
    patterns: [/^1Z[0-9A-Z]{16}$/, /^\d{12}$/, /^\d{18}$/],
    hint: 'UPS tracking numbers should be in 1Z format (18 characters) or 12–18 digits',
    formats: ['1Z + 16 characters', '12 digits', '18 digits'],
    examples: ['1Z123E456789012345', '123456789012'],
  },
  [COURIER_SLUGS.USPS]: {
    name: 'USPS',
    patterns: [/^\d{20,22}$/, /^[A-Z]{2}\d{9}[A-Z]{2}$/, /^[A-Z]{4}\d{10}$/, /^\d{13}$/, /^9\d{15,21}$/],
    hint: 'Invalid USPS tracking number format',
    formats: ['20–22 digits', 'Letters + numbers combinations'],
    examples: ['12345678901234567890', 'EA123456789US'],
  },
  [COURIER_SLUGS.DHL]: {
    name: 'DHL',
    patterns: [/^\d{10}$/, /^\d{11}$/, /^\d{20}$/, /^[A-Z]{3}\d{7}$/, /^[A-Z]{2}\d{9}[A-Z]{2}$/],
    hint: 'DHL tracking numbers should be 10, 11, or 20 digits, or specific letter-number combinations',
    formats: ['10 digits', '11 digits', '20 digits'],
    examples: ['1234567890', '12345678901'],
  },
  [COURIER_SLUGS.ARAMEX]: {
    name: 'Aramex',
    patterns: [/^\d{11}$/, /^\d{13}$/, /^[A-Z]{2}\d{9}[A-Z]{2}$/],
    hint: 'Aramex tracking numbers should be 11 or 13 digits',
    formats: ['11 digits', '13 digits'],
    examples: ['12345678901', '1234567890123'],
  },
  [COURIER_SLUGS.BLUE_DART]: {
    name: 'Blue Dart',
    patterns: [/^\d{10}$/, /^\d{11}$/, /^[A-Z]{2}\d{8}$/],
    hint: 'Blue Dart tracking numbers should be 10–11 digits',
    formats: ['10 digits', '11 digits'],
    examples: ['1234567890', '12345678901'],
  },
  [COURIER_SLUGS.DELHIVERY]: {
    name: 'Delhivery',
    patterns: [/^\d{11,13}$/, /^[A-Z]{2}\d{9,11}$/],
    hint: 'Delhivery tracking numbers should be 11–13 digits or 2 letters + 9–11 digits',
    formats: ['11–13 digits', '2 letters + 9–11 digits'],
    examples: ['12345678901', 'DL123456789'],
  },
  [COURIER_SLUGS.DTDC]: {
    name: 'DTDC',
    patterns: [/^\d{12}$/, /^[A-Z]{2}\d{10}$/],
    hint: 'DTDC tracking numbers should be 12 digits or 2 letters + 10 digits',
    formats: ['12 digits', '2 letters + 10 digits'],
    examples: ['123456789012', 'DT1234567890'],
  },
  [COURIER_SLUGS.ECOM_EXPRESS]: {
    name: 'Ecom Express',
    patterns: [/^\d{13}$/, /^[A-Z]{2}\d{11}$/],
    hint: 'Ecom Express tracking numbers should be 13 digits or 2 letters + 11 digits',
    formats: ['13 digits', '2 letters + 11 digits'],
    examples: ['1234567890123', 'EC12345678901'],
  },
  [COURIER_SLUGS.INDIA_POST]: {
    name: 'India Post',
    patterns: [/^[A-Z]{2}\d{9}[A-Z]{2}$/, /^\d{13}$/, /^[A-Z]{1}\d{12}$/],
    hint: 'India Post tracking numbers should be in international format (2 letters + 9 digits + 2 letters) or 13 digits',
    formats: ['2 letters + 9 digits + 2 letters', '13 digits'],
    examples: ['EA123456789IN', '1234567890123'],
  },
  [COURIER_SLUGS.PROFESSIONAL_COURIERS]: {
    name: 'Professional Couriers',
    patterns: [/^\d{10,12}$/, /^[A-Z]{2}\d{8,10}$/],
    hint: 'Professional Couriers tracking numbers should be 10–12 digits',
    formats: ['10–12 digits', '2 letters + 8–10 digits'],
    examples: ['1234567890', 'PC12345678'],
  },
  [COURIER_SLUGS.XPRESSBEES]: {
    name: 'Xpressbees',
    patterns: [/^\d{11,13}$/, /^[A-Z]{2}\d{9,11}$/],
    hint: 'Xpressbees tracking numbers should be 11–13 digits',
    formats: ['11–13 digits', '2 letters + 9–11 digits'],
    examples: ['12345678901', 'XB123456789'],
  },
}

const GENERIC_RULE: CourierRule = {
  name: 'Courier',
  patterns: [/^[A-Z0-9]{6,30}$/],
  hint: 'Tracking number should be 6–30 alphanumeric characters',
  formats: ['6–30 alphanumeric characters'],
  examples: ['ABC123456789'],
}

/** Dropdown options for the courier picker (sorted alphabetically by name). */
export const COURIER_OPTIONS: { value: CourierSlug; label: string }[] = Object.entries(COURIER_RULES)
  .map(([value, rule]) => ({ value: value as CourierSlug, label: rule.name }))
  .sort((a, b) => a.label.localeCompare(b.label))

/** Resolve a courier slug to its display name. */
export function getCourierName(courierSlug: string | null | undefined): string {
  if (!courierSlug) return ''
  return COURIER_RULES[courierSlug.toLowerCase()]?.name ?? courierSlug
}

/** Format info (formats + examples) for a courier, for the "formatting tips" UI. */
export function getTrackingFormat(courierSlug: string | null | undefined): CourierRule {
  if (!courierSlug) return GENERIC_RULE
  return COURIER_RULES[courierSlug.toLowerCase()] ?? GENERIC_RULE
}

// ============= CLEANING + VALIDATION =============

/** Strip spaces/hyphens and upper-case a tracking number. */
export function cleanTrackingNumber(trackingNumber: string | null | undefined): string {
  if (!trackingNumber || typeof trackingNumber !== 'string') return ''
  return trackingNumber.replace(/[\s-]/g, '').toUpperCase()
}

export type TrackingValidationResult = {
  isValid: boolean
  message: string
  suggestions?: string[]
}

/** Validate a tracking number's format against its courier. */
export function validateTrackingNumber(
  trackingNumber: string | null | undefined,
  courierSlug: string | null | undefined,
): TrackingValidationResult {
  if (!trackingNumber || typeof trackingNumber !== 'string') {
    return { isValid: false, message: 'Tracking number is required' }
  }
  if (!courierSlug || typeof courierSlug !== 'string') {
    return { isValid: false, message: 'Courier service is required' }
  }

  const cleanNumber = cleanTrackingNumber(trackingNumber)
  if (cleanNumber.length < 6) {
    return { isValid: false, message: 'Tracking number must be at least 6 characters long' }
  }

  const rule = COURIER_RULES[courierSlug.toLowerCase()] ?? GENERIC_RULE
  const isValid = rule.patterns.some((pattern) => pattern.test(cleanNumber))
  return {
    isValid,
    message: isValid ? `Valid ${rule.name} tracking number` : rule.hint,
  }
}

/** Validate + attach correction suggestions when invalid. */
export function validateWithSuggestions(
  trackingNumber: string | null | undefined,
  courierSlug: string | null | undefined,
): TrackingValidationResult {
  const validation = validateTrackingNumber(trackingNumber, courierSlug)
  if (validation.isValid) return validation
  return { ...validation, suggestions: generateSuggestions(trackingNumber, courierSlug) }
}

function generateSuggestions(
  trackingNumber: string | null | undefined,
  courierSlug: string | null | undefined,
): string[] {
  const suggestions: string[] = []
  if (!trackingNumber) {
    suggestions.push('Please enter a tracking number')
    return suggestions
  }

  const cleanNumber = cleanTrackingNumber(trackingNumber)
  if (cleanNumber.length < 6) {
    suggestions.push('Tracking number seems too short. Please check and enter the complete number.')
  }
  if (cleanNumber.length > 30) {
    suggestions.push('Tracking number seems too long. Please check for any extra characters.')
  }
  if (trackingNumber.includes(' ')) suggestions.push('Remove spaces from the tracking number')
  if (trackingNumber.includes('-')) suggestions.push('Remove hyphens from the tracking number')

  const rule = courierSlug ? COURIER_RULES[courierSlug.toLowerCase()] : undefined
  if (rule) suggestions.push(rule.hint)

  return suggestions
}

// ============= DELIVERY DATA (Zod) =============

/**
 * Mirrors the legacy `validateDeliveryData`: an order id (or order item id) and
 * a delivery address are required; a tracking number, if present, must be at
 * least 5 characters.
 */
export const deliverySchema = z
  .object({
    order_id: z.string().nullish(),
    order_item_id: z.string().nullish(),
    delivery_address: z.unknown(),
    tracking_number: z.string().nullish(),
  })
  .superRefine((data, ctx) => {
    if (!data.order_id && !data.order_item_id) {
      ctx.addIssue({ code: 'custom', message: 'Either order ID or order item ID is required' })
    }
    const address = data.delivery_address
    const emptyAddress =
      address == null ||
      address === '' ||
      (typeof address === 'object' && !Array.isArray(address) && Object.keys(address).length === 0)
    if (emptyAddress) {
      ctx.addIssue({ code: 'custom', message: 'Delivery address is required' })
    }
    if (
      typeof data.tracking_number === 'string' &&
      data.tracking_number.trim().length > 0 &&
      data.tracking_number.trim().length < 5
    ) {
      ctx.addIssue({ code: 'custom', message: 'Invalid tracking number' })
    }
  })

export type DeliveryValidationResult = { isValid: boolean; errors: string[] }

export function validateDeliveryData(data: unknown): DeliveryValidationResult {
  const result = deliverySchema.safeParse(data)
  if (result.success) return { isValid: true, errors: [] }
  return { isValid: false, errors: result.error.issues.map((issue) => issue.message) }
}

/** Required fields for the Add-Tracking form (courier + tracking number). */
export const trackingFormSchema = z.object({
  courier_slug: z.string().trim().min(1, 'Courier service is required'),
  tracking_number: z.string().trim().min(1, 'Tracking number is required'),
})

export function validateTrackingForm(data: unknown): { isValid: boolean; errors: Record<string, string> } {
  const result = trackingFormSchema.safeParse(data)
  if (result.success) return { isValid: true, errors: {} }
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!errors[key]) errors[key] = issue.message
  }
  return { isValid: false, errors }
}
