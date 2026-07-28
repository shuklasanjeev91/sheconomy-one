/**
 * Vendor payment gateway utilities.
 * Migrated from legacy `payment-utils.js` helper functions.
 */

import {
  CATALOG_ONLY_PAYMENT_PROVIDERS,
  CONNECTION_TYPES,
  PAYMENT_ACCOUNT_STATUS,
  PAYMENT_CREDENTIAL_DEFAULT_MODE,
  PAYMENT_EVENT_TYPES,
  PAYMENT_PROVIDER_DB_ALIASES,
  PAYMENT_PROVIDERS,
  PAYMENT_REGIONS,
  PAYMENT_STATUS_TYPES,
  SETTLEMENT_SCHEDULES,
  SHOW_OAUTH_IN_VENDOR_UI,
  SUPPORTED_CURRENCIES,
  type ConnectionType,
  type PaymentAccountStatus,
  type PaymentProviderEnum,
  type PaymentProviderId,
  type PaymentRegion,
  type SupportedCurrencyCode,
} from '~/lib/payment/payment.constants'
import { PAYMENT_PROVIDERS_CONFIG, PROVIDER_CREDENTIAL_FIELDS } from '~/lib/payment/payment.providers.config'
import { PAYMENT_CONNECTION_TYPE_LABELS, PAYMENT_PROVIDER_BADGE_LABELS, PAYMENT_UI_COPY } from '~/lib/payment/payment-ui.copy'
import type {
  ConnectedProviderSummary,
  PaymentAnalytics,
  PaymentProviderConfig,
  PaymentSetupStatus,
  ShopPaymentAccount,
} from '~/lib/payment/payment.type'

export function normalizeProviderId(provider: string): PaymentProviderId {
  return provider.trim().toLowerCase() as PaymentProviderId
}

/** Resolve catalog id to Supabase enum value when persisting. */
export function resolveProviderForDatabase(provider: PaymentProviderId): PaymentProviderEnum | null {
  if (CATALOG_ONLY_PAYMENT_PROVIDERS.has(provider)) return null
  const alias = PAYMENT_PROVIDER_DB_ALIASES[provider]
  if (alias) return alias
  return provider as PaymentProviderEnum
}

export function getProviderConfig(providerId: PaymentProviderId | string): PaymentProviderConfig {
  const id = normalizeProviderId(providerId)
  return (
    PAYMENT_PROVIDERS_CONFIG.find((provider) => provider.id === id) ??
    PAYMENT_PROVIDERS_CONFIG.find((provider) => provider.isDefault) ??
    PAYMENT_PROVIDERS_CONFIG[0]
  )
}

export function getDefaultProvider(): PaymentProviderConfig {
  return (
    PAYMENT_PROVIDERS_CONFIG.find((provider) => provider.isDefault) ?? PAYMENT_PROVIDERS_CONFIG[0]
  )
}

export function getActiveProviders(): PaymentProviderConfig[] {
  return PAYMENT_PROVIDERS_CONFIG.filter((provider) => provider.isActive)
}

export function getOAuthProviders(): PaymentProviderConfig[] {
  return PAYMENT_PROVIDERS_CONFIG.filter((provider) => provider.isOAuth)
}

export function getCredentialProviders(): PaymentProviderConfig[] {
  return PAYMENT_PROVIDERS_CONFIG.filter(
    (provider) => provider.connectionType === CONNECTION_TYPES.CREDENTIAL && provider.isActive,
  )
}

export function getManualProviders(): PaymentProviderConfig[] {
  return PAYMENT_PROVIDERS_CONFIG.filter(
    (provider) => provider.connectionType === CONNECTION_TYPES.MANUAL && provider.isActive,
  )
}

export function isFrontendVisibleProvider(provider: PaymentProviderConfig | null | undefined): boolean {
  if (!provider || provider.isActive === false) return false

  const connectionType =
    provider.connectionType ??
    (provider.isOAuth ? CONNECTION_TYPES.OAUTH : CONNECTION_TYPES.CREDENTIAL)

  if (SHOW_OAUTH_IN_VENDOR_UI) return true
  return connectionType !== CONNECTION_TYPES.OAUTH
}

export function getFrontendVisibleProviders(): PaymentProviderConfig[] {
  return PAYMENT_PROVIDERS_CONFIG.filter((provider) => isFrontendVisibleProvider(provider))
}

export function getProvidersByRegion(region: PaymentRegion | string): PaymentProviderConfig[] {
  if (!region) return []
  return PAYMENT_PROVIDERS_CONFIG.filter(
    (provider) => provider.region === region && provider.isActive,
  )
}

export function getFrontendVisibleProvidersByRegion(region: PaymentRegion | string): PaymentProviderConfig[] {
  return getProvidersByRegion(region).filter((provider) => isFrontendVisibleProvider(provider))
}

export function getActiveRegions(): Array<{ region: PaymentRegion; count: number; providers: PaymentProviderId[] }> {
  const regionMap = new Map<PaymentRegion, { region: PaymentRegion; count: number; providers: PaymentProviderId[] }>()

  PAYMENT_PROVIDERS_CONFIG.filter((provider) => provider.isActive).forEach((provider) => {
    const region = provider.region ?? PAYMENT_REGIONS.GLOBAL
    if (!regionMap.has(region)) {
      regionMap.set(region, { region, count: 0, providers: [] })
    }
    const entry = regionMap.get(region)!
    entry.count += 1
    entry.providers.push(provider.id)
  })

  return Array.from(regionMap.values()).sort((a, b) => b.count - a.count)
}

export function getProviderCredentialFields(providerId: PaymentProviderId | string) {
  return PROVIDER_CREDENTIAL_FIELDS[normalizeProviderId(providerId)] ?? null
}

export function isCredentialProvider(providerId: PaymentProviderId | string): boolean {
  return getProviderConfig(providerId).connectionType === CONNECTION_TYPES.CREDENTIAL
}

export function isManualProvider(providerId: PaymentProviderId | string): boolean {
  return getProviderConfig(providerId).connectionType === CONNECTION_TYPES.MANUAL
}

export function isOAuthProvider(
  provider: PaymentProviderId | string | PaymentProviderConfig,
): boolean {
  const config =
    typeof provider === 'object' && provider !== null && 'connectionType' in provider
      ? provider
      : getProviderConfig(provider)
  return config.connectionType === CONNECTION_TYPES.OAUTH || config.isOAuth
}

export function isDefaultProvider(providerId: PaymentProviderId | string): boolean {
  return getProviderConfig(providerId).isDefault
}

export function getProvidersGroupedByConnectionType() {
  return {
    oauth: PAYMENT_PROVIDERS_CONFIG.filter(
      (provider) => provider.connectionType === CONNECTION_TYPES.OAUTH && provider.isActive,
    ),
    credential: PAYMENT_PROVIDERS_CONFIG.filter(
      (provider) => provider.connectionType === CONNECTION_TYPES.CREDENTIAL && provider.isActive,
    ),
    manual: PAYMENT_PROVIDERS_CONFIG.filter(
      (provider) => provider.connectionType === CONNECTION_TYPES.MANUAL && provider.isActive,
    ),
  }
}

const REGION_DISPLAY_NAMES: Record<PaymentRegion, string> = {
  [PAYMENT_REGIONS.GLOBAL]: 'Global',
  [PAYMENT_REGIONS.INDIA]: 'India',
  [PAYMENT_REGIONS.AFRICA]: 'Africa',
  [PAYMENT_REGIONS.MIDDLE_EAST]: 'Middle East',
  [PAYMENT_REGIONS.SOUTHEAST_ASIA]: 'Southeast Asia',
  [PAYMENT_REGIONS.EUROPE]: 'Europe',
  [PAYMENT_REGIONS.NEPAL]: 'Nepal',
  [PAYMENT_REGIONS.BANGLADESH]: 'Bangladesh',
  [PAYMENT_REGIONS.TURKEY]: 'Turkey',
  [PAYMENT_REGIONS.LATIN_AMERICA]: 'Latin America',
}

export function getRegionDisplayName(region: PaymentRegion | string): string {
  return REGION_DISPLAY_NAMES[region as PaymentRegion] ?? String(region)
}

export function getSortedProviders(): PaymentProviderConfig[] {
  return [...PAYMENT_PROVIDERS_CONFIG].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1
    if (!a.isDefault && b.isDefault) return 1
    if (a.isActive && !b.isActive) return -1
    if (!a.isActive && b.isActive) return 1
    return a.name.localeCompare(b.name)
  })
}

export function isValidPaymentProvider(provider: unknown): provider is PaymentProviderId {
  if (typeof provider !== 'string') return false
  return Object.values(PAYMENT_PROVIDERS).includes(provider.toLowerCase() as PaymentProviderId)
}

export function isValidEventType(eventType: unknown): eventType is (typeof PAYMENT_EVENT_TYPES)[keyof typeof PAYMENT_EVENT_TYPES] {
  if (typeof eventType !== 'string') return false
  return Object.values(PAYMENT_EVENT_TYPES).includes(eventType.toLowerCase() as never)
}

export function isValidPaymentStatus(status: unknown): status is (typeof PAYMENT_STATUS_TYPES)[keyof typeof PAYMENT_STATUS_TYPES] {
  if (typeof status !== 'string') return false
  return Object.values(PAYMENT_STATUS_TYPES).includes(status.toLowerCase() as never)
}

export function isValidCurrency(currency: unknown): currency is SupportedCurrencyCode {
  if (typeof currency !== 'string') return false
  return Object.keys(SUPPORTED_CURRENCIES).includes(currency.toUpperCase())
}

export function formatCurrencyAmount(amount: number | string | null | undefined, currency = 'INR'): string {
  const numeric = typeof amount === 'number' ? amount : parseFloat(String(amount ?? ''))
  if (!Number.isFinite(numeric)) return '0.00'

  const currencyInfo = SUPPORTED_CURRENCIES[currency.toUpperCase() as SupportedCurrencyCode]
  if (!currencyInfo) return `${numeric.toFixed(2)} ${currency}`

  return `${currencyInfo.symbol}${numeric.toFixed(2)}`
}

export function calculateFxMarkup(baseAmount: number, markupPercent: number): number {
  if (!Number.isFinite(baseAmount) || !Number.isFinite(markupPercent)) return 0
  return (baseAmount * markupPercent) / 100
}

export function generatePaymentReference(prefix = 'PAY'): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${prefix}_${timestamp}_${random}`
}

export function maskSensitiveData(data: string | null | undefined, visibleChars = 4): string {
  if (!data) return ''
  if (data.length <= visibleChars) return '*'.repeat(data.length)
  return `${'*'.repeat(data.length - visibleChars)}${data.slice(-visibleChars)}`
}

export function parseProviderFromWebhook(webhookUrl: string | null | undefined): PaymentProviderId | null {
  if (!webhookUrl) return null
  const url = webhookUrl.toLowerCase()

  const checks: Array<[string, PaymentProviderId]> = [
    ['razorpay', PAYMENT_PROVIDERS.RAZORPAY],
    ['paypal', PAYMENT_PROVIDERS.PAYPAL],
    ['stripe', PAYMENT_PROVIDERS.STRIPE],
    ['payu', PAYMENT_PROVIDERS.PAYU],
    ['cashfree', PAYMENT_PROVIDERS.CASHFREE],
    ['phonepe', PAYMENT_PROVIDERS.PHONEPE],
    ['paytm', PAYMENT_PROVIDERS.PAYTM],
    ['sheconomypay', PAYMENT_PROVIDERS.SHECONOMYPAY],
  ]

  for (const [needle, provider] of checks) {
    if (url.includes(needle)) return provider
  }
  return null
}

export function getProviderDisplayInfo(provider: PaymentProviderId | string) {
  const providerConfig = getProviderConfig(provider)
  return {
    name: providerConfig.name,
    logo: providerConfig.logo,
    color: providerConfig.color,
    website: providerConfig.website,
    description: providerConfig.description,
    bgColor: providerConfig.bgColor,
    textColor: providerConfig.textColor,
    buttonColor: providerConfig.buttonColor,
    features: providerConfig.features,
    processingTime: providerConfig.processingTime,
    fees: providerConfig.fees,
    isOAuth: providerConfig.isOAuth,
    isActive: providerConfig.isActive,
    isDefault: providerConfig.isDefault,
    specialBenefits: providerConfig.specialBenefits,
    pricing: providerConfig.pricing,
    dashboardUrl: providerConfig.dashboardUrl,
  }
}

export function calculateNextSettlementDate(
  schedule: (typeof SETTLEMENT_SCHEDULES)[keyof typeof SETTLEMENT_SCHEDULES],
  baseDate = new Date(),
): Date {
  const date = new Date(baseDate)

  switch (schedule) {
    case SETTLEMENT_SCHEDULES.DAILY:
      date.setDate(date.getDate() + 1)
      break
    case SETTLEMENT_SCHEDULES.WEEKLY: {
      const daysUntilMonday = (1 + 7 - date.getDay()) % 7 || 7
      date.setDate(date.getDate() + daysUntilMonday)
      break
    }
    case SETTLEMENT_SCHEDULES.MONTHLY:
      date.setMonth(date.getMonth() + 1, 1)
      break
    default:
      date.setDate(date.getDate() + 1)
  }

  date.setHours(0, 0, 0, 0)
  return date
}

export function isValidMerchantId(merchantId: string | null | undefined, provider: PaymentProviderId | string): boolean {
  if (!merchantId || typeof merchantId !== 'string') return false
  if (merchantId.length < 3 || merchantId.length > 50) return false

  const id = normalizeProviderId(provider)
  switch (id) {
    case PAYMENT_PROVIDERS.RAZORPAY:
      return merchantId.startsWith('acc_') || /^[A-Za-z0-9]{14}$/.test(merchantId)
    case PAYMENT_PROVIDERS.STRIPE:
      return merchantId.startsWith('acct_')
    case PAYMENT_PROVIDERS.PAYPAL:
      return merchantId.includes('@') || merchantId.length >= 13
    case PAYMENT_PROVIDERS.SHECONOMYPAY:
      return merchantId.includes('@') || merchantId.startsWith('SHM_')
    default:
      return merchantId.length >= 3
  }
}

export function mergeConnectedProviders(
  fromAccounts: ConnectedProviderSummary[],
  fromQuery: ConnectedProviderSummary[],
): ConnectedProviderSummary[] {
  const providerMap = new Map<string, ConnectedProviderSummary>()
  for (const entry of [...fromQuery, ...fromAccounts]) {
    providerMap.set(entry.provider, entry)
  }
  return Array.from(providerMap.values())
}

export function processPaymentAnalytics(
  logs: Array<{
    status: string
    amount?: number | null
    provider?: string | null
    event_type: string
    logged_at?: string | null
  }>,
): PaymentAnalytics {
  const analytics: PaymentAnalytics = {
    totalTransactions: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    totalAmount: 0,
    successRate: 0,
    byProvider: {},
    byEventType: {},
    byStatus: {},
    timeline: {},
  }

  logs.forEach((log) => {
    analytics.totalTransactions += 1

    if (log.status === 'completed') {
      analytics.successfulTransactions += 1
      if (log.amount != null) analytics.totalAmount += Number(log.amount)
    } else if (log.status === 'failed') {
      analytics.failedTransactions += 1
    }

    if (log.provider) {
      if (!analytics.byProvider[log.provider]) analytics.byProvider[log.provider] = { count: 0, amount: 0 }
      analytics.byProvider[log.provider].count += 1
      if (log.amount != null && log.status === 'completed') {
        analytics.byProvider[log.provider].amount += Number(log.amount)
      }
    }

    analytics.byEventType[log.event_type] = (analytics.byEventType[log.event_type] ?? 0) + 1
    analytics.byStatus[log.status] = (analytics.byStatus[log.status] ?? 0) + 1

    const date = log.logged_at ? new Date(log.logged_at).toISOString().split('T')[0] : 'unknown'
    if (!analytics.timeline[date]) analytics.timeline[date] = { count: 0, amount: 0 }
    analytics.timeline[date].count += 1
    if (log.amount != null && log.status === 'completed') {
      analytics.timeline[date].amount += Number(log.amount)
    }
  })

  analytics.successRate =
    analytics.totalTransactions > 0
      ? Math.round((analytics.successfulTransactions / analytics.totalTransactions) * 100)
      : 0

  return analytics
}

export function accountsToConnectedProviders(
  accounts: Array<{ provider?: string | null; status?: string | null; connected_at?: string | null; created_at?: string | null }>,
): ConnectedProviderSummary[] {
  return accounts
    .filter((account) => account?.status === PAYMENT_ACCOUNT_STATUS.CONNECTED && account?.provider)
    .map((account) => ({
      provider: normalizeProviderId(account.provider!),
      connectedAt: account.connected_at ?? account.created_at ?? null,
    }))
}

export const ALL_PROVIDERS = PAYMENT_PROVIDERS_CONFIG

// ─── UI helpers (vendor payment methods screen) ───────────────────────────────

export function isProviderConnected(
  providerId: PaymentProviderId | string,
  accounts: ShopPaymentAccount[],
  connectedProviders: ConnectedProviderSummary[],
): boolean {
  const id = normalizeProviderId(providerId)
  if (connectedProviders.some((row) => row.provider === id)) return true
  return accounts.some(
    (account) =>
      normalizeProviderId(String(account.provider)) === id &&
      account.status === PAYMENT_ACCOUNT_STATUS.CONNECTED,
  )
}

export function getProviderActionLabel(
  provider: PaymentProviderConfig,
  connected: boolean,
): string {
  if (connected) return PAYMENT_UI_COPY.configure
  if (provider.connectionType === CONNECTION_TYPES.MANUAL && provider.id === PAYMENT_PROVIDERS.BANK_TRANSFER) {
    return PAYMENT_UI_COPY.setupBankDetails
  }
  if (provider.connectionType === CONNECTION_TYPES.OAUTH) return PAYMENT_UI_COPY.configure
  return PAYMENT_UI_COPY.connectProvider
}

export function getConnectionTypeLabel(connectionType: ConnectionType): string {
  return PAYMENT_CONNECTION_TYPE_LABELS[connectionType] ?? connectionType
}

export function getProviderBadgeLabel(provider: PaymentProviderConfig): string | null {
  if (provider.isDefault) return PAYMENT_PROVIDER_BADGE_LABELS.default
  if (provider.region === PAYMENT_REGIONS.GLOBAL) return PAYMENT_PROVIDER_BADGE_LABELS.global
  if (provider.id === PAYMENT_PROVIDERS.RAZORPAY || provider.id === PAYMENT_PROVIDERS.PAYPAL) {
    return PAYMENT_PROVIDER_BADGE_LABELS.popular
  }
  return null
}

export function getSetupStatusLabel(status: PaymentSetupStatus): string {
  if (status.isFullySetup) return PAYMENT_UI_COPY.setupComplete
  if (status.hasPaymentAccount || status.settingsConfigured) return PAYMENT_UI_COPY.setupPartial
  return PAYMENT_UI_COPY.setupPending
}

export function buildEmptyCredentialValues(providerId: PaymentProviderId | string): Record<string, string> {
  const config = PROVIDER_CREDENTIAL_FIELDS[normalizeProviderId(providerId)]
  if (!config) return {}
  const values: Record<string, string> = {}
  config.fields.forEach((field) => {
    values[field.key] = field.defaultValue ?? ''
  })
  return values
}

export function getDefaultProviderMode(providerId: PaymentProviderId | string): string {
  const config = PROVIDER_CREDENTIAL_FIELDS[normalizeProviderId(providerId)]
  if (!config?.modeOptions) return PAYMENT_CREDENTIAL_DEFAULT_MODE
  const firstKey = Object.keys(config.modeOptions)[0]
  return firstKey ?? PAYMENT_CREDENTIAL_DEFAULT_MODE
}

export function getProviderModeOptions(providerId: PaymentProviderId | string): Record<string, string> {
  return PROVIDER_CREDENTIAL_FIELDS[normalizeProviderId(providerId)]?.modeOptions ?? {}
}

export function isTestProviderMode(mode: string): boolean {
  const normalized = mode.trim().toLowerCase()
  return ['sandbox', 'test', 'playground'].includes(normalized)
}

export function getProviderSettlementLabel(provider: PaymentProviderConfig): string {
  return provider.processingTime?.trim() || 'Varies'
}

export function getProviderFeesLabel(provider: PaymentProviderConfig): string {
  const fees = provider.fees?.trim()
  if (!fees || fees.length > 48) return 'Contact Sales'
  return fees
}

export function hasProviderCredentialForm(providerId: PaymentProviderId | string): boolean {
  return Boolean(PROVIDER_CREDENTIAL_FIELDS[normalizeProviderId(providerId)])
}

export function sortProvidersForDisplay(
  providers: PaymentProviderConfig[],
  connectedIds: Set<string>,
): PaymentProviderConfig[] {
  const order = getSortedProviders().map((provider) => provider.id)
  return [...providers].sort((a, b) => {
    const aConnected = connectedIds.has(a.id) ? 1 : 0
    const bConnected = connectedIds.has(b.id) ? 1 : 0
    if (aConnected !== bConnected) return bConnected - aConnected
    return order.indexOf(a.id) - order.indexOf(b.id)
  })
}

// ─── Razorpay-specific helpers ────────────────────────────────────────────────

/**
 * Mask a Razorpay Key ID for safe display.
 * "rzp_live_AbCdEfGh" → "rzp_live_••••EfGh"
 */
export function maskRazorpayKeyId(keyId: string | null | undefined): string {
  if (!keyId) return ''
  const parts = keyId.split('_')
  if (parts.length < 3) {
    const last4 = keyId.slice(-4)
    const masked = '•'.repeat(Math.max(0, keyId.length - 4))
    return masked + last4
  }
  const prefix = `${parts[0]}_${parts[1]}_`
  const rest = parts.slice(2).join('_')
  if (rest.length <= 4) return prefix + rest
  return `${prefix}${'•'.repeat(4)}${rest.slice(-4)}`
}

/** Return true if the accounts list includes a connected Razorpay account. */
export function isRazorpayConnected(accounts: ShopPaymentAccount[]): boolean {
  return accounts.some(
    (a) =>
      normalizeProviderId(String(a.provider)) === PAYMENT_PROVIDERS.RAZORPAY &&
      a.status === PAYMENT_ACCOUNT_STATUS.CONNECTED,
  )
}

/** Return the status of the vendor's Razorpay account, or null if not found. */
export function getRazorpayStatus(
  accounts: ShopPaymentAccount[],
): PaymentAccountStatus | null {
  const account = accounts.find(
    (a) => normalizeProviderId(String(a.provider)) === PAYMENT_PROVIDERS.RAZORPAY,
  )
  return (account?.status as PaymentAccountStatus | undefined) ?? null
}

/** Return whether live mode is enabled in vendor payment settings. */
export function isLiveMode(settings: { is_live_mode?: boolean | null } | null | undefined): boolean {
  return settings?.is_live_mode === true
}

/** Human-readable label for a settlement schedule. */
export function formatSettlementSchedule(
  schedule: string | null | undefined,
): string {
  switch (schedule) {
    case SETTLEMENT_SCHEDULES.DAILY:
      return 'Daily'
    case SETTLEMENT_SCHEDULES.WEEKLY:
      return 'Weekly (every Monday)'
    case SETTLEMENT_SCHEDULES.MONTHLY:
      return 'Monthly (1st of month)'
    default:
      return schedule ?? 'Not set'
  }
}

/**
 * Warn when the Key ID prefix doesn't match the is_live_mode toggle.
 * Returns a warning string, or null when everything is consistent.
 */
export function getRazorpayModeMismatchWarning(
  keyId: string | null | undefined,
  isLiveModeOn: boolean,
): string | null {
  if (!keyId) return null
  const isLiveKey = keyId.startsWith('rzp_live_')
  const isTestKey = keyId.startsWith('rzp_test_')
  if (isLiveModeOn && isTestKey) {
    return 'Live mode is ON but your Key ID is a test key (rzp_test_…). Switch to a live key or disable live mode.'
  }
  if (!isLiveModeOn && isLiveKey) {
    return 'Live mode is OFF but your Key ID is a live key (rzp_live_…). Enable live mode or use a test key.'
  }
  return null
}

function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase()
}

/** Filter visible providers by name, description, region, features, or id slug. */
export function filterPaymentProvidersByQuery(
  providers: PaymentProviderConfig[],
  query: string,
): PaymentProviderConfig[] {
  const normalized = normalizeSearchQuery(query)
  if (!normalized) return providers

  const tokens = normalized.split(/\s+/).filter(Boolean)

  return providers.filter((provider) => {
    const haystack = [
      provider.name,
      provider.description,
      provider.id,
      getRegionDisplayName(provider.region),
      getConnectionTypeLabel(provider.connectionType),
      ...provider.features,
      ...provider.supportedCurrencies,
    ]
      .join(' ')
      .toLowerCase()

    return tokens.every((token) => haystack.includes(token))
  })
}
