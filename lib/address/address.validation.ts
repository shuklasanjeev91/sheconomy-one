import { getDefaultCountryCode, resolveCountryCode, validatePostalCode } from '~/lib/geo'
import {
  compose,
  maxLength,
  minLength,
  required,
  type Validator,
} from '~/lib/validation'

import {
  ADDRESS_TYPE,
  ADDRESS_TYPES,
  ADDRESS_VALIDATION,
  type AddressFormData,
  type AddressInput,
  type AddressType,
  type AddressValidationResult,
} from './address.type'
import { z } from '~/lib/zod'

// ============= ZOD SCHEMA =============

export const addressFormSchema = z.object({
  address_line_1: z
    .string()
    .trim()
    .min(ADDRESS_VALIDATION.ADDRESS_LINE_1.MIN_LENGTH, 'Enter a valid street address.')
    .max(
      ADDRESS_VALIDATION.ADDRESS_LINE_1.MAX_LENGTH,
      `Address line 1 must be ${ADDRESS_VALIDATION.ADDRESS_LINE_1.MAX_LENGTH} characters or less.`,
    ),
  address_line_2: z
    .string()
    .max(
      ADDRESS_VALIDATION.ADDRESS_LINE_2.MAX_LENGTH,
      `Address line 2 must be ${ADDRESS_VALIDATION.ADDRESS_LINE_2.MAX_LENGTH} characters or less.`,
    )
    .optional()
    .or(z.literal('')),
  city: z
    .string()
    .trim()
    .min(ADDRESS_VALIDATION.CITY.MIN_LENGTH, 'Enter a valid city.')
    .max(
      ADDRESS_VALIDATION.CITY.MAX_LENGTH,
      `City must be ${ADDRESS_VALIDATION.CITY.MAX_LENGTH} characters or less.`,
    ),
  state: z
    .string()
    .trim()
    .min(ADDRESS_VALIDATION.STATE.MIN_LENGTH, 'Select or enter a valid state or region.')
    .max(
      ADDRESS_VALIDATION.STATE.MAX_LENGTH,
      `State must be ${ADDRESS_VALIDATION.STATE.MAX_LENGTH} characters or less.`,
    ),
  postal_code: z
    .string()
    .trim()
    .min(ADDRESS_VALIDATION.POSTAL_CODE.MIN_LENGTH, 'Enter a valid postal code.')
    .max(
      ADDRESS_VALIDATION.POSTAL_CODE.MAX_LENGTH,
      `Postal code must be ${ADDRESS_VALIDATION.POSTAL_CODE.MAX_LENGTH} characters or less.`,
    ),
  country: z.string().default(getDefaultCountryCode()),
  address_type: z.enum(ADDRESS_TYPES as unknown as [AddressType, ...AddressType[]]).default(ADDRESS_TYPE.HOME),
  is_default: z.boolean().default(false),
  address_label: z
    .string()
    .max(
      ADDRESS_VALIDATION.ADDRESS_LABEL.MAX_LENGTH,
      `Address label must be ${ADDRESS_VALIDATION.ADDRESS_LABEL.MAX_LENGTH} characters or less.`,
    )
    .optional()
    .or(z.literal('')),
})

// ============= FIELD VALIDATORS (for `useFormValidation`) =============

export const addressLine1Validator: Validator = compose(
  required('Enter a street address.'),
  minLength(
    ADDRESS_VALIDATION.ADDRESS_LINE_1.MIN_LENGTH,
    'Enter a valid street address (at least 3 characters).',
  ),
  maxLength(
    ADDRESS_VALIDATION.ADDRESS_LINE_1.MAX_LENGTH,
    `Address line 1 must be ${ADDRESS_VALIDATION.ADDRESS_LINE_1.MAX_LENGTH} characters or less.`,
  ),
)

export const cityValidator: Validator = compose(
  required('Enter a city.'),
  minLength(ADDRESS_VALIDATION.CITY.MIN_LENGTH, 'Enter a valid city.'),
  maxLength(
    ADDRESS_VALIDATION.CITY.MAX_LENGTH,
    `City must be ${ADDRESS_VALIDATION.CITY.MAX_LENGTH} characters or less.`,
  ),
)

export const stateValidator: Validator = compose(
  required('Select or enter a state or region.'),
  minLength(ADDRESS_VALIDATION.STATE.MIN_LENGTH, 'Enter a valid state or region.'),
  maxLength(
    ADDRESS_VALIDATION.STATE.MAX_LENGTH,
    `State must be ${ADDRESS_VALIDATION.STATE.MAX_LENGTH} characters or less.`,
  ),
)

// ============= FULL-OBJECT VALIDATION =============

function postalCodeError(country: string, postalCode: string): string | null {
  return validatePostalCode(resolveCountryCode(country), postalCode)
}

/** Validate a full address form and return field-level errors. */
export function validateAddressData(data: AddressFormData | AddressInput): AddressValidationResult {
  const parsed = addressFormSchema.safeParse(data)
  if (!parsed.success) {
    const errors: AddressValidationResult['errors'] = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof AddressFormData
      if (!errors[field]) errors[field] = issue.message
    }
    return { isValid: false, errors }
  }

  const postalError = postalCodeError(parsed.data.country, parsed.data.postal_code)
  if (postalError) {
    return { isValid: false, errors: { postal_code: postalError } }
  }

  return { isValid: true, errors: {} }
}

/** Validate a single field (used for live blur validation in drawers). */
export function validateAddressField(
  field: keyof AddressFormData,
  value: string,
  country?: string,
): { isValid: boolean; error: string | null } {
  try {
    const fieldSchema = addressFormSchema.pick({ [field]: true } as Record<keyof AddressFormData, true>)
    fieldSchema.parse({ [field]: value })

    if (field === 'postal_code' && country) {
      const postalError = postalCodeError(country, value)
      if (postalError) return { isValid: false, error: postalError }
    }

    return { isValid: true, error: null }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.issues[0]?.message ?? 'Invalid value.' }
    }
    return { isValid: false, error: 'Validation failed.' }
  }
}

/** Normalise validated form data into a service-ready payload. */
export function normalizeAddressInput(data: AddressFormData | AddressInput): AddressInput {
  const validated = addressFormSchema.parse(data)
  return {
    address_line_1: validated.address_line_1.trim(),
    address_line_2: validated.address_line_2?.trim() || null,
    city: validated.city.trim(),
    state: validated.state.trim(),
    postal_code: validated.postal_code.replace(/\s/g, ''),
    country: resolveCountryCode(validated.country),
    address_type: validated.address_type as AddressInput['address_type'],
    is_default: validated.is_default,
    address_label: validated.address_label?.trim() || null,
    latitude: 'latitude' in data ? (data.latitude ?? null) : null,
    longitude: 'longitude' in data ? (data.longitude ?? null) : null,
    place_id: 'place_id' in data ? (data.place_id ?? null) : null,
    source: 'source' in data ? (data.source ?? 'manual') : 'manual',
  }
}
