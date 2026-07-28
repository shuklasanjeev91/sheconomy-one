import { z } from 'zod'

import {
  DEFAULT_VENDOR_PAYMENT_SETTINGS,
  PAYMENT_FX_MARKUP,
  PAYMENT_LOG_MAX_LIMIT,
  PAYMENT_PROVIDERS,
  PAYMENT_SETTLEMENT_CURRENCY_LENGTH,
  SETTLEMENT_SCHEDULES,
  SUPPORTED_CURRENCIES,
  type PaymentProviderId,
} from '~/lib/payment/payment.constants'
import { PROVIDER_CREDENTIAL_FIELDS } from '~/lib/payment/payment.providers.config'
import type {
  PaymentSettingsInput,
  PaymentValidationResult,
  ProviderCredentialsValidationResult,
} from '~/lib/payment/payment.type'

const settlementScheduleSchema = z.enum([
  SETTLEMENT_SCHEDULES.DAILY,
  SETTLEMENT_SCHEDULES.WEEKLY,
  SETTLEMENT_SCHEDULES.MONTHLY,
])

const supportedCurrencyCodes = Object.keys(SUPPORTED_CURRENCIES) as [string, ...string[]]

export const paymentSettingsSchema = z.object({
  accepts_international: z.boolean().optional(),
  settlement_currency: z
    .string()
    .trim()
    .length(
      PAYMENT_SETTLEMENT_CURRENCY_LENGTH,
      `Settlement currency must be a ${PAYMENT_SETTLEMENT_CURRENCY_LENGTH}-character code (e.g. INR, USD).`,
    )
    .transform((value) => value.toUpperCase())
    .refine((value) => supportedCurrencyCodes.includes(value), 'Settlement currency is not supported.')
    .optional(),
  fx_markup_percent: z
    .number()
    .min(PAYMENT_FX_MARKUP.MIN, `FX markup must be at least ${PAYMENT_FX_MARKUP.MIN}%.`)
    .max(PAYMENT_FX_MARKUP.MAX, `FX markup cannot exceed ${PAYMENT_FX_MARKUP.MAX}%.`)
    .optional(),
  auto_settlement: z.boolean().optional(),
  settlement_schedule: settlementScheduleSchema.optional(),
  minimum_settlement_amount: z
    .number()
    .min(0, 'Minimum settlement amount must be zero or greater.')
    .optional(),
  webhook_url: z
    .string()
    .trim()
    .refine(
      (url) => {
        try {
          new URL(url)
          return true
        } catch {
          return false
        }
      },
      'Webhook URL must be a valid URL (e.g. https://your-domain.com/webhooks).',
    )
    .refine(
      (url) => url.startsWith('https://'),
      'Webhook URL must start with https:// (two slashes after the colon).',
    )
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  webhook_secret: z.string().nullable().optional(),
  is_live_mode: z.boolean().optional(),
})

export const connectPaymentAccountSchema = z.object({
  shopId: z.string().uuid('A valid shop is required.'),
  provider: z.string().min(1, 'Payment provider is required.'),
  merchantId: z.string().trim().min(1, 'Merchant ID is required.'),
})

export const savePaymentCredentialsSchema = z.object({
  shopId: z.string().uuid('A valid shop is required.'),
  provider: z.string().min(1, 'Payment provider is required.'),
  credentials: z.record(z.string(), z.string()),
  mode: z.string().optional(),
})

export function validatePaymentSettings(input: PaymentSettingsInput): PaymentValidationResult {
  const result = paymentSettingsSchema.safeParse(input)
  if (result.success) return { isValid: true, errors: {} }

  const errors: Record<string, string> = {}
  result.error.issues.forEach((issue) => {
    const key = issue.path.join('.') || 'settings'
    if (!errors[key]) errors[key] = issue.message
  })
  return { isValid: false, errors }
}

export function normalizePaymentSettingsPatch(input: PaymentSettingsInput): PaymentSettingsInput {
  const result = paymentSettingsSchema.safeParse(input)
  if (result.success) return result.data
  return input
}

export function validateProviderCredentials(
  providerId: PaymentProviderId | string,
  credentials: Record<string, string> = {},
): ProviderCredentialsValidationResult {
  const config = PROVIDER_CREDENTIAL_FIELDS[providerId as PaymentProviderId]
  if (!config) return { valid: true, errors: [] }

  const errors: string[] = []
  config.fields.forEach((field) => {
    if (field.required && !credentials[field.key]?.trim()) {
      errors.push(`${field.label} is required`)
    }
  })

  return { valid: errors.length === 0, errors }
}

/** Field-level credential validation for connect forms. */
export function validateProviderCredentialForm(
  providerId: PaymentProviderId | string,
  credentials: Record<string, string> = {},
): PaymentValidationResult {
  const config = PROVIDER_CREDENTIAL_FIELDS[providerId as PaymentProviderId]
  if (!config) return { isValid: true, errors: {} }

  const errors: Record<string, string> = {}
  config.fields.forEach((field) => {
    if (field.required && !credentials[field.key]?.trim()) {
      errors[field.key] = `${field.label} is required`
    }
  })

  if (credentials.webhook_url?.trim()) {
    const webhookResult = paymentSettingsSchema.safeParse({ webhook_url: credentials.webhook_url })
    if (!webhookResult.success) {
      const issue = webhookResult.error.issues.find((row) => row.path.includes('webhook_url'))
      if (issue) errors.webhook_url = issue.message
    }
  }

  return { isValid: Object.keys(errors).length === 0, errors }
}

export function isValidPaymentProvider(provider: unknown): provider is PaymentProviderId {
  if (typeof provider !== 'string') return false
  return Object.values(PAYMENT_PROVIDERS).includes(provider.toLowerCase() as PaymentProviderId)
}

export function buildDefaultPaymentSettings(shopId: string) {
  return {
    shop_id: shopId,
    ...DEFAULT_VENDOR_PAYMENT_SETTINGS,
  }
}
