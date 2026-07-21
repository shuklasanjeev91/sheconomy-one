/**
 * Vendor payment gateway service — accounts, settings, and logs.
 *
 * Ported from legacy:
 * - payment-account-service.js
 * - payment-settings-service.js
 * - payment-log-service.js
 *
 * Components should dispatch thunks from `payment.store` rather than calling
 * these functions directly.
 */

import type { Json } from '~/lib/supabase/database.types'

import { supabase } from '~/lib/supabase'

import {
  DEFAULT_VENDOR_PAYMENT_SETTINGS,
  PAYMENT_ACCOUNT_STATUS,
  PAYMENT_ANALYTICS_DEFAULT_DAYS,
  PAYMENT_CREDENTIAL_DEFAULT_MODE,
  PAYMENT_LOG_DEFAULT_LIMIT,
  PAYMENT_LOG_MAX_LIMIT,
  SETTLEMENT_SCHEDULES,
  SUPPORTED_CURRENCIES,
} from './payment.constants'
import { PaymentError, PAYMENT_ERROR_CODES, toFriendlyPaymentError } from './payment.errors'
import type {
  ConnectPaymentAccountInput,
  CurrencyOption,
  PaymentLog,
  LogPaymentEventInput,
  PaymentAnalytics,
  PaymentAnalyticsTimeRange,
  PaymentFilterOption,
  PaymentLogFilters,
  PaymentLogsPage,
  PaymentOAuthTokens,
  PaymentServiceResponse,
  PaymentSetupStatus,
  PaymentSettingsInput,
  SavePaymentCredentialsInput,
  SettlementScheduleOption,
  ShopPaymentAccount,
  ShopPaymentAccountInsert,
  ConnectedProviderSummary,
  VendorPaymentSettings,
} from './payment.type'
import {
  accountsToConnectedProviders,
  generatePaymentReference,
  mergeConnectedProviders,
  normalizeProviderId,
  processPaymentAnalytics,
  resolveProviderForDatabase,
} from './payment.utils'
import { buildDefaultPaymentSettings, validatePaymentSettings, validateProviderCredentials } from './payment.validation'
import type { PaymentProviderId } from './payment.constants'

function ok<T>(data: T): PaymentServiceResponse<T> {
  return { success: true, data, error: null }
}

function fail<T>(error: unknown, fallback?: string): PaymentServiceResponse<T> {
  return { success: false, data: null, error: toFriendlyPaymentError(error, fallback) }
}

// ============= ACCOUNT =============

export async function connectPaymentAccount(
  input: ConnectPaymentAccountInput,
): Promise<PaymentServiceResponse<ShopPaymentAccount>> {
  try {
    const { shopId, merchantId, tokens = {} } = input
    const provider = normalizeProviderId(input.provider)
    const dbProvider = resolveProviderForDatabase(provider)
    if (!dbProvider) {
      throw new PaymentError(PAYMENT_ERROR_CODES.PROVIDER_UNSUPPORTED)
    }
    if (!shopId || !merchantId) {
      throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Shop and merchant ID are required.')
    }

    const accountData = {
      shop_id: shopId,
      provider: dbProvider,
      merchant_id: merchantId,
      access_token: tokens.accessToken ?? null,
      refresh_token: tokens.refreshToken ?? null,
      token_expiry: tokens.expiresAt ?? null,
      status: PAYMENT_ACCOUNT_STATUS.CONNECTED,
      connected_at: new Date().toISOString(),
      metadata: (tokens.metadata ?? {}) as Json,
    }

    const { data, error } = await supabase
      .from('shop_payment_accounts')
      .upsert(accountData as ShopPaymentAccountInsert, { onConflict: 'shop_id,provider', ignoreDuplicates: false })
      .select()
      .single()

    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error, 'Could not connect the payment account.')
  }
}

export async function disconnectPaymentAccount(
  shopId: string,
  provider?: PaymentProviderId | string | null,
): Promise<PaymentServiceResponse<ShopPaymentAccount[]>> {
  try {
    if (!shopId) throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Shop ID is required.')

    let query = supabase
      .from('shop_payment_accounts')
      .update({
        status: PAYMENT_ACCOUNT_STATUS.DISCONNECTED,
        access_token: null,
        refresh_token: null,
        token_expiry: null,
      })
      .eq('shop_id', shopId)

    if (provider) {
      const dbProvider = resolveProviderForDatabase(normalizeProviderId(provider))
      if (!dbProvider) throw new PaymentError(PAYMENT_ERROR_CODES.PROVIDER_UNSUPPORTED)
      query = query.eq('provider', dbProvider)
    }

    const { data, error } = await query.select()
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error, 'Could not disconnect the payment account.')
  }
}

export async function getPaymentAccounts(
  shopId: string,
  provider?: PaymentProviderId | string | null,
): Promise<PaymentServiceResponse<ShopPaymentAccount[]>> {
  try {
    if (!shopId) throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Shop ID is required.')

    if (provider) {
      const dbProvider = resolveProviderForDatabase(normalizeProviderId(provider))
      if (!dbProvider) throw new PaymentError(PAYMENT_ERROR_CODES.PROVIDER_UNSUPPORTED)
      const { data, error } = await supabase
        .from('shop_payment_accounts')
        .select(
          'id, shop_id, provider, merchant_id, status, connected_at, last_sync_at, token_expiry, metadata, created_at, updated_at',
        )
        .eq('shop_id', shopId)
        .eq('provider', dbProvider)
        .maybeSingle()
      if (error && error.code !== 'PGRST116') throw error
      return ok((data ? [data] : []) as ShopPaymentAccount[])
    }

    const { data, error } = await supabase
      .from('shop_payment_accounts')
      .select(
        'id, shop_id, provider, merchant_id, status, connected_at, last_sync_at, token_expiry, metadata, created_at, updated_at',
      )
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return ok((data ?? []) as ShopPaymentAccount[])
  } catch (error) {
    return fail<ShopPaymentAccount[]>(error, 'Could not load payment accounts.')
  }
}

export async function getConnectedProviders(
  shopId: string,
): Promise<PaymentServiceResponse<ConnectedProviderSummary[]>> {
  try {
    if (!shopId) throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Shop ID is required.')

    const { data, error } = await supabase
      .from('shop_payment_accounts')
      .select('provider, status, connected_at, created_at')
      .eq('shop_id', shopId)
      .eq('status', PAYMENT_ACCOUNT_STATUS.CONNECTED)

    if (error) throw error
    return ok(accountsToConnectedProviders(data ?? []))
  } catch (error) {
    return fail<ConnectedProviderSummary[]>(error, 'Could not load connected providers.')
  }
}

export async function updateAccountTokens(
  shopId: string,
  provider: PaymentProviderId | string,
  tokens: PaymentOAuthTokens,
): Promise<PaymentServiceResponse<ShopPaymentAccount>> {
  try {
    const dbProvider = resolveProviderForDatabase(normalizeProviderId(provider))
    if (!shopId || !dbProvider || !tokens.accessToken) {
      throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Shop, provider, and access token are required.')
    }

    const { data, error } = await supabase
      .from('shop_payment_accounts')
      .update({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken ?? null,
        token_expiry: tokens.expiresAt ?? null,
        last_sync_at: new Date().toISOString(),
      })
      .eq('shop_id', shopId)
      .eq('provider', dbProvider)
      .select()
      .single()

    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error, 'Could not refresh payment account tokens.')
  }
}

export async function hasPaymentSetup(shopId: string): Promise<PaymentServiceResponse<PaymentSetupStatus>> {
  const empty: PaymentSetupStatus = {
    hasPaymentAccount: false,
    activeProviders: [],
    settingsConfigured: false,
    isFullySetup: false,
  }

  try {
    if (!shopId) throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Shop ID is required.')

    const { data, error } = await supabase.rpc('get_shop_payment_status', { shop_uuid: shopId })
    if (error) throw error

    const status = (Array.isArray(data) ? data[0] : null) as
      | {
          has_payment_account?: boolean
          active_providers?: string[]
          payment_settings_configured?: boolean
        }
      | undefined

    const normalized: PaymentSetupStatus = {
      hasPaymentAccount: Boolean(status?.has_payment_account),
      activeProviders: status?.active_providers ?? [],
      settingsConfigured: Boolean(status?.payment_settings_configured),
      isFullySetup: Boolean(status?.has_payment_account && status?.payment_settings_configured),
    }

    return ok(normalized)
  } catch (error) {
    return { success: false, data: empty, error: toFriendlyPaymentError(error) }
  }
}

export async function savePaymentCredentials(
  input: SavePaymentCredentialsInput,
): Promise<PaymentServiceResponse<ShopPaymentAccount>> {
  try {
    const { shopId, credentials } = input
    const provider = normalizeProviderId(input.provider)
    const mode = input.mode ?? PAYMENT_CREDENTIAL_DEFAULT_MODE
    const dbProvider = resolveProviderForDatabase(provider)

    if (!shopId || !credentials) {
      throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Shop and credentials are required.')
    }
    if (!dbProvider) throw new PaymentError(PAYMENT_ERROR_CODES.PROVIDER_UNSUPPORTED)

    const credentialValidation = validateProviderCredentials(provider, credentials)
    if (!credentialValidation.valid) {
      throw new PaymentError(
        PAYMENT_ERROR_CODES.CREDENTIALS_INVALID,
        credentialValidation.errors.join(' · '),
      )
    }

    const credentialsWithoutMode = { ...credentials }
    delete (credentialsWithoutMode as Record<string, string>).mode

    const accountData = {
      shop_id: shopId,
      provider: dbProvider,
      merchant_id:
        credentialsWithoutMode.merchantId ||
        credentialsWithoutMode.apiKey ||
        `${provider}_${Date.now()}`,
      access_token: null,
      refresh_token: null,
      token_expiry: null,
      status: PAYMENT_ACCOUNT_STATUS.CONNECTED,
      connected_at: new Date().toISOString(),
        metadata: {
          connection_type: 'credential',
          mode,
          credentials: JSON.stringify(credentialsWithoutMode),
          configured_at: new Date().toISOString(),
        } as Json,
      }

    const { data, error } = await supabase
      .from('shop_payment_accounts')
      .upsert(accountData as ShopPaymentAccountInsert, { onConflict: 'shop_id,provider', ignoreDuplicates: false })
      .select()
      .single()

    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error, 'Could not save payment credentials.')
  }
}

export async function getPaymentCredentials(shopId: string, provider: PaymentProviderId | string) {
  try {
    const dbProvider = resolveProviderForDatabase(normalizeProviderId(provider))
    if (!shopId || !dbProvider) {
      throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Shop and provider are required.')
    }

    const { data, error } = await supabase
      .from('shop_payment_accounts')
      .select('id, provider, status, metadata, connected_at')
      .eq('shop_id', shopId)
      .eq('provider', dbProvider)
      .eq('status', PAYMENT_ACCOUNT_STATUS.CONNECTED)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') throw error
    if (!data) {
      return fail(null, 'Payment credentials not found for this provider.')
    }

    let credentials: Record<string, string> | null = null
    let mode: string = PAYMENT_CREDENTIAL_DEFAULT_MODE
    const metadata = data.metadata as Record<string, unknown> | null

    if (metadata?.credentials && typeof metadata.credentials === 'string') {
      try {
        credentials = JSON.parse(metadata.credentials) as Record<string, string>
        mode = String(metadata.mode ?? PAYMENT_CREDENTIAL_DEFAULT_MODE)
      } catch {
        credentials = null
      }
    }

    return ok({
      provider: normalizeProviderId(String(data.provider)),
      credentials,
      mode,
      status: data.status,
      connectedAt: data.connected_at,
    })
  } catch (error) {
    return fail(error, 'Could not load payment credentials.')
  }
}

// ============= SETTINGS =============

export async function getPaymentSettings(shopId: string): Promise<PaymentServiceResponse<VendorPaymentSettings>> {
  try {
    if (!shopId) throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Shop ID is required.')

    const { data, error } = await supabase
      .from('vendor_payment_settings')
      .select('*')
      .eq('shop_id', shopId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') throw error

    return ok(
      data ??
        ({
          shop_id: shopId,
          ...DEFAULT_VENDOR_PAYMENT_SETTINGS,
        } as VendorPaymentSettings),
    )
  } catch (error) {
    return fail(error, 'Could not load payment settings.')
  }
}

export async function updatePaymentSettings(
  shopId: string,
  settings: PaymentSettingsInput,
): Promise<PaymentServiceResponse<VendorPaymentSettings>> {
  try {
    if (!shopId || !settings) {
      throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Shop and settings are required.')
    }

    const validation = validatePaymentSettings(settings)
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0]
      throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, firstError)
    }

    const { data, error } = await supabase
      .from('vendor_payment_settings')
      .upsert({ shop_id: shopId, ...settings }, { onConflict: 'shop_id', ignoreDuplicates: false })
      .select()
      .single()

    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error, 'Could not update payment settings.')
  }
}

export async function initializeDefaultSettings(
  shopId: string,
  customSettings: PaymentSettingsInput = {},
): Promise<PaymentServiceResponse<VendorPaymentSettings>> {
  return updatePaymentSettings(shopId, { ...DEFAULT_VENDOR_PAYMENT_SETTINGS, ...customSettings })
}

export async function toggleLiveMode(
  shopId: string,
  isLiveMode: boolean,
): Promise<PaymentServiceResponse<VendorPaymentSettings>> {
  try {
    if (!shopId) throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Shop ID is required.')

    const { data, error } = await supabase
      .from('vendor_payment_settings')
      .update({ is_live_mode: Boolean(isLiveMode) })
      .eq('shop_id', shopId)
      .select()
      .single()

    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error, 'Could not update live mode.')
  }
}

export function getSupportedSettlementCurrencies(): CurrencyOption[] {
  return Object.values(SUPPORTED_CURRENCIES).map((row) => ({
    code: row.code,
    name: row.name,
    symbol: row.symbol,
  }))
}

export function getSettlementScheduleOptions(): SettlementScheduleOption[] {
  return [
    { value: SETTLEMENT_SCHEDULES.DAILY, label: 'Daily', description: 'Settle funds every day' },
    {
      value: SETTLEMENT_SCHEDULES.WEEKLY,
      label: 'Weekly',
      description: 'Settle funds weekly on Monday',
    },
    {
      value: SETTLEMENT_SCHEDULES.MONTHLY,
      label: 'Monthly',
      description: 'Settle funds on the 1st of every month',
    },
  ]
}

// ============= LOGS =============

export async function logPaymentEvent(input: LogPaymentEventInput) {
  try {
    if (!input.eventType || !input.status) {
      throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Event type and status are required.')
    }

    const dbProvider = input.provider ? resolveProviderForDatabase(normalizeProviderId(input.provider)) : null

    const logData = {
      order_payment_id: input.orderPaymentId ?? null,
      shop_id: input.shopId ?? null,
      event_type: input.eventType as PaymentLog['event_type'],
      status: input.status as PaymentLog['status'],
      provider: dbProvider,
      transaction_id: input.transactionId ?? null,
      amount: input.amount ?? null,
      currency: input.currency ?? 'INR',
      payload: (input.payload ?? {}) as Json,
      error_code: input.errorCode ?? null,
      error_message: input.errorMessage ?? null,
      logged_at: new Date().toISOString(),
    }

    const { data, error } = await supabase.from('payment_logs').insert(logData).select().single()
    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error, 'Could not log payment event.')
  }
}

export async function getLogsByShop(
  shopId: string,
  filters: PaymentLogFilters = {},
): Promise<PaymentServiceResponse<PaymentLogsPage>> {
  const empty: PaymentLogsPage = { logs: [], totalCount: 0, hasMore: false }

  try {
    if (!shopId) throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Shop ID is required.')

    let query = supabase.from('payment_logs').select('*', { count: 'exact' }).eq('shop_id', shopId)

    if (filters.eventType) query = query.eq('event_type', filters.eventType)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.provider) {
      const dbProvider = resolveProviderForDatabase(normalizeProviderId(filters.provider))
      if (dbProvider) query = query.eq('provider', dbProvider)
    }
    if (filters.dateFrom) query = query.gte('logged_at', filters.dateFrom)
    if (filters.dateTo) query = query.lte('logged_at', filters.dateTo)

    const limit = Math.min(filters.limit ?? PAYMENT_LOG_DEFAULT_LIMIT, PAYMENT_LOG_MAX_LIMIT)
    const offset = filters.offset ?? 0

    const { data, error, count } = await query
      .order('logged_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const logs = data ?? []
    return ok({ logs, totalCount: count, hasMore: logs.length === limit })
  } catch (error) {
    return { success: false, data: empty, error: toFriendlyPaymentError(error) }
  }
}

export async function getLogsByOrder(orderPaymentId: string) {
  try {
    if (!orderPaymentId) {
      throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Order payment ID is required.')
    }

    const { data, error } = await supabase
      .from('payment_logs')
      .select('*')
      .eq('order_payment_id', orderPaymentId)
      .order('logged_at', { ascending: true })

    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error, 'Could not load payment logs for this order.')
  }
}

export async function getPaymentAnalytics(
  shopId: string,
  timeRange: PaymentAnalyticsTimeRange = {},
): Promise<PaymentServiceResponse<PaymentAnalytics>> {
  try {
    if (!shopId) throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Shop ID is required.')

    const dateFrom =
      timeRange.dateFrom ??
      new Date(Date.now() - PAYMENT_ANALYTICS_DEFAULT_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const dateTo = timeRange.dateTo ?? new Date().toISOString()

    const { data, error } = await supabase
      .from('payment_logs')
      .select('*')
      .eq('shop_id', shopId)
      .gte('logged_at', dateFrom)
      .lte('logged_at', dateTo)

    if (error) throw error
    return ok(processPaymentAnalytics(data ?? []))
  } catch (error) {
    return fail(error, 'Could not load payment analytics.')
  }
}

export async function logWebhookEvent(
  shopId: string,
  provider: PaymentProviderId | string,
  webhookData: {
    webhookId?: string | null
    eventType?: string
    payload?: Record<string, unknown>
    signature?: string | null
    orderPaymentId?: string | null
    transactionId?: string | null
  },
) {
  try {
    if (!shopId || !provider || !webhookData) {
      throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Shop, provider, and webhook data are required.')
    }

    const dbProvider = resolveProviderForDatabase(normalizeProviderId(provider))
    if (!dbProvider) throw new PaymentError(PAYMENT_ERROR_CODES.PROVIDER_UNSUPPORTED)

    const { data, error } = await supabase
      .from('payment_webhooks')
      .insert({
        shop_id: shopId,
        provider: dbProvider,
        webhook_id: webhookData.webhookId ?? generatePaymentReference('WH'),
        event_type: webhookData.eventType ?? 'webhook',
        payload: (webhookData.payload ?? {}) as Json,
        signature: webhookData.signature ?? null,
        processed: false,
      })
      .select()
      .single()

    if (error) throw error

    await logPaymentEvent({
      orderPaymentId: webhookData.orderPaymentId,
      eventType: 'webhook',
      status: 'pending',
      payload: webhookData.payload,
      shopId,
      provider: normalizeProviderId(provider),
      transactionId: webhookData.transactionId,
    })

    return ok(data)
  } catch (error) {
    return fail(error, 'Could not log webhook event.')
  }
}

export async function markWebhookProcessed(webhookId: string) {
  try {
    if (!webhookId) throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, 'Webhook ID is required.')

    const { data, error } = await supabase
      .from('payment_webhooks')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', webhookId)
      .select()
      .single()

    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error, 'Could not mark webhook as processed.')
  }
}

export function getPaymentLogEventTypeOptions(): PaymentFilterOption[] {
  return [
    { value: 'success', label: 'Success', description: 'Payment completed successfully' },
    { value: 'failure', label: 'Failure', description: 'Payment failed' },
    { value: 'refund', label: 'Refund', description: 'Payment refunded' },
    { value: 'webhook', label: 'Webhook', description: 'Webhook received' },
    { value: 'capture', label: 'Capture', description: 'Payment captured' },
    { value: 'authorization', label: 'Authorization', description: 'Payment authorized' },
    { value: 'settlement', label: 'Settlement', description: 'Payment settled' },
    { value: 'chargeback', label: 'Chargeback', description: 'Payment disputed' },
    { value: 'dispute', label: 'Dispute', description: 'Payment in dispute' },
  ]
}

export function getPaymentLogStatusOptions(): PaymentFilterOption[] {
  return [
    { value: 'completed', label: 'Completed', description: 'Event completed successfully' },
    { value: 'failed', label: 'Failed', description: 'Event failed' },
    { value: 'pending', label: 'Pending', description: 'Event pending' },
    { value: 'processing', label: 'Processing', description: 'Event in progress' },
    { value: 'cancelled', label: 'Cancelled', description: 'Event cancelled' },
  ]
}

export { buildDefaultPaymentSettings }
