/**
 * Redux slice for vendor payment gateway setup (accounts, settings, logs).
 *
 * Replaces legacy Zustand `paymentStore.js`. Distinct from `lib/orders/payment.store.ts`
 * which handles checkout `order_payments`. Registered in the root store as `vendorPayment`.
 */

import { createAsyncThunk, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch, RootState } from '~/lib/store'

import {
  PAYMENT_ACCOUNT_STATUS,
  PAYMENT_LOG_DEFAULT_LIMIT,
  type PaymentProviderId,
} from '~/lib/payment/payment.constants'
import * as paymentService from '~/lib/payment/payment.service'
import type {
  ConnectedProviderSummary,
  LogPaymentEventInput,
  PaymentAnalytics,
  PaymentAnalyticsTimeRange,
  PaymentLog,
  PaymentLogFilters,
  PaymentLogsPage,
  PaymentOAuthTokens,
  PaymentSetupStatus,
  PaymentSettingsInput,
  ShopPaymentAccount,
  VendorPaymentSettings,
} from '~/lib/payment/payment.type'
import {
  accountsToConnectedProviders,
  mergeConnectedProviders,
  normalizeProviderId,
} from '~/lib/payment/payment.utils'

// ============= STATE =============

type VendorPaymentLoadingState = {
  accounts: boolean
  connecting: boolean
  settings: boolean
  updatingSettings: boolean
  logs: boolean
  analytics: boolean
}

type VendorPaymentState = {
  shopId: string | null
  paymentAccounts: ShopPaymentAccount[]
  connectedProviders: ConnectedProviderSummary[]
  paymentSettings: VendorPaymentSettings | null
  paymentSetupStatus: PaymentSetupStatus
  paymentLogs: PaymentLog[]
  logsHasMore: boolean
  paymentAnalytics: PaymentAnalytics | null
  logFilters: PaymentLogFilters
  loading: VendorPaymentLoadingState
  error: string | null
}

const emptySetupStatus = (): PaymentSetupStatus => ({
  hasPaymentAccount: false,
  activeProviders: [],
  settingsConfigured: false,
  isFullySetup: false,
})

const initialState: VendorPaymentState = {
  shopId: null,
  paymentAccounts: [],
  connectedProviders: [],
  paymentSettings: null,
  paymentSetupStatus: emptySetupStatus(),
  paymentLogs: [],
  logsHasMore: false,
  paymentAnalytics: null,
  logFilters: {
    eventType: null,
    status: null,
    provider: null,
    dateFrom: null,
    dateTo: null,
    limit: PAYMENT_LOG_DEFAULT_LIMIT,
    offset: 0,
  },
  loading: {
    accounts: false,
    connecting: false,
    settings: false,
    updatingSettings: false,
    logs: false,
    analytics: false,
  },
  error: null,
}

type ThunkConfig = { state: RootState; dispatch: AppDispatch; rejectValue: string }

type AccountsSnapshot = {
  paymentAccounts: ShopPaymentAccount[]
  connectedProviders: ConnectedProviderSummary[]
}

type SettingsSnapshot = { paymentSettings: VendorPaymentSettings | null }

const rollbackRegistry = new Map<string, AccountsSnapshot | SettingsSnapshot>()

function stashRollback<T>(requestId: string, snapshot: T) {
  rollbackRegistry.set(requestId, snapshot as AccountsSnapshot)
}

function takeRollback<T>(requestId: string): T | undefined {
  const snapshot = rollbackRegistry.get(requestId)
  rollbackRegistry.delete(requestId)
  return snapshot as T | undefined
}

async function resolveResponse<T>(
  promise: Promise<{ data: T | null; error: string | null; success: boolean }>,
  rejectWithValue: (value: string) => unknown,
): Promise<T> {
  const response = await promise
  if (!response.success) return rejectWithValue(response.error ?? 'Request failed.') as never
  return response.data as T
}

function snapshotAccounts(state: VendorPaymentState): AccountsSnapshot {
  return {
    paymentAccounts: current(state.paymentAccounts),
    connectedProviders: current(state.connectedProviders),
  }
}

function restoreAccounts(state: VendorPaymentState, snapshot?: AccountsSnapshot) {
  if (!snapshot) return
  state.paymentAccounts = snapshot.paymentAccounts
  state.connectedProviders = snapshot.connectedProviders
}

function upsertAccount(state: VendorPaymentState, account: ShopPaymentAccount) {
  const index = state.paymentAccounts.findIndex((row) => row.id === account.id)
  if (index === -1) state.paymentAccounts.unshift(account)
  else state.paymentAccounts[index] = account

  if (account.status === PAYMENT_ACCOUNT_STATUS.CONNECTED && account.provider) {
    const provider = normalizeProviderId(String(account.provider))
    const existing = state.connectedProviders.find((row) => row.provider === provider)
    if (existing) existing.connectedAt = account.connected_at ?? existing.connectedAt
    else state.connectedProviders.push({ provider, connectedAt: account.connected_at ?? null })
  }
}

function markAccountsDisconnected(state: VendorPaymentState, provider?: PaymentProviderId | null) {
  state.paymentAccounts = state.paymentAccounts.map((row) => {
    if (provider && normalizeProviderId(String(row.provider)) !== normalizeProviderId(provider)) {
      return row
    }
    return {
      ...row,
      status: PAYMENT_ACCOUNT_STATUS.DISCONNECTED,
      access_token: null,
      refresh_token: null,
      token_expiry: null,
    }
  })

  if (provider) {
    state.connectedProviders = state.connectedProviders.filter(
      (row) => row.provider !== normalizeProviderId(provider),
    )
  } else {
    state.connectedProviders = []
  }
}

// ============= THUNKS =============

export const loadPaymentAccounts = createAsyncThunk<
  ShopPaymentAccount[],
  { shopId: string },
  ThunkConfig
>('vendorPayment/loadAccounts', async ({ shopId }, { rejectWithValue, dispatch }) => {
  const response = await paymentService.getPaymentAccounts(shopId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load payment accounts.')
  const accounts = response.data ?? []

  const providersResult = await paymentService.getConnectedProviders(shopId)
  const fromAccounts = accountsToConnectedProviders(accounts)
  const fromQuery = providersResult.success && providersResult.data ? providersResult.data : []

  dispatch(setConnectedProviders(mergeConnectedProviders(fromAccounts, fromQuery)))
  return accounts
})

export const connectPaymentAccount = createAsyncThunk<
  ShopPaymentAccount,
  { shopId: string; provider: PaymentProviderId; merchantId: string; tokens?: PaymentOAuthTokens },
  ThunkConfig
>('vendorPayment/connectAccount', ({ shopId, provider, merchantId, tokens }, { rejectWithValue }) =>
  resolveResponse(
    paymentService.connectPaymentAccount({ shopId, provider, merchantId, tokens }),
    rejectWithValue,
  ),
)

export const savePaymentCredentials = createAsyncThunk<
  ShopPaymentAccount,
  {
    shopId: string
    provider: PaymentProviderId
    credentials: Record<string, string>
    mode?: string
  },
  ThunkConfig
>('vendorPayment/saveCredentials', ({ shopId, provider, credentials, mode }, { rejectWithValue }) =>
  resolveResponse(
    paymentService.savePaymentCredentials({ shopId, provider, credentials, mode }),
    rejectWithValue,
  ),
)

export const disconnectPaymentAccount = createAsyncThunk<
  ShopPaymentAccount[],
  { shopId: string; provider?: PaymentProviderId | null },
  ThunkConfig
>('vendorPayment/disconnectAccount', ({ shopId, provider }, { rejectWithValue }) =>
  resolveResponse(paymentService.disconnectPaymentAccount(shopId, provider), rejectWithValue),
)

export const loadPaymentSettings = createAsyncThunk<
  VendorPaymentSettings,
  { shopId: string },
  ThunkConfig
>('vendorPayment/loadSettings', ({ shopId }, { rejectWithValue }) =>
  resolveResponse(paymentService.getPaymentSettings(shopId), rejectWithValue),
)

export const updatePaymentSettings = createAsyncThunk<
  VendorPaymentSettings,
  { shopId: string; settings: PaymentSettingsInput },
  ThunkConfig
>('vendorPayment/updateSettings', ({ shopId, settings }, { rejectWithValue }) =>
  resolveResponse(paymentService.updatePaymentSettings(shopId, settings), rejectWithValue),
)

export const togglePaymentLiveMode = createAsyncThunk<
  VendorPaymentSettings,
  { shopId: string; isLiveMode: boolean },
  ThunkConfig
>('vendorPayment/toggleLiveMode', ({ shopId, isLiveMode }, { rejectWithValue }) =>
  resolveResponse(paymentService.toggleLiveMode(shopId, isLiveMode), rejectWithValue),
)

export const checkPaymentSetupStatus = createAsyncThunk<
  PaymentSetupStatus,
  { shopId: string },
  ThunkConfig
>('vendorPayment/checkSetupStatus', ({ shopId }, { rejectWithValue }) =>
  resolveResponse(paymentService.hasPaymentSetup(shopId), rejectWithValue),
)

export const initializePaymentSetup = createAsyncThunk<void, { shopId: string }, ThunkConfig>(
  'vendorPayment/initializeSetup',
  async ({ shopId }, { dispatch, rejectWithValue }) => {
    await resolveResponse(paymentService.initializeDefaultSettings(shopId), rejectWithValue)
    await Promise.all([
      dispatch(loadPaymentAccounts({ shopId })),
      dispatch(loadPaymentSettings({ shopId })),
      dispatch(checkPaymentSetupStatus({ shopId })),
    ])
  },
)

export const loadPaymentLogs = createAsyncThunk<PaymentLogsPage, { shopId: string }, ThunkConfig>(
  'vendorPayment/loadLogs',
  ({ shopId }, { getState, rejectWithValue }) => {
    const filters = getState().vendorPayment.logFilters
    return resolveResponse(paymentService.getLogsByShop(shopId, filters), rejectWithValue)
  },
)

export const loadPaymentAnalytics = createAsyncThunk<
  PaymentAnalytics,
  { shopId: string; timeRange?: PaymentAnalyticsTimeRange },
  ThunkConfig
>('vendorPayment/loadAnalytics', ({ shopId, timeRange }, { rejectWithValue }) =>
  resolveResponse(paymentService.getPaymentAnalytics(shopId, timeRange), rejectWithValue),
)

export const logPaymentEvent = createAsyncThunk<
  unknown,
  LogPaymentEventInput & { refreshShopId?: string | null },
  ThunkConfig
>('vendorPayment/logEvent', async (input, { dispatch, rejectWithValue }) => {
  const result = await resolveResponse(paymentService.logPaymentEvent(input), rejectWithValue)
  if (input.refreshShopId) {
    await dispatch(loadPaymentLogs({ shopId: input.refreshShopId }))
  }
  return result
})

// ─── Razorpay-specific thunks ──────────────────────────────────────────────────

export const validateRazorpayCredentials = createAsyncThunk<
  paymentService.RazorpayValidateResult,
  paymentService.RazorpayValidateInput,
  ThunkConfig
>('vendorPayment/validateRazorpay', (input, { rejectWithValue }) =>
  resolveResponse(paymentService.validateRazorpayCredentials(input), rejectWithValue),
)

export const connectRazorpay = createAsyncThunk<
  paymentService.RazorpayConnectResult,
  paymentService.RazorpayConnectInput,
  ThunkConfig
>('vendorPayment/connectRazorpay', async (input, { dispatch, rejectWithValue }) => {
  const result = await resolveResponse(
    paymentService.connectRazorpay(input),
    rejectWithValue,
  )
  // Refresh accounts so the UI reflects the new connection
  await dispatch(loadPaymentAccounts({ shopId: input.shopId }))
  return result
})

export const disconnectRazorpay = createAsyncThunk<
  ShopPaymentAccount[],
  { shopId: string },
  ThunkConfig
>('vendorPayment/disconnectRazorpay', async ({ shopId }, { dispatch, rejectWithValue }) => {
  const result = await resolveResponse(
    paymentService.disconnectRazorpay(shopId),
    rejectWithValue,
  )
  await dispatch(loadPaymentAccounts({ shopId }))
  return result
})

// ============= SLICE =============

const vendorPaymentSlice = createSlice({
  name: 'vendorPayment',
  initialState,
  reducers: {
    setVendorPaymentShopId(state, action: PayloadAction<string | null>) {
      state.shopId = action.payload
    },
    setConnectedProviders(state, action: PayloadAction<ConnectedProviderSummary[]>) {
      state.connectedProviders = action.payload
    },
    updateLogFilters(state, action: PayloadAction<Partial<PaymentLogFilters>>) {
      state.logFilters = { ...state.logFilters, ...action.payload }
    },
    clearLogFilters(state) {
      state.logFilters = {
        eventType: null,
        status: null,
        provider: null,
        dateFrom: null,
        dateTo: null,
        limit: PAYMENT_LOG_DEFAULT_LIMIT,
        offset: 0,
      }
    },
    setVendorPaymentError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
    clearVendorPaymentError(state) {
      state.error = null
    },
    resetVendorPayment(state) {
      Object.assign(state, initialState)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadPaymentAccounts.pending, (state) => {
        state.loading.accounts = true
        state.error = null
      })
      .addCase(loadPaymentAccounts.fulfilled, (state, action) => {
        state.paymentAccounts = action.payload
        state.loading.accounts = false
      })
      .addCase(loadPaymentAccounts.rejected, (state, action) => {
        state.loading.accounts = false
        state.error = action.payload ?? 'Failed to load payment accounts.'
      })

      .addCase(connectPaymentAccount.pending, (state, action) => {
        state.loading.connecting = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotAccounts(state))
        const { provider, merchantId, shopId } = action.meta.arg
        const optimistic: ShopPaymentAccount = {
          id: `temp-${action.meta.requestId}`,
          shop_id: shopId,
          provider: provider as ShopPaymentAccount['provider'],
          merchant_id: merchantId,
          status: PAYMENT_ACCOUNT_STATUS.CONNECTED,
          connected_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          access_token: null,
          refresh_token: null,
          token_expiry: null,
          last_sync_at: null,
          metadata: {},
        }
        upsertAccount(state, optimistic)
      })
      .addCase(connectPaymentAccount.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.loading.connecting = false
        state.paymentAccounts = state.paymentAccounts.filter((row) => !String(row.id).startsWith('temp-'))
        upsertAccount(state, action.payload)
      })
      .addCase(connectPaymentAccount.rejected, (state, action) => {
        restoreAccounts(state, takeRollback(action.meta.requestId))
        state.loading.connecting = false
        state.error = action.payload ?? 'Failed to connect payment account.'
      })

      .addCase(savePaymentCredentials.pending, (state, action) => {
        state.loading.connecting = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotAccounts(state))
        const { shopId, provider } = action.meta.arg
        upsertAccount(state, {
          id: `temp-${action.meta.requestId}`,
          shop_id: shopId,
          provider: provider as ShopPaymentAccount['provider'],
          merchant_id: `${provider}_pending`,
          status: PAYMENT_ACCOUNT_STATUS.CONNECTED,
          connected_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          access_token: null,
          refresh_token: null,
          token_expiry: null,
          last_sync_at: null,
          metadata: { connection_type: 'credential' },
        })
      })
      .addCase(savePaymentCredentials.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.loading.connecting = false
        state.paymentAccounts = state.paymentAccounts.filter((row) => !String(row.id).startsWith('temp-'))
        upsertAccount(state, action.payload)
      })
      .addCase(savePaymentCredentials.rejected, (state, action) => {
        restoreAccounts(state, takeRollback(action.meta.requestId))
        state.loading.connecting = false
        state.error = action.payload ?? 'Failed to save payment credentials.'
      })

      .addCase(disconnectPaymentAccount.pending, (state, action) => {
        state.loading.accounts = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotAccounts(state))
        markAccountsDisconnected(state, action.meta.arg.provider ?? null)
      })
      .addCase(disconnectPaymentAccount.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.loading.accounts = false
        action.payload.forEach((account) => upsertAccount(state, account))
      })
      .addCase(disconnectPaymentAccount.rejected, (state, action) => {
        restoreAccounts(state, takeRollback(action.meta.requestId))
        state.loading.accounts = false
        state.error = action.payload ?? 'Failed to disconnect payment account.'
      })

      .addCase(loadPaymentSettings.pending, (state) => {
        state.loading.settings = true
        state.error = null
      })
      .addCase(loadPaymentSettings.fulfilled, (state, action) => {
        state.paymentSettings = action.payload
        state.loading.settings = false
      })
      .addCase(loadPaymentSettings.rejected, (state, action) => {
        state.loading.settings = false
        state.error = action.payload ?? 'Failed to load payment settings.'
      })

      .addCase(updatePaymentSettings.pending, (state, action) => {
        state.loading.updatingSettings = true
        state.error = null
        stashRollback(action.meta.requestId, {
          paymentSettings: state.paymentSettings,
        })
        state.paymentSettings = {
          ...(state.paymentSettings ?? {
            shop_id: action.meta.arg.shopId,
            id: `temp-settings-${action.meta.requestId}`,
          }),
          ...action.meta.arg.settings,
        } as VendorPaymentSettings
      })
      .addCase(updatePaymentSettings.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.paymentSettings = action.payload
        state.loading.updatingSettings = false
      })
      .addCase(updatePaymentSettings.rejected, (state, action) => {
        const snapshot = takeRollback<SettingsSnapshot>(action.meta.requestId)
        if (snapshot) state.paymentSettings = snapshot.paymentSettings
        state.loading.updatingSettings = false
        state.error = action.payload ?? 'Failed to update payment settings.'
      })

      .addCase(togglePaymentLiveMode.pending, (state, action) => {
        state.loading.updatingSettings = true
        state.error = null
        stashRollback(action.meta.requestId, { paymentSettings: state.paymentSettings })
        if (state.paymentSettings) {
          state.paymentSettings.is_live_mode = action.meta.arg.isLiveMode
        }
      })
      .addCase(togglePaymentLiveMode.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.paymentSettings = action.payload
        state.loading.updatingSettings = false
      })
      .addCase(togglePaymentLiveMode.rejected, (state, action) => {
        const snapshot = takeRollback<SettingsSnapshot>(action.meta.requestId)
        if (snapshot) state.paymentSettings = snapshot.paymentSettings
        state.loading.updatingSettings = false
        state.error = action.payload ?? 'Failed to toggle live mode.'
      })

      .addCase(checkPaymentSetupStatus.fulfilled, (state, action) => {
        state.paymentSetupStatus = action.payload
      })

      .addCase(loadPaymentLogs.pending, (state) => {
        state.loading.logs = true
        state.error = null
      })
      .addCase(loadPaymentLogs.fulfilled, (state, action) => {
        state.paymentLogs = action.payload.logs
        state.logsHasMore = action.payload.hasMore
        state.loading.logs = false
      })
      .addCase(loadPaymentLogs.rejected, (state, action) => {
        state.loading.logs = false
        state.error = action.payload ?? 'Failed to load payment logs.'
      })

      .addCase(loadPaymentAnalytics.pending, (state) => {
        state.loading.analytics = true
        state.error = null
      })
      .addCase(loadPaymentAnalytics.fulfilled, (state, action) => {
        state.paymentAnalytics = action.payload
        state.loading.analytics = false
      })
      .addCase(loadPaymentAnalytics.rejected, (state, action) => {
        state.loading.analytics = false
        state.error = action.payload ?? 'Failed to load payment analytics.'
      })
  },
})

export const {
  setVendorPaymentShopId,
  setConnectedProviders,
  updateLogFilters,
  clearLogFilters,
  setVendorPaymentError,
  clearVendorPaymentError,
  resetVendorPayment,
} = vendorPaymentSlice.actions

export const vendorPaymentReducer = vendorPaymentSlice.reducer

// ============= SELECTORS =============

export const selectVendorPaymentAccounts = (state: RootState) => state.vendorPayment.paymentAccounts
export const selectConnectedProviders = (state: RootState) => state.vendorPayment.connectedProviders
export const selectVendorPaymentSettings = (state: RootState) => state.vendorPayment.paymentSettings
export const selectPaymentSetupStatus = (state: RootState) => state.vendorPayment.paymentSetupStatus
export const selectVendorPaymentLogs = (state: RootState) => state.vendorPayment.paymentLogs
export const selectVendorPaymentAnalytics = (state: RootState) => state.vendorPayment.paymentAnalytics
export const selectVendorPaymentLogFilters = (state: RootState) => state.vendorPayment.logFilters
export const selectVendorPaymentLoading = (state: RootState) => state.vendorPayment.loading
export const selectVendorPaymentError = (state: RootState) => state.vendorPayment.error

export function selectIsVendorPaymentFullySetup(state: RootState): boolean {
  return state.vendorPayment.paymentSetupStatus.isFullySetup
}
