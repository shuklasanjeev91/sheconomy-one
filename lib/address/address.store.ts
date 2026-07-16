/**
 * Redux Toolkit slice for address state.
 *
 * Replaces the legacy Zustand `addressStore`. Async work lives in
 * `createAsyncThunk`s that wrap `address.service`; every mutation applies
 * **optimistically** and rolls back on failure.
 *
 * The same slice serves normal users, vendors, and admins (pass `targetUserId`
 * to load another user's addresses from the admin dashboard).
 */

import { createAsyncThunk, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch } from '~/lib/store'

import * as addressService from './address.service'
import {
  EMPTY_ADDRESS_FORM_DATA,
  ADDRESS_TYPE,
  type Address,
  type AddressFormData,
  type AddressInput,
  type AddressStats,
  type AddressType,
  type AddressValidationResult,
} from './address.type'
import { sortAddressesByPriority } from './address.utils'
import { validateAddressData } from './address.validation'

// ============= STATE =============

type AddressState = {
  addresses: Address[]
  selectedAddressId: string | null
  viewedUserId: string | null
  stats: AddressStats | null
  lastFetch: number | null

  formData: AddressFormData
  validation: AddressValidationResult

  isLoading: boolean
  isSaving: boolean
  isDeleting: boolean
  error: string | null
}

const initialState: AddressState = {
  addresses: [],
  selectedAddressId: null,
  viewedUserId: null,
  stats: null,
  lastFetch: null,
  formData: { ...EMPTY_ADDRESS_FORM_DATA },
  validation: { isValid: true, errors: {} },
  isLoading: false,
  isSaving: false,
  isDeleting: false,
  error: null,
}

type ThunkConfig = { rejectValue: string; dispatch: AppDispatch }

async function resolveResponse<T>(
  promise: Promise<{ data: T | null; error: string | null; success: boolean }>,
  rejectWithValue: (value: string) => unknown,
): Promise<T> {
  const response = await promise
  if (!response.success) {
    return rejectWithValue(response.error ?? 'Request failed.') as never
  }
  return response.data as T
}

// ============= THUNKS =============

export const loadAddresses = createAsyncThunk<
  Address[],
  { targetUserId?: string | null; forceRefresh?: boolean } | undefined,
  ThunkConfig
>('address/loadAddresses', async (args, { getState, rejectWithValue }) => {
  const state = getState() as { address: AddressState }
  const forceRefresh = args?.forceRefresh ?? false
  const targetUserId = args?.targetUserId ?? null

  if (
    !forceRefresh &&
    state.address.lastFetch &&
    Date.now() - state.address.lastFetch < 30_000 &&
    state.address.viewedUserId === (targetUserId ?? state.address.viewedUserId)
  ) {
    return state.address.addresses
  }

  const response = await addressService.getUserAddresses(targetUserId ?? undefined)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load addresses.')
  return sortAddressesByPriority(response.data ?? [])
})

export const loadAddressesByType = createAsyncThunk<
  Address[],
  { addressType: AddressType; targetUserId?: string | null },
  ThunkConfig
>('address/loadAddressesByType', ({ addressType, targetUserId }, { rejectWithValue }) =>
  resolveResponse(
    addressService.getAddressesByType(addressType, targetUserId),
    rejectWithValue,
  ) as Promise<Address[]>,
)

export const loadAddressStats = createAsyncThunk<AddressStats, string | undefined, ThunkConfig>(
  'address/loadAddressStats',
  (targetUserId, { rejectWithValue }) =>
    resolveResponse(addressService.getAddressStats(targetUserId), rejectWithValue) as Promise<AddressStats>,
)

export const createAddress = createAsyncThunk<
  Address,
  { input: AddressFormData | AddressInput; userId?: string },
  ThunkConfig
>('address/createAddress', ({ input, userId }, { rejectWithValue }) =>
  resolveResponse(addressService.createAddress(input, userId), rejectWithValue) as Promise<Address>,
)

export const updateAddress = createAsyncThunk<
  Address,
  { addressId: string; input: AddressFormData | AddressInput },
  ThunkConfig
>('address/updateAddress', ({ addressId, input }, { rejectWithValue }) =>
  resolveResponse(addressService.updateAddress(addressId, input), rejectWithValue) as Promise<Address>,
)

export const deleteAddress = createAsyncThunk<string, string, ThunkConfig>(
  'address/deleteAddress',
  async (addressId, { rejectWithValue }) => {
    const response = await addressService.deleteAddress(addressId)
    if (!response.success) return rejectWithValue(response.error ?? 'Failed to delete address.')
    return addressId
  },
)

export const setDefaultAddress = createAsyncThunk<string, string, ThunkConfig>(
  'address/setDefaultAddress',
  async (addressId, { rejectWithValue }) => {
    const response = await addressService.setDefaultAddress(addressId)
    if (!response.success) return rejectWithValue(response.error ?? 'Failed to set default address.')
    return addressId
  },
)

// ============= OPTIMISTIC ROLLBACK REGISTRY =============

const rollbackRegistry = new Map<string, unknown>()

function stashRollback(requestId: string, snapshot: unknown): void {
  rollbackRegistry.set(requestId, snapshot)
}

function takeRollback<T>(requestId: string): T | undefined {
  const snapshot = rollbackRegistry.get(requestId) as T | undefined
  rollbackRegistry.delete(requestId)
  return snapshot
}

function optimisticId(requestId: string): string {
  return `temp-${requestId}`
}

type AddressSnapshot = {
  addresses: Address[]
  selectedAddressId: string | null
  stats: AddressState['stats']
}

function snapshotAddresses(state: AddressState): AddressSnapshot {
  return {
    addresses: current(state.addresses),
    selectedAddressId: state.selectedAddressId,
    stats: state.stats,
  }
}

function restoreAddresses(state: AddressState, snapshot: AddressSnapshot | undefined): void {
  if (!snapshot) return
  state.addresses = snapshot.addresses
  state.selectedAddressId = snapshot.selectedAddressId
  state.stats = snapshot.stats
}

function replaceAddress(state: AddressState, address: Address): void {
  const exists = state.addresses.some((row) => row.id === address.id)
  const next = exists
    ? state.addresses.map((row) => (row.id === address.id ? address : row))
    : [...state.addresses, address]
  state.addresses = sortAddressesByPriority(next)
}

function buildOptimisticAddress(requestId: string, input: AddressFormData | AddressInput, userId?: string): Address {
  const now = new Date().toISOString()

  return {
    id: optimisticId(requestId),
    user_id: userId ?? '',
    address_line_1: input.address_line_1,
    address_line_2: input.address_line_2 || null,
    city: input.city,
    state: input.state,
    postal_code: input.postal_code,
    country: input.country ?? '',
    address_type: input.address_type ?? ADDRESS_TYPE.HOME,
    is_default: Boolean(input.is_default),
    address_label: input.address_label || null,
    address_metadata: null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    place_id: input.place_id ?? null,
    source: input.source ?? 'manual',
    created_at: now,
    updated_at: now,
  }
}

function applyDefaultFlags(state: AddressState, addressId: string): void {
  const target = state.addresses.find((row) => row.id === addressId)
  if (!target) return

  state.addresses = state.addresses.map((row) => {
    if (row.id === addressId) return { ...row, is_default: true }
    if (row.address_type === target.address_type && row.is_default) {
      return { ...row, is_default: false }
    }
    return row
  })
  state.addresses = sortAddressesByPriority(state.addresses)
}

// ============= SLICE =============

const addressSlice = createSlice({
  name: 'address',
  initialState,
  reducers: {
    setAddressFormData: (state, action: PayloadAction<Partial<AddressFormData>>) => {
      state.formData = { ...state.formData, ...action.payload }
    },
    updateAddressField: (
      state,
      action: PayloadAction<{ field: keyof AddressFormData; value: AddressFormData[keyof AddressFormData] }>,
    ) => {
      state.formData = { ...state.formData, [action.payload.field]: action.payload.value }
    },
    loadFormFromAddress: (state, action: PayloadAction<AddressFormData>) => {
      state.formData = { ...action.payload }
      state.validation = { isValid: true, errors: {} }
    },
    resetAddressFormData: (state) => {
      state.formData = { ...EMPTY_ADDRESS_FORM_DATA }
      state.validation = { isValid: true, errors: {} }
    },
    validateAddressForm: (state) => {
      state.validation = validateAddressData(state.formData)
    },
    selectAddress: (state, action: PayloadAction<string | null>) => {
      state.selectedAddressId = action.payload
    },
    clearAddressSelection: (state) => {
      state.selectedAddressId = null
    },
    setAddressError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    clearAddressError: (state) => {
      state.error = null
    },
    resetAddress: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // ---- load ----
      .addCase(loadAddresses.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadAddresses.fulfilled, (state, action) => {
        state.addresses = action.payload
        state.isLoading = false
        state.lastFetch = Date.now()
        state.viewedUserId = action.meta.arg?.targetUserId ?? state.viewedUserId
      })
      .addCase(loadAddresses.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload ?? 'Failed to load addresses.'
      })

      .addCase(loadAddressStats.fulfilled, (state, action) => {
        state.stats = action.payload
      })

      // ---- create (optimistic insert) ----
      .addCase(createAddress.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotAddresses(state))
        const optimistic = buildOptimisticAddress(
          action.meta.requestId,
          action.meta.arg.input,
          action.meta.arg.userId,
        )
        state.addresses = sortAddressesByPriority([...state.addresses, optimistic])
        state.selectedAddressId = optimistic.id
      })
      .addCase(createAddress.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        const tempId = optimisticId(action.meta.requestId)
        state.addresses = sortAddressesByPriority(
          state.addresses.map((row) => (row.id === tempId ? action.payload : row)),
        )
        state.selectedAddressId = action.payload.id
        state.isSaving = false
        state.lastFetch = Date.now()
      })
      .addCase(createAddress.rejected, (state, action) => {
        restoreAddresses(state, takeRollback<AddressSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to create address.'
        state.isSaving = false
      })

      // ---- update (optimistic merge) ----
      .addCase(updateAddress.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotAddresses(state))
        const { addressId, input } = action.meta.arg
        state.addresses = sortAddressesByPriority(
          state.addresses.map((row) =>
            row.id === addressId
              ? ({
                  ...row,
                  address_line_1: input.address_line_1 ?? row.address_line_1,
                  address_line_2: input.address_line_2 ?? row.address_line_2,
                  city: input.city ?? row.city,
                  state: input.state ?? row.state,
                  postal_code: input.postal_code ?? row.postal_code,
                  country: input.country ?? row.country,
                  address_type: input.address_type ?? row.address_type,
                  is_default: input.is_default ?? row.is_default,
                  address_label: input.address_label ?? row.address_label,
                  updated_at: new Date().toISOString(),
                } as Address)
              : row,
          ),
        )
      })
      .addCase(updateAddress.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        replaceAddress(state, action.payload)
        state.isSaving = false
        state.lastFetch = Date.now()
      })
      .addCase(updateAddress.rejected, (state, action) => {
        restoreAddresses(state, takeRollback<AddressSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update address.'
        state.isSaving = false
      })

      // ---- delete (optimistic remove) ----
      .addCase(deleteAddress.pending, (state, action) => {
        state.isDeleting = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotAddresses(state))
        const addressId = action.meta.arg
        state.addresses = state.addresses.filter((row) => row.id !== addressId)
        if (state.selectedAddressId === addressId) state.selectedAddressId = null
      })
      .addCase(deleteAddress.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isDeleting = false
        state.lastFetch = Date.now()
      })
      .addCase(deleteAddress.rejected, (state, action) => {
        restoreAddresses(state, takeRollback<AddressSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to delete address.'
        state.isDeleting = false
      })

      // ---- set default (optimistic flag swap) ----
      .addCase(setDefaultAddress.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotAddresses(state))
        applyDefaultFlags(state, action.meta.arg)
      })
      .addCase(setDefaultAddress.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isSaving = false
        state.lastFetch = Date.now()
      })
      .addCase(setDefaultAddress.rejected, (state, action) => {
        restoreAddresses(state, takeRollback<AddressSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to set default address.'
        state.isSaving = false
      })
  },
})

export const addressReducer = addressSlice.reducer

export const {
  setAddressFormData,
  updateAddressField,
  loadFormFromAddress,
  resetAddressFormData,
  validateAddressForm,
  selectAddress,
  clearAddressSelection,
  setAddressError,
  clearAddressError,
  resetAddress,
} = addressSlice.actions

// ============= SELECTORS =============

export const selectAddresses = (state: { address: AddressState }) => state.address.addresses
export const selectAddressLoading = (state: { address: AddressState }) => state.address.isLoading
export const selectAddressSaving = (state: { address: AddressState }) => state.address.isSaving
export const selectAddressError = (state: { address: AddressState }) => state.address.error
export const selectAddressStats = (state: { address: AddressState }) => state.address.stats
export const selectSelectedAddressId = (state: { address: AddressState }) => state.address.selectedAddressId
export const selectAddressFormData = (state: { address: AddressState }) => state.address.formData
export const selectAddressValidation = (state: { address: AddressState }) => state.address.validation

export function selectAddressesByType(state: { address: AddressState }, addressType: AddressType): Address[] {
  return state.address.addresses.filter((row) => row.address_type === addressType)
}

export function selectSelectedAddress(state: { address: AddressState }): Address | null {
  const id = state.address.selectedAddressId
  if (!id) return null
  return state.address.addresses.find((row) => row.id === id) ?? null
}

export function selectDefaultAddressByType(
  state: { address: AddressState },
  addressType: AddressType,
): Address | null {
  return state.address.addresses.find((row) => row.address_type === addressType && row.is_default) ?? null
}
