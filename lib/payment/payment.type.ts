/**
 * Types for vendor payment gateway setup (accounts, settings, logs).
 *
 * Distinct from `lib/orders/payment.type.ts` which covers checkout `order_payments`.
 */

import type { Database, Json } from '~/lib/supabase/database.types'

import type {
  ConnectionType,
  PaymentAccountStatus,
  PaymentCredentialMode,
  PaymentEventType,
  PaymentProviderId,
  PaymentRegion,
  PaymentStatusType,
  SettlementSchedule,
  SupportedCurrencyCode,
} from '~/lib/payment/payment.constants'

// ============= DB ROW TYPES =============

export type ShopPaymentAccount = Database['public']['Tables']['shop_payment_accounts']['Row']

export type ShopPaymentAccountInsert = Database['public']['Tables']['shop_payment_accounts']['Insert']

export type ShopPaymentAccountUpdate = Database['public']['Tables']['shop_payment_accounts']['Update']

export type VendorPaymentSettings = Database['public']['Tables']['vendor_payment_settings']['Row']

export type VendorPaymentSettingsInsert = Database['public']['Tables']['vendor_payment_settings']['Insert']

export type VendorPaymentSettingsUpdate = Database['public']['Tables']['vendor_payment_settings']['Update']

export type PaymentLog = Database['public']['Tables']['payment_logs']['Row']

export type PaymentWebhook = Database['public']['Tables']['payment_webhooks']['Row']

// ============= SERVICE ENVELOPE =============

export type PaymentServiceResponse<T> = {
  success: boolean
  data: T | null
  error: string | null
}

// ============= DOMAIN TYPES =============

export type PaymentAccountMetadata = {
  connection_type?: ConnectionType | 'credential' | 'oauth' | 'manual'
  mode?: PaymentCredentialMode | string
  credentials?: string
  configured_at?: string
  [key: string]: Json | undefined
}

export type ConnectedProviderSummary = {
  provider: PaymentProviderId
  connectedAt: string | null
}

export type PaymentSetupStatus = {
  hasPaymentAccount: boolean
  activeProviders: string[]
  settingsConfigured: boolean
  isFullySetup: boolean
}

export type PaymentOAuthTokens = {
  accessToken?: string | null
  refreshToken?: string | null
  expiresAt?: string | null
  metadata?: Record<string, unknown>
}

export type SavePaymentCredentialsInput = {
  shopId: string
  provider: PaymentProviderId
  credentials: Record<string, string>
  mode?: PaymentCredentialMode | string
}

export type ConnectPaymentAccountInput = {
  shopId: string
  provider: PaymentProviderId
  merchantId: string
  tokens?: PaymentOAuthTokens
}

export type PaymentSettingsInput = Partial<{
  accepts_international: boolean
  settlement_currency: SupportedCurrencyCode | string
  fx_markup_percent: number
  auto_settlement: boolean
  settlement_schedule: SettlementSchedule | string
  minimum_settlement_amount: number
  webhook_url: string | null
  webhook_secret: string | null
  is_live_mode: boolean
}>

export type PaymentLogFilters = {
  eventType?: PaymentEventType | null
  status?: PaymentStatusType | null
  provider?: PaymentProviderId | null
  dateFrom?: string | null
  dateTo?: string | null
  limit?: number
  offset?: number
}

export type PaymentLogsPage = {
  logs: PaymentLog[]
  totalCount: number | null
  hasMore: boolean
}

export type PaymentAnalyticsTimeRange = {
  dateFrom?: string
  dateTo?: string
}

export type PaymentAnalytics = {
  totalTransactions: number
  successfulTransactions: number
  failedTransactions: number
  totalAmount: number
  successRate: number
  byProvider: Record<string, { count: number; amount: number }>
  byEventType: Record<string, number>
  byStatus: Record<string, number>
  timeline: Record<string, { count: number; amount: number }>
}

export type LogPaymentEventInput = {
  orderPaymentId?: string | null
  eventType: PaymentEventType
  status: PaymentStatusType
  payload?: Record<string, unknown>
  shopId?: string | null
  provider?: PaymentProviderId | null
  transactionId?: string | null
  amount?: number | null
  currency?: SupportedCurrencyCode | string | null
  errorCode?: string | null
  errorMessage?: string | null
}

export type PaymentCredentialFieldType = 'text' | 'password' | 'email' | 'textarea' | 'select'

export type PaymentCredentialFieldOption = {
  value: string
  label: string
}

export type PaymentCredentialField = {
  key: string
  label: string
  type: PaymentCredentialFieldType
  required?: boolean
  placeholder?: string
  defaultValue?: string
  options?: PaymentCredentialFieldOption[]
}

export type PaymentCredentialFieldConfig = {
  fields: PaymentCredentialField[]
  modeOptions?: Record<string, string>
  helpUrl?: string
  noModeSelector?: boolean
}

export type PaymentProviderConfig = {
  id: PaymentProviderId
  name: string
  description: string
  logo: string
  bgColor: string
  textColor: string
  buttonColor: string
  color: string
  website: string | null
  dashboardUrl: string | null
  features: string[]
  processingTime: string
  fees: string
  isOAuth: boolean
  connectionType: ConnectionType
  isActive: boolean
  isDefault: boolean
  region: PaymentRegion
  supportedCurrencies: string[]
  specialBenefits?: string[]
  pricing?: Record<string, string>
  specialNote?: string
}

export type PaymentCredentialsResult = {
  provider: PaymentProviderId
  credentials: Record<string, string> | null
  mode: string
  status: PaymentAccountStatus | null
  connectedAt: string | null
}

export type PaymentValidationResult = {
  isValid: boolean
  errors: Record<string, string>
}

export type ProviderCredentialsValidationResult = {
  valid: boolean
  errors: string[]
}

export type PaymentFilterOption = {
  value: string
  label: string
  description?: string
}

export type CurrencyOption = {
  code: SupportedCurrencyCode | string
  name: string
  symbol: string
}

export type SettlementScheduleOption = {
  value: SettlementSchedule
  label: string
  description: string
}
