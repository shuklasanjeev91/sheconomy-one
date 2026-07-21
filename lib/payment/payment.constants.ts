/**
 * Vendor payment gateway constants.
 * Migrated from legacy `payment-utils.js` (constants section).
 */

import type { Database } from '~/lib/supabase/database.types'

/** DB-backed payment provider slug (Supabase enum). */
export type PaymentProviderEnum = Database['public']['Enums']['payment_provider_enum']

export type PaymentAccountStatusEnum = Database['public']['Enums']['payment_account_status_enum']

export type PaymentLogEventTypeEnum = Database['public']['Enums']['payment_log_event_type_enum']

export type PaymentLogStatusEnum = Database['public']['Enums']['payment_log_status_enum']

export const CONNECTION_TYPES = {
  OAUTH: 'oauth',
  CREDENTIAL: 'credential',
  MANUAL: 'manual',
} as const

export type ConnectionType = (typeof CONNECTION_TYPES)[keyof typeof CONNECTION_TYPES]

/** Vendor UI feature flag for OAuth provider visibility. */
export const SHOW_OAUTH_IN_VENDOR_UI =
  (typeof process !== 'undefined'
    ? process.env.EXPO_PUBLIC_SHOW_OAUTH_PROVIDERS ?? process.env.NEXT_PUBLIC_SHOW_OAUTH_PROVIDERS
    : undefined) === 'true'

export const PAYMENT_REGIONS = {
  GLOBAL: 'global',
  INDIA: 'india',
  AFRICA: 'africa',
  MIDDLE_EAST: 'middle_east',
  SOUTHEAST_ASIA: 'southeast_asia',
  EUROPE: 'europe',
  NEPAL: 'nepal',
  BANGLADESH: 'bangladesh',
  TURKEY: 'turkey',
  LATIN_AMERICA: 'latin_america',
} as const

export type PaymentRegion = (typeof PAYMENT_REGIONS)[keyof typeof PAYMENT_REGIONS]

/** Application-level provider ids (catalog superset; may exceed DB enum). */
export const PAYMENT_PROVIDERS = {
  SHECONOMYPAY: 'sheconomypay',
  RAZORPAY: 'razorpay',
  PAYPAL: 'paypal',
  STRIPE: 'stripe',
  PAYU: 'payu',
  CASHFREE: 'cashfree',
  PHONEPE: 'phonepe',
  PAYTM: 'paytm',
  EASEBUZZ: 'easebuzz',
  INSTAMOJO: 'instamojo',
  PAYSTACK: 'paystack',
  FLUTTERWAVE: 'flutterwave',
  PAYFAST: 'payfast',
  PAYNOW: 'paynow',
  DPO_PAY: 'dpo_pay',
  OZOW: 'ozow',
  CINETPAY: 'cinetpay',
  FEDAPAY: 'fedapay',
  PAYTABS: 'paytabs',
  TAP: 'tap',
  BENEFIT: 'benefit',
  MYFATOORAH: 'myfatoorah',
  TELR: 'telr',
  MIDTRANS: 'midtrans',
  XENDIT: 'xendit',
  TOYYIBPAY: 'toyyibpay',
  SENANGPAY: 'senangpay',
  BILLPLZ: 'billplz',
  MOLLIE: 'mollie',
  SOFORT: 'sofort',
  KLARNA: 'klarna',
  BRAINTREE: 'braintree',
  AUTHORIZE_NET: 'authorize_net',
  PADDLE: 'paddle',
  SKRILL: 'skrill',
  COINGATE: 'coingate',
  PAYMENTWALL: 'paymentwall',
  KHALTI: 'khalti',
  ESEWA: 'esewa',
  AAMARPAY: 'aamarpay',
  SSLCOMMERZ: 'sslcommerz',
  PAYTR: 'paytr',
  IYZIPAY: 'iyzipay',
  COD: 'cod',
  BANK_TRANSFER: 'bank_transfer',
  GOOGLEPAY: 'googlepay',
} as const

export type PaymentProviderId = (typeof PAYMENT_PROVIDERS)[keyof typeof PAYMENT_PROVIDERS]

export const PAYMENT_EVENT_TYPES = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  REFUND: 'refund',
  WEBHOOK: 'webhook',
  CAPTURE: 'capture',
  AUTHORIZATION: 'authorization',
  SETTLEMENT: 'settlement',
  CHARGEBACK: 'chargeback',
  DISPUTE: 'dispute',
} as const

export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[keyof typeof PAYMENT_EVENT_TYPES]

export const PAYMENT_STATUS_TYPES = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  PENDING: 'pending',
  PROCESSING: 'processing',
  CANCELLED: 'cancelled',
} as const

export type PaymentStatusType = (typeof PAYMENT_STATUS_TYPES)[keyof typeof PAYMENT_STATUS_TYPES]

export const PAYMENT_ACCOUNT_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  PENDING: 'pending',
  SUSPENDED: 'suspended',
  EXPIRED: 'expired',
} as const

export type PaymentAccountStatus =
  (typeof PAYMENT_ACCOUNT_STATUS)[keyof typeof PAYMENT_ACCOUNT_STATUS]

export const SETTLEMENT_SCHEDULES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const

export type SettlementSchedule =
  (typeof SETTLEMENT_SCHEDULES)[keyof typeof SETTLEMENT_SCHEDULES]

export const SUPPORTED_CURRENCIES = {
  INR: { name: 'Indian Rupee', symbol: '₹', code: 'INR' },
  USD: { name: 'US Dollar', symbol: '$', code: 'USD' },
  EUR: { name: 'Euro', symbol: '€', code: 'EUR' },
  GBP: { name: 'British Pound', symbol: '£', code: 'GBP' },
  AUD: { name: 'Australian Dollar', symbol: 'A$', code: 'AUD' },
  CAD: { name: 'Canadian Dollar', symbol: 'C$', code: 'CAD' },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', code: 'SGD' },
  JPY: { name: 'Japanese Yen', symbol: '¥', code: 'JPY' },
  ZAR: { name: 'South African Rand', symbol: 'R', code: 'ZAR' },
  NGN: { name: 'Nigerian Naira', symbol: '₦', code: 'NGN' },
  KES: { name: 'Kenyan Shilling', symbol: 'KSh', code: 'KES' },
  GHS: { name: 'Ghanaian Cedi', symbol: '₵', code: 'GHS' },
  AED: { name: 'UAE Dirham', symbol: 'د.إ', code: 'AED' },
  SAR: { name: 'Saudi Riyal', symbol: 'ر.س', code: 'SAR' },
  BHD: { name: 'Bahraini Dinar', symbol: 'BD', code: 'BHD' },
  KWD: { name: 'Kuwaiti Dinar', symbol: 'د.ك', code: 'KWD' },
  MYR: { name: 'Malaysian Ringgit', symbol: 'RM', code: 'MYR' },
  IDR: { name: 'Indonesian Rupiah', symbol: 'Rp', code: 'IDR' },
  PHP: { name: 'Philippine Peso', symbol: '₱', code: 'PHP' },
  THB: { name: 'Thai Baht', symbol: '฿', code: 'THB' },
  VND: { name: 'Vietnamese Dong', symbol: '₫', code: 'VND' },
  NPR: { name: 'Nepalese Rupee', symbol: 'रू', code: 'NPR' },
  BDT: { name: 'Bangladeshi Taka', symbol: '৳', code: 'BDT' },
  LKR: { name: 'Sri Lankan Rupee', symbol: 'Rs', code: 'LKR' },
  PKR: { name: 'Pakistani Rupee', symbol: '₨', code: 'PKR' },
  CHF: { name: 'Swiss Franc', symbol: 'CHF', code: 'CHF' },
  SEK: { name: 'Swedish Krona', symbol: 'kr', code: 'SEK' },
  NOK: { name: 'Norwegian Krone', symbol: 'kr', code: 'NOK' },
  DKK: { name: 'Danish Krone', symbol: 'kr', code: 'DKK' },
  PLN: { name: 'Polish Zloty', symbol: 'zł', code: 'PLN' },
  TRY: { name: 'Turkish Lira', symbol: '₺', code: 'TRY' },
  BRL: { name: 'Brazilian Real', symbol: 'R$', code: 'BRL' },
  MXN: { name: 'Mexican Peso', symbol: '$', code: 'MXN' },
  CLP: { name: 'Chilean Peso', symbol: '$', code: 'CLP' },
  COP: { name: 'Colombian Peso', symbol: '$', code: 'COP' },
  ARS: { name: 'Argentine Peso', symbol: '$', code: 'ARS' },
} as const

export type SupportedCurrencyCode = keyof typeof SUPPORTED_CURRENCIES

/** Map catalog provider ids → Supabase enum where they differ. */
export const PAYMENT_PROVIDER_DB_ALIASES: Partial<Record<PaymentProviderId, PaymentProviderEnum>> = {
  [PAYMENT_PROVIDERS.AUTHORIZE_NET]: 'authorizenet',
  [PAYMENT_PROVIDERS.DPO_PAY]: 'dpo',
  [PAYMENT_PROVIDERS.FEDAPAY]: 'fedpay',
  [PAYMENT_PROVIDERS.SENANGPAY]: 'senagepay',
  [PAYMENT_PROVIDERS.SSLCOMMERZ]: 'sslcommerz',
  [PAYMENT_PROVIDERS.GOOGLEPAY]: 'googlepay',
}

/** Providers in the catalog that are not yet on the DB enum (connect will fail until migrated). */
export const CATALOG_ONLY_PAYMENT_PROVIDERS = new Set<PaymentProviderId>([
  PAYMENT_PROVIDERS.SHECONOMYPAY,
  PAYMENT_PROVIDERS.COD,
  PAYMENT_PROVIDERS.BANK_TRANSFER,
  PAYMENT_PROVIDERS.INSTAMOJO,
  PAYMENT_PROVIDERS.KLARNA,
  PAYMENT_PROVIDERS.BILLPLZ,
  PAYMENT_PROVIDERS.TELR,
])

export const PAYMENT_LOG_DEFAULT_LIMIT = 50

export const PAYMENT_LOG_MAX_LIMIT = 100

export const PAYMENT_ANALYTICS_DEFAULT_DAYS = 30

export const PAYMENT_CREDENTIAL_DEFAULT_MODE = 'sandbox' as const

export type PaymentCredentialMode = 'sandbox' | 'live' | 'test' | 'prod' | 'production' | 'playground'

export const DEFAULT_VENDOR_PAYMENT_SETTINGS = {
  accepts_international: false,
  settlement_currency: 'INR',
  fx_markup_percent: 0,
  auto_settlement: true,
  settlement_schedule: SETTLEMENT_SCHEDULES.DAILY,
  minimum_settlement_amount: 100,
  webhook_url: null as string | null,
  webhook_secret: null as string | null,
  is_live_mode: false,
} as const

export const PAYMENT_FX_MARKUP = { MIN: 0, MAX: 10 } as const

export const PAYMENT_SETTLEMENT_CURRENCY_LENGTH = 3
