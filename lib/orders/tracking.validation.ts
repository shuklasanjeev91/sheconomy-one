import { z } from '~/lib/zod'

/**
 * Tracking-number validation + courier catalog.
 * Vendors pick a courier + paste AWB; status sync uses aggregators / direct APIs.
 */

// ============= COURIER CATALOG =============

export const COURIER_SLUGS = {
  // Global
  FEDEX: 'fedex',
  UPS: 'ups',
  USPS: 'usps',
  DHL: 'dhl',
  DHL_ECOMMERCE: 'dhl-ecommerce',
  ARAMEX: 'aramex',
  TNT: 'tnt',
  DPD: 'dpd',
  EVRI: 'evri',
  SF_EXPRESS: 'sf-express',
  CANADA_POST: 'canada-post',
  AUSTRALIA_POST: 'australia-post',
  // India — major
  BLUE_DART: 'bluedart',
  DELHIVERY: 'delhivery',
  DTDC: 'dtdc',
  ECOM_EXPRESS: 'ecomexpress',
  INDIA_POST: 'indiapost',
  XPRESSBEES: 'xpressbees',
  PROFESSIONAL_COURIERS: 'professional-couriers',
  EKART: 'ekart',
  SHADOWFAX: 'shadowfax',
  GATI: 'gati',
  SAFEEXPRESS: 'safexpress',
  TRACKON: 'trackon',
  DOTZOT: 'dotzot',
  LOADSHARE: 'loadshare',
  BORZO: 'borzo',
  DUNZO: 'dunzo',
  SHREE_MARUTI: 'shree-maruti',
  CRITICALOG: 'criticalog',
  RIVIGO: 'rivigo',
  WOW_EXPRESS: 'wow-express',
  JTEXPRESS: 'jtexpress',
  AMAZON_SHIPPING: 'amazon-shipping',
  // Marketplace partners (vendor's own accounts)
  SHIPROCKET: 'shiprocket',
  PICKRR: 'pickrr',
  OTHER: 'other',
} as const

export type CourierSlug = (typeof COURIER_SLUGS)[keyof typeof COURIER_SLUGS]

export type CourierRegion = 'domestic' | 'international' | 'other' | 'legacy'

type CourierRule = {
  name: string
  patterns: RegExp[]
  hint: string
  formats: string[]
  examples: string[]
}

export type CourierOption = { value: CourierSlug; label: string; region: CourierRegion }

/** India-first picker regions. Legacy slugs stay in COURIER_RULES for existing AWBs. */
export const COURIER_REGION: Record<string, CourierRegion> = {
  [COURIER_SLUGS.BLUE_DART]: 'domestic',
  [COURIER_SLUGS.DELHIVERY]: 'domestic',
  [COURIER_SLUGS.DTDC]: 'domestic',
  [COURIER_SLUGS.ECOM_EXPRESS]: 'domestic',
  [COURIER_SLUGS.INDIA_POST]: 'domestic',
  [COURIER_SLUGS.XPRESSBEES]: 'domestic',
  [COURIER_SLUGS.PROFESSIONAL_COURIERS]: 'domestic',
  [COURIER_SLUGS.EKART]: 'domestic',
  [COURIER_SLUGS.SHADOWFAX]: 'domestic',
  [COURIER_SLUGS.GATI]: 'domestic',
  [COURIER_SLUGS.SAFEEXPRESS]: 'domestic',
  [COURIER_SLUGS.TRACKON]: 'domestic',
  [COURIER_SLUGS.DOTZOT]: 'domestic',
  [COURIER_SLUGS.LOADSHARE]: 'domestic',
  [COURIER_SLUGS.BORZO]: 'domestic',
  [COURIER_SLUGS.DUNZO]: 'domestic',
  [COURIER_SLUGS.SHREE_MARUTI]: 'domestic',
  [COURIER_SLUGS.CRITICALOG]: 'domestic',
  [COURIER_SLUGS.RIVIGO]: 'domestic',
  [COURIER_SLUGS.WOW_EXPRESS]: 'domestic',
  [COURIER_SLUGS.JTEXPRESS]: 'domestic',
  [COURIER_SLUGS.AMAZON_SHIPPING]: 'domestic',
  [COURIER_SLUGS.SHIPROCKET]: 'domestic',
  [COURIER_SLUGS.PICKRR]: 'domestic',

  [COURIER_SLUGS.FEDEX]: 'international',
  [COURIER_SLUGS.UPS]: 'international',
  [COURIER_SLUGS.DHL]: 'international',
  [COURIER_SLUGS.DHL_ECOMMERCE]: 'international',
  [COURIER_SLUGS.ARAMEX]: 'international',
  [COURIER_SLUGS.TNT]: 'international',
  [COURIER_SLUGS.DPD]: 'international',
  [COURIER_SLUGS.EVRI]: 'international',
  [COURIER_SLUGS.SF_EXPRESS]: 'international',

  [COURIER_SLUGS.OTHER]: 'other',

  // Kept for legacy deliveries — not shown in picker
  [COURIER_SLUGS.USPS]: 'legacy',
  [COURIER_SLUGS.CANADA_POST]: 'legacy',
  [COURIER_SLUGS.AUSTRALIA_POST]: 'legacy',
}

const DIGITS_OR_ALNUM: CourierRule = {
  name: 'Courier',
  patterns: [/^[A-Z0-9]{6,40}$/],
  hint: 'Tracking number should be 6–40 letters or digits',
  formats: ['6–40 alphanumeric'],
  examples: ['ABC123456789'],
}

function rule(
  name: string,
  patterns: RegExp[],
  formats: string[],
  examples: string[],
  hint?: string,
): CourierRule {
  return {
    name,
    patterns,
    formats,
    examples,
    hint: hint ?? `${name} tracking number format looks invalid — check the AWB on the label`,
  }
}

export const COURIER_RULES: Record<string, CourierRule> = {
  [COURIER_SLUGS.FEDEX]: rule('FedEx', [/^\d{12}$/, /^\d{14}$/, /^\d{15}$/, /^\d{20}$/, /^\d{22}$/], ['12–22 digits'], ['123456789012']),
  [COURIER_SLUGS.UPS]: rule('UPS', [/^1Z[0-9A-Z]{16}$/, /^\d{12}$/, /^\d{18}$/], ['1Z + 16 chars', '12/18 digits'], ['1Z123E456789012345']),
  [COURIER_SLUGS.USPS]: rule('USPS', [/^\d{20,22}$/, /^[A-Z]{2}\d{9}[A-Z]{2}$/, /^9\d{15,21}$/], ['20–22 digits', 'letter + number'], ['9400111899223344556677']),
  [COURIER_SLUGS.DHL]: rule('DHL Express', [/^\d{10}$/, /^\d{11}$/, /^\d{20}$/, /^[A-Z]{3}\d{7}$/, /^JD\d{18}$/], ['10–11 digits', 'JD + 18 digits'], ['1234567890', 'JD014600009012345678']),
  [COURIER_SLUGS.DHL_ECOMMERCE]: rule('DHL eCommerce', [/^[A-Z0-9]{10,30}$/], ['10–30 alphanumeric'], ['GM123456789012345678']),
  [COURIER_SLUGS.ARAMEX]: rule('Aramex', [/^\d{11}$/, /^\d{12}$/, /^\d{13}$/, /^[A-Z]{2}\d{9}[A-Z]{2}$/], ['11–13 digits'], ['12345678901']),
  [COURIER_SLUGS.TNT]: rule('TNT', [/^\d{9}$/, /^\d{8}$/, /^GD\d{9}$/], ['8–9 digits'], ['123456789']),
  [COURIER_SLUGS.DPD]: rule('DPD', [/^\d{10,14}$/, /^[A-Z]{3}\d{9}$/], ['10–14 digits'], ['12345678901234']),
  [COURIER_SLUGS.EVRI]: rule('Evri / Hermes', [/^\d{16}$/, /^H[A-Z0-9]{15}$/], ['16 digits'], ['1234567890123456']),
  [COURIER_SLUGS.SF_EXPRESS]: rule('SF Express', [/^\d{12}$/, /^\d{15}$/, /^SF\d{13}$/], ['SF + 13 digits', '12/15 digits'], ['SF1234567890123']),
  [COURIER_SLUGS.CANADA_POST]: rule('Canada Post', [/^[A-Z]{2}\d{9}[A-Z]{2}$/, /^\d{16}$/], ['2 letters + 9 digits + 2 letters'], ['EA123456789CA']),
  [COURIER_SLUGS.AUSTRALIA_POST]: rule('Australia Post', [/^[A-Z]{2}\d{9}[A-Z]{2}$/, /^\d{12,13}$/], ['2 letters + 9 digits + 2 letters'], ['ABC123456789AU']),

  [COURIER_SLUGS.BLUE_DART]: rule('Blue Dart', [/^\d{9,12}$/, /^[A-Z]{2}\d{8,10}$/], ['9–12 digits'], ['1234567890']),
  [COURIER_SLUGS.DELHIVERY]: rule('Delhivery', [/^\d{11,14}$/, /^[A-Z]{2}\d{9,12}$/], ['11–14 digits'], ['123456789012']),
  [COURIER_SLUGS.DTDC]: rule('DTDC', [/^\d{9,14}$/, /^[A-Z]{2}\d{8,12}$/, /^[A-Z0-9]{10,20}$/], ['9–14 digits', 'letter + digits'], ['DT1234567890']),
  [COURIER_SLUGS.ECOM_EXPRESS]: rule('Ecom Express', [/^\d{11,15}$/, /^[A-Z]{2}\d{9,12}$/], ['11–15 digits'], ['1234567890123']),
  [COURIER_SLUGS.INDIA_POST]: rule('India Post', [/^[A-Z]{2}\d{9}[A-Z]{2}$/, /^\d{13}$/, /^R[A-Z]\d{9}IN$/], ['2 letters + 9 digits + IN'], ['EA123456789IN']),
  [COURIER_SLUGS.XPRESSBEES]: rule('Xpressbees', [/^\d{11,15}$/, /^[A-Z]{2}\d{9,12}$/], ['11–15 digits'], ['123456789012']),
  [COURIER_SLUGS.PROFESSIONAL_COURIERS]: rule('Professional Couriers', [/^\d{10,14}$/, /^[A-Z]{2}\d{8,12}$/], ['10–14 digits'], ['1234567890']),
  [COURIER_SLUGS.EKART]: rule('Ekart (Flipkart)', [/^[A-Z0-9]{10,30}$/, /^FMPC[A-Z0-9]+$/], ['FMPC… or alphanumeric'], ['FMPC1234567890']),
  [COURIER_SLUGS.SHADOWFAX]: rule('Shadowfax', [/^[A-Z0-9]{8,30}$/], ['8–30 alphanumeric'], ['SF123456789']),
  [COURIER_SLUGS.GATI]: rule('Gati', [/^\d{9,14}$/, /^[A-Z0-9]{8,20}$/], ['9–14 digits'], ['123456789012']),
  [COURIER_SLUGS.SAFEEXPRESS]: rule('Safexpress', [/^\d{9,14}$/, /^[A-Z0-9]{8,20}$/], ['9–14 digits'], ['123456789012']),
  [COURIER_SLUGS.TRACKON]: rule('Trackon', [/^\d{9,14}$/, /^[A-Z0-9]{8,20}$/], ['9–14 digits'], ['123456789012']),
  [COURIER_SLUGS.DOTZOT]: rule('DotZot', [/^[A-Z0-9]{8,30}$/], ['8–30 alphanumeric'], ['DZ123456789']),
  [COURIER_SLUGS.LOADSHARE]: rule('Loadshare', [/^[A-Z0-9]{8,30}$/], ['8–30 alphanumeric'], ['LS123456789']),
  [COURIER_SLUGS.BORZO]: rule('Borzo', [/^[A-Z0-9]{6,30}$/], ['6–30 alphanumeric'], ['BRZ123456789']),
  [COURIER_SLUGS.DUNZO]: rule('Dunzo', [/^[A-Z0-9]{6,30}$/], ['6–30 alphanumeric'], ['DNZ123456789']),
  [COURIER_SLUGS.SHREE_MARUTI]: rule('Shree Maruti Courier', [/^\d{9,14}$/, /^[A-Z0-9]{8,20}$/], ['9–14 digits'], ['1234567890']),
  [COURIER_SLUGS.CRITICALOG]: rule('Criticalog', [/^[A-Z0-9]{8,30}$/], ['8–30 alphanumeric'], ['CL123456789']),
  [COURIER_SLUGS.RIVIGO]: rule('Rivigo', [/^[A-Z0-9]{8,30}$/], ['8–30 alphanumeric'], ['RV123456789']),
  [COURIER_SLUGS.WOW_EXPRESS]: rule('Wow Express', [/^[A-Z0-9]{8,30}$/], ['8–30 alphanumeric'], ['WE123456789']),
  [COURIER_SLUGS.JTEXPRESS]: rule('J&T Express', [/^JT\d{10,15}$/, /^[A-Z0-9]{10,25}$/], ['JT + digits'], ['JT123456789012']),
  [COURIER_SLUGS.AMAZON_SHIPPING]: rule('Amazon Shipping', [/^[A-Z0-9]{10,30}$/], ['10–30 alphanumeric'], ['AMA123456789IN']),

  [COURIER_SLUGS.SHIPROCKET]: rule('Shiprocket', [/^[A-Z0-9]{6,30}$/], ['AWB / shipment ID'], ['SR123456789']),
  [COURIER_SLUGS.PICKRR]: rule('Pickrr', [/^[A-Z0-9]{6,30}$/], ['AWB / tracking ID'], ['PK123456789']),
  [COURIER_SLUGS.OTHER]: rule('Other courier', [/^[A-Z0-9]{6,40}$/], ['6–40 alphanumeric'], ['TRACK123456']),
}

const GENERIC_RULE: CourierRule = DIGITS_OR_ALNUM

function sortByLabel(a: CourierOption, b: CourierOption): number {
  return a.label.localeCompare(b.label)
}

function optionsForRegion(region: CourierRegion): CourierOption[] {
  return Object.entries(COURIER_RULES)
    .filter(([slug]) => COURIER_REGION[slug] === region)
    .map(([value, r]) => ({
      value: value as CourierSlug,
      label: r.name,
      region,
    }))
    .sort(sortByLabel)
}

/** India domestic partners for the vendor picker. */
export const DOMESTIC_COURIER_OPTIONS: CourierOption[] = optionsForRegion('domestic')

/** International partners for the vendor picker. */
export const INTERNATIONAL_COURIER_OPTIONS: CourierOption[] = optionsForRegion('international')

/** Other / unknown courier (always last in the picker). */
export const OTHER_COURIER_OPTION: CourierOption = {
  value: COURIER_SLUGS.OTHER,
  label: COURIER_RULES[COURIER_SLUGS.OTHER].name,
  region: 'other',
}

/** Grouped sections for the Add Tracking picker (excludes legacy foreign posts). */
export const COURIER_OPTIONS_GROUPED: {
  region: Exclude<CourierRegion, 'legacy'>
  title: string
  options: CourierOption[]
}[] = [
  { region: 'domestic', title: 'Domestic (India)', options: DOMESTIC_COURIER_OPTIONS },
  { region: 'international', title: 'International', options: INTERNATIONAL_COURIER_OPTIONS },
  { region: 'other', title: 'Other', options: [OTHER_COURIER_OPTION] },
]

/** Flat picker list (Domestic → International → Other). Prefer COURIER_OPTIONS_GROUPED for UI. */
export const COURIER_OPTIONS: CourierOption[] = [
  ...DOMESTIC_COURIER_OPTIONS,
  ...INTERNATIONAL_COURIER_OPTIONS,
  OTHER_COURIER_OPTION,
]

export function getCourierRegion(courierSlug: string | null | undefined): CourierRegion | null {
  if (!courierSlug) return null
  return COURIER_REGION[courierSlug.toLowerCase()] ?? null
}

export function getCourierName(courierSlug: string | null | undefined): string {
  if (!courierSlug) return ''
  return COURIER_RULES[courierSlug.toLowerCase()]?.name ?? courierSlug
}

export function getTrackingFormat(courierSlug: string | null | undefined): CourierRule {
  if (!courierSlug) return GENERIC_RULE
  return COURIER_RULES[courierSlug.toLowerCase()] ?? GENERIC_RULE
}

export function cleanTrackingNumber(trackingNumber: string | null | undefined): string {
  if (!trackingNumber || typeof trackingNumber !== 'string') return ''
  return trackingNumber.replace(/[\s-]/g, '').toUpperCase()
}

export type TrackingValidationResult = {
  isValid: boolean
  message: string
  suggestions?: string[]
}

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

  const courierRule = COURIER_RULES[courierSlug.toLowerCase()] ?? GENERIC_RULE
  const isValid = courierRule.patterns.some((pattern) => pattern.test(cleanNumber))
  return {
    isValid,
    message: isValid ? `Valid ${courierRule.name} tracking number` : courierRule.hint,
  }
}

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
  if (cleanNumber.length > 40) {
    suggestions.push('Tracking number seems too long. Please check for any extra characters.')
  }
  if (trackingNumber.includes(' ')) suggestions.push('Remove spaces from the tracking number')
  if (trackingNumber.includes('-')) suggestions.push('Remove hyphens from the tracking number')

  const courierRule = courierSlug ? COURIER_RULES[courierSlug.toLowerCase()] : undefined
  if (courierRule) suggestions.push(courierRule.hint)

  return suggestions
}

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
