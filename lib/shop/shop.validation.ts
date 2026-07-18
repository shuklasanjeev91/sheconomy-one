import { z } from 'zod'

import { DEFAULT_COUNTRY } from '~/lib/phone/countries'
import {
  parseE164Phone,
  validateNationalPhone,
} from '~/lib/phone/phone'
import {
  compose,
  email as emailValidator,
  maxLength,
  minLength,
  optionalUrl,
  required,
  type Validator,
} from '~/lib/validation'

import {
  SHOP_VALIDATION,
  SUPPORTED_CURRENCIES,
  type ShopFormData,
  type ShopValidationResult,
} from './shop.type'

// ============= SHARED PRIMITIVES =============

/** Simple but strict-enough email format. */
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
/** URL that must include an http(s) scheme. */
const URL_REGEX = /^https?:\/\/[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+([/?].*)?$/i

const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map((currency) => currency.code)

function isSupportedCurrency(code: string): boolean {
  return SUPPORTED_CURRENCY_CODES.includes(code as (typeof SUPPORTED_CURRENCY_CODES)[number])
}

/** Country-aware phone validation — matches auth sign-in rules (E.164 in storage). */
export function validateShopPhoneNumber(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('+')) {
    const parsed = parseE164Phone(trimmed)
    if (!parsed) {
      return 'Please enter a valid phone number with country code.'
    }
    const result = validateNationalPhone(parsed.nationalNumber, parsed.country)
    return result.ok ? null : result.error
  }

  const result = validateNationalPhone(trimmed, DEFAULT_COUNTRY)
  return result.ok ? null : result.error
}

// ============= FIELD VALIDATORS (for `useFormValidation`) =============
//
// These match the profile migration: pure `(value: string) => string | null`
// validators that plug straight into `useFormValidation` schemas.

export const shopNameValidator: Validator = compose(
  required('Shop name is required.'),
  minLength(
    SHOP_VALIDATION.NAME.MIN_LENGTH,
    `Shop name must be at least ${SHOP_VALIDATION.NAME.MIN_LENGTH} characters long.`,
  ),
  maxLength(
    SHOP_VALIDATION.NAME.MAX_LENGTH,
    `Shop name must be less than ${SHOP_VALIDATION.NAME.MAX_LENGTH} characters.`,
  ),
)

export const shopDescriptionValidator: Validator = maxLength(
  SHOP_VALIDATION.DESCRIPTION.MAX_LENGTH,
  `Description must be less than ${SHOP_VALIDATION.DESCRIPTION.MAX_LENGTH} characters.`,
)

export const shopEmailValidator: Validator = compose(
  emailValidator('Please enter a valid email address (e.g., name@example.com).'),
  maxLength(SHOP_VALIDATION.EMAIL.MAX_LENGTH, 'Email address is too long.'),
)

export const shopPhoneValidator: Validator = (value: string) => validateShopPhoneNumber(value)

export const websiteUrlValidator: Validator = optionalUrl(
  'Please enter a valid URL starting with http:// or https://.',
)

export const shopCurrencyValidator: Validator = (value: string) =>
  !value || isSupportedCurrency(value) ? null : 'Please select a valid currency.'

/** Named lookup so callers can validate a single field generically. */
export const shopFieldValidators: Partial<Record<keyof ShopFormData, Validator>> = {
  shop_name: shopNameValidator,
  shop_description: shopDescriptionValidator,
  shop_email: shopEmailValidator,
  shop_phone_number: shopPhoneValidator,
  website_url: websiteUrlValidator,
  shop_currency: shopCurrencyValidator,
}

/** Validate a single field value. Unknown fields are treated as valid. */
export function validateShopField(
  field: keyof ShopFormData,
  value: unknown,
): { isValid: boolean; error: string | null } {
  const validator = shopFieldValidators[field]
  if (!validator) return { isValid: true, error: null }
  const error = validator(typeof value === 'string' ? value : (value ?? '').toString())
  return { isValid: !error, error }
}

// ============= ZOD SCHEMAS =============

const phoneSchema = z
  .string()
  .trim()
  .superRefine((val, ctx) => {
    if (!val) return
    const error = validateShopPhoneNumber(val)
    if (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error })
    }
  })
  .optional()
  .default('')

const emailSchema = z
  .string()
  .trim()
  .refine(
    (val) => !val || EMAIL_REGEX.test(val.toLowerCase()),
    'Please enter a valid email address.',
  )
  .optional()
  .default('')

const urlSchema = z
  .string()
  .trim()
  .refine((val) => !val || URL_REGEX.test(val), 'Please enter a valid URL (e.g., https://example.com).')
  .optional()
  .default('')

const socialLinksSchema = z
  .record(
    z.string(),
    z
      .string()
      .trim()
      .refine((val) => !val || URL_REGEX.test(val), 'Please enter a valid URL (https://…).'),
  )
  .optional()
  .default({})

/** Full shop create/update payload schema. */
export const shopSchema = z
  .object({
    shop_name: z
      .string()
      .trim()
      .min(
        SHOP_VALIDATION.NAME.MIN_LENGTH,
        `Shop name must be at least ${SHOP_VALIDATION.NAME.MIN_LENGTH} characters long.`,
      )
      .max(
        SHOP_VALIDATION.NAME.MAX_LENGTH,
        `Shop name must be less than ${SHOP_VALIDATION.NAME.MAX_LENGTH} characters.`,
      ),
    shop_description: z
      .string()
      .max(
        SHOP_VALIDATION.DESCRIPTION.MAX_LENGTH,
        `Description must be less than ${SHOP_VALIDATION.DESCRIPTION.MAX_LENGTH} characters.`,
      )
      .optional()
      .default(''),
    shop_phone_number: phoneSchema,
    shop_email: emailSchema,
    website_url: urlSchema,
    shop_categories: z
      .array(z.string().min(1, 'Category name is required.'))
      .max(
        SHOP_VALIDATION.CATEGORIES.MAX_SELECTED,
        `You can select up to ${SHOP_VALIDATION.CATEGORIES.MAX_SELECTED} categories.`,
      )
      .optional()
      .default([]),
    shop_currency: z
      .string()
      .refine(isSupportedCurrency, 'Please select a valid currency.')
      .default(SUPPORTED_CURRENCY_CODES[0]),
    social_links: socialLinksSchema,
    shop_hours: z.record(z.string(), z.string()).optional().default({}),
    shop_metadata: z.record(z.string(), z.unknown()).optional().default({}),
    shop_address_id: z.string().uuid().nullable().optional(),
  })
  .refine((data) => Boolean(data.shop_email || data.shop_phone_number), {
    message: 'Please provide either an email address or phone number.',
    path: ['shop_contact'],
  })

export type ShopSchemaInput = z.input<typeof shopSchema>
export type ShopSchemaOutput = z.output<typeof shopSchema>

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
 * Validate a shop payload with Zod and return the profile-style result shape.
 * Accepts partial data so it can be used for both create and edit flows.
 */
export function validateShopData(data: Partial<ShopFormData>): ShopValidationResult {
  const result = shopSchema.safeParse(data)
  if (result.success) return { isValid: true, errors: {} }
  return { isValid: false, errors: zodErrorToMap(result.error) }
}

/** Alias kept for parity with the legacy `validateCompleteShop` helper. */
export const validateCompleteShop = validateShopData

/**
 * Validate a single step of the multi-step create flow.
 * Returns validity, per-field errors, and whether the step is "complete".
 */
export function validateShopStep(
  stepId: string,
  data: Partial<ShopFormData>,
): { isValid: boolean; errors: Record<string, string>; isComplete: boolean } {
  const errors: Record<string, string> = {}
  let isComplete = false

  const collect = (field: keyof ShopFormData) => {
    const { error } = validateShopField(field, data[field])
    if (error) errors[field] = error
  }

  switch (stepId) {
    case 'basicInfo': {
      collect('shop_name')
      collect('shop_description')
      isComplete =
        Boolean(data.shop_name && data.shop_name.trim().length >= SHOP_VALIDATION.NAME.MIN_LENGTH) &&
        Object.keys(errors).length === 0
      break
    }
    case 'contact': {
      const hasEmail = Boolean(data.shop_email && data.shop_email.trim())
      const hasPhone = Boolean(data.shop_phone_number && data.shop_phone_number.trim())
      if (!hasEmail && !hasPhone) {
        errors.shop_contact = 'Please provide either an email address or phone number.'
      }
      if (hasEmail) collect('shop_email')
      if (hasPhone) collect('shop_phone_number')
      if (data.website_url?.trim()) collect('website_url')
      isComplete = (hasEmail || hasPhone) && Object.keys(errors).length === 0
      break
    }
    case 'categories': {
      collect('shop_categories')
      isComplete = Boolean(data.shop_categories?.length) && Object.keys(errors).length === 0
      break
    }
    case 'currency': {
      collect('shop_currency')
      isComplete = Boolean(data.shop_currency) && Object.keys(errors).length === 0
      break
    }
    case 'socialMedia': {
      if (data.social_links) {
        for (const [platform, urlValue] of Object.entries(data.social_links)) {
          if (urlValue && urlValue.trim()) {
            const { error } = validateShopField('website_url', urlValue)
            if (error) errors[`social_${platform}`] = `${platform}: ${error}`
          }
        }
      }
      isComplete =
        Boolean(
          data.social_links && Object.values(data.social_links).some((val) => val && val.trim()),
        ) && Object.keys(errors).length === 0
      break
    }
    default:
      return { isValid: false, errors: { step: 'Invalid step.' }, isComplete: false }
  }

  return { isValid: Object.keys(errors).length === 0, errors, isComplete }
}

/** Whether the minimum required fields are present to submit a shop. */
export function isShopReadyForSubmission(data: Partial<ShopFormData>): {
  isReady: boolean
  missingFields: string[]
} {
  const requiredFields: (keyof ShopFormData)[] = ['shop_name']
  const missingFields = requiredFields.filter((field) => {
    const value = data[field]
    return !value || (typeof value === 'string' && value.trim() === '')
  })
  return { isReady: missingFields.length === 0, missingFields }
}
