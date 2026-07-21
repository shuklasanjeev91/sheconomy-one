/**
 * Redux slice for shop-level shipping policies (delivery profiles + listing assignments).
 *
 * Ported from legacy Zustand `listingProfileStore.js` (delivery profile slice).
 */

import { createAsyncThunk, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch, RootState } from '~/lib/store'

import * as shippingPolicyService from './shipping-policy.service'
import type {
  AssignedShippingPolicy,
  DeleteShippingPolicyResult,
  ShippingPolicy,
  ShippingPolicyAccessContext,
  ShippingPolicyFormData,
  ShippingPolicyInput,
  ShippingPolicyValidationResult,
} from './shipping-policy.type'
import { EMPTY_SHIPPING_POLICY_FORM_DATA } from './shipping-policy.type'
import {
  applyDefaultShippingPolicyChange,
  buildOptimisticListingShippingAssignment,
  buildOptimisticShippingPolicy,
  removeListingShippingAssignment,
  removeShippingPolicyById,
  serializeShippingZones,
  shouldUseShippingPolicyCache,
  sortShippingPolicies,
  upsertListingShippingAssignment,
  upsertShippingPolicy,
} from './shipping-policy.utils'
import { validateShippingPolicyInput } from './shipping-policy.validation'

type ShippingPolicyState = {
  shopId: string | null
  shippingPolicies: ShippingPolicy[]
  listingShippingPolicies: Record<string, AssignedShippingPolicy[]>
  currentPolicyId: string | null
  lastFetch: number | null
  listingFetchTimes: Record<string, number>
  formData: ShippingPolicyFormData
  validation: ShippingPolicyValidationResult
  isLoading: boolean
  isSaving: boolean
  isDeleting: boolean
  isAssigning: boolean
  error: string | null
}

const initialState: ShippingPolicyState = {
  shopId: null,
  shippingPolicies: [],
  listingShippingPolicies: {},
  currentPolicyId: null,
  lastFetch: null,
  listingFetchTimes: {},
  formData: { ...EMPTY_SHIPPING_POLICY_FORM_DATA },
  validation: { isValid: true, errors: {}, fieldErrors: [] },
  isLoading: false,
  isSaving: false,
  isDeleting: false,
  isAssigning: false,
  error: null,
}

type ThunkConfig = { state: RootState; dispatch: AppDispatch; rejectValue: string }

type ShopPoliciesSnapshot = {
  shippingPolicies: ShippingPolicy[]
  currentPolicyId: string | null
  lastFetch: number | null
}

type ListingAssignmentsSnapshot = {
  listingShippingPolicies: Record<string, AssignedShippingPolicy[]>
  listingFetchTimes: Record<string, number>
}

const rollbackRegistry = new Map<string, ShopPoliciesSnapshot | ListingAssignmentsSnapshot>()

function stashRollback<T>(requestId: string, snapshot: T): void {
  rollbackRegistry.set(requestId, snapshot as ShopPoliciesSnapshot)
}

function takeRollback<T>(requestId: string): T | undefined {
  const snapshot = rollbackRegistry.get(requestId)
  rollbackRegistry.delete(requestId)
  return snapshot as T | undefined
}

function optimisticId(requestId: string): string {
  return `temp-${requestId}`
}

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

function snapshotShopPolicies(state: ShippingPolicyState): ShopPoliciesSnapshot {
  return {
    shippingPolicies: current(state.shippingPolicies),
    currentPolicyId: state.currentPolicyId,
    lastFetch: state.lastFetch,
  }
}

function restoreShopPolicies(state: ShippingPolicyState, snapshot?: ShopPoliciesSnapshot): void {
  if (!snapshot) return
  state.shippingPolicies = snapshot.shippingPolicies
  state.currentPolicyId = snapshot.currentPolicyId
  state.lastFetch = snapshot.lastFetch
}

function snapshotListingAssignments(state: ShippingPolicyState): ListingAssignmentsSnapshot {
  return {
    listingShippingPolicies: current(state.listingShippingPolicies),
    listingFetchTimes: { ...state.listingFetchTimes },
  }
}

function restoreListingAssignments(state: ShippingPolicyState, snapshot?: ListingAssignmentsSnapshot): void {
  if (!snapshot) return
  state.listingShippingPolicies = snapshot.listingShippingPolicies
  state.listingFetchTimes = snapshot.listingFetchTimes
}

export const loadShippingPolicies = createAsyncThunk<
  ShippingPolicy[],
  { shopId: string; forceRefresh?: boolean } | undefined,
  ThunkConfig
>('shippingPolicy/loadShippingPolicies', async (args, { getState, rejectWithValue }) => {
  const shopId = args?.shopId
  if (!shopId) return rejectWithValue('Shop ID is required.')

  const state = getState().shippingPolicy
  if (state.shopId === shopId && shouldUseShippingPolicyCache(state.lastFetch, args?.forceRefresh)) {
    return state.shippingPolicies
  }

  return resolveResponse(shippingPolicyService.getShippingPolicies(shopId), rejectWithValue)
})

export const createShippingPolicy = createAsyncThunk<
  ShippingPolicy,
  { shopId: string; input: ShippingPolicyInput; accessContext?: ShippingPolicyAccessContext },
  ThunkConfig
>('shippingPolicy/createShippingPolicy', ({ shopId, input, accessContext }, { rejectWithValue }) =>
  resolveResponse(
    shippingPolicyService.createShippingPolicy(shopId, input, accessContext),
    rejectWithValue,
  ) as Promise<ShippingPolicy>,
)

export const updateShippingPolicy = createAsyncThunk<
  ShippingPolicy,
  {
    policyId: string
    input: Partial<ShippingPolicyInput>
    accessContext?: ShippingPolicyAccessContext
  },
  ThunkConfig
>('shippingPolicy/updateShippingPolicy', ({ policyId, input, accessContext }, { rejectWithValue }) =>
  resolveResponse(
    shippingPolicyService.updateShippingPolicy(policyId, input, accessContext),
    rejectWithValue,
  ) as Promise<ShippingPolicy>,
)

export const deleteShippingPolicy = createAsyncThunk<
  DeleteShippingPolicyResult,
  { policyId: string; accessContext?: ShippingPolicyAccessContext },
  ThunkConfig
>('shippingPolicy/deleteShippingPolicy', ({ policyId, accessContext }, { rejectWithValue }) =>
  resolveResponse(
    shippingPolicyService.deleteShippingPolicy(policyId, accessContext),
    rejectWithValue,
  ) as Promise<DeleteShippingPolicyResult>,
)

export const loadListingShippingPolicies = createAsyncThunk<
  { listingId: string; policies: AssignedShippingPolicy[] },
  { listingId: string; forceRefresh?: boolean },
  ThunkConfig
>(
  'shippingPolicy/loadListingShippingPolicies',
  async ({ listingId, forceRefresh }, { getState, rejectWithValue }) => {
    const state = getState().shippingPolicy
    const lastFetch = state.listingFetchTimes[listingId]
    if (!forceRefresh && shouldUseShippingPolicyCache(lastFetch)) {
      return { listingId, policies: state.listingShippingPolicies[listingId] ?? [] }
    }

    const policies = (await resolveResponse(
      shippingPolicyService.getListingShippingPolicies(listingId),
      rejectWithValue,
    )) as AssignedShippingPolicy[]

    return { listingId, policies }
  },
)

export const assignShippingPolicyToListing = createAsyncThunk<
  { listingId: string; deliveryProfileId: string },
  {
    listingId: string
    deliveryProfileId: string
    accessContext?: ShippingPolicyAccessContext
  },
  ThunkConfig
>(
  'shippingPolicy/assignShippingPolicyToListing',
  ({ listingId, deliveryProfileId, accessContext }, { rejectWithValue }) =>
    resolveResponse(
      shippingPolicyService.assignShippingPolicyToListing(listingId, deliveryProfileId, accessContext),
      rejectWithValue,
    ) as Promise<{ listingId: string; deliveryProfileId: string }>,
)

export const removeShippingPolicyFromListing = createAsyncThunk<
  { listingId: string; deliveryProfileId: string },
  {
    listingId: string
    deliveryProfileId: string
    accessContext?: ShippingPolicyAccessContext
  },
  ThunkConfig
>(
  'shippingPolicy/removeShippingPolicyFromListing',
  ({ listingId, deliveryProfileId, accessContext }, { rejectWithValue }) =>
    resolveResponse(
      shippingPolicyService.removeShippingPolicyFromListing(listingId, deliveryProfileId, accessContext),
      rejectWithValue,
    ) as Promise<{ listingId: string; deliveryProfileId: string }>,
)

const shippingPolicySlice = createSlice({
  name: 'shippingPolicy',
  initialState,
  reducers: {
    setShippingPolicyShopId: (state, action: PayloadAction<string | null>) => {
      if (state.shopId !== action.payload) {
        state.shopId = action.payload
        state.shippingPolicies = []
        state.lastFetch = null
        state.currentPolicyId = null
      }
    },
    setCurrentShippingPolicyId: (state, action: PayloadAction<string | null>) => {
      state.currentPolicyId = action.payload
    },
    setShippingPolicyFormData: (state, action: PayloadAction<Partial<ShippingPolicyFormData>>) => {
      state.formData = { ...state.formData, ...action.payload }
    },
    loadShippingPolicyFormFromPolicy: (state, action: PayloadAction<ShippingPolicyFormData>) => {
      state.formData = { ...action.payload }
      state.validation = { isValid: true, errors: {}, fieldErrors: [] }
    },
    resetShippingPolicyFormData: (state) => {
      state.formData = { ...EMPTY_SHIPPING_POLICY_FORM_DATA }
      state.validation = { isValid: true, errors: {}, fieldErrors: [] }
    },
    validateShippingPolicyForm: (state) => {
      state.validation = validateShippingPolicyInput(state.formData)
    },
    setShippingPolicyError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    clearShippingPolicyError: (state) => {
      state.error = null
    },
    resetShippingPolicyState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadShippingPolicies.pending, (state, action) => {
        state.isLoading = true
        state.error = null
        if (action.meta.arg?.shopId) state.shopId = action.meta.arg.shopId
      })
      .addCase(loadShippingPolicies.fulfilled, (state, action) => {
        state.shippingPolicies = sortShippingPolicies(action.payload)
        state.isLoading = false
        state.lastFetch = Date.now()
      })
      .addCase(loadShippingPolicies.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload ?? 'Failed to load shipping policies.'
      })

      .addCase(createShippingPolicy.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotShopPolicies(state))
        const { shopId, input } = action.meta.arg
        state.shopId = shopId
        const optimistic = buildOptimisticShippingPolicy(action.meta.requestId, shopId, input)
        state.shippingPolicies = upsertShippingPolicy(state.shippingPolicies, optimistic)
        state.currentPolicyId = optimistic.id
      })
      .addCase(createShippingPolicy.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        const tempId = optimisticId(action.meta.requestId)
        state.shippingPolicies = upsertShippingPolicy(
          state.shippingPolicies.filter((row) => row.id !== tempId),
          action.payload,
        )
        state.currentPolicyId = action.payload.id
        state.isSaving = false
        state.lastFetch = Date.now()
      })
      .addCase(createShippingPolicy.rejected, (state, action) => {
        restoreShopPolicies(state, takeRollback<ShopPoliciesSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to create shipping policy.'
        state.isSaving = false
      })

      .addCase(updateShippingPolicy.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotShopPolicies(state))
        const { policyId, input } = action.meta.arg
        state.shippingPolicies = sortShippingPolicies(
          state.shippingPolicies.map((policy) => {
            if (policy.id !== policyId) return policy
            return {
              ...policy,
              ...(input.profile_name !== undefined ? { profile_name: input.profile_name.trim() } : {}),
              ...(input.is_default !== undefined ? { is_default: input.is_default } : {}),
              ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
              ...(input.processing_time_min !== undefined
                ? { processing_time_min: input.processing_time_min }
                : {}),
              ...(input.processing_time_max !== undefined
                ? { processing_time_max: input.processing_time_max }
                : {}),
              ...(input.free_shipping_threshold !== undefined
                ? { free_shipping_threshold: input.free_shipping_threshold }
                : {}),
              ...(input.shipping_rate_type !== undefined
                ? { shipping_rate_type: input.shipping_rate_type }
                : {}),
              ...(input.fixed_fee !== undefined ? { fixed_fee: input.fixed_fee } : {}),
              ...(input.shipping_zones !== undefined
                ? { shipping_zones: serializeShippingZones(input.shipping_zones) as ShippingPolicy['shipping_zones'] }
                : {}),
              ...(input.delivery_metadata !== undefined
                ? { delivery_metadata: input.delivery_metadata as ShippingPolicy['delivery_metadata'] }
                : {}),
              updated_at: new Date().toISOString(),
            }
          }),
        )
        if (input.is_default === true) {
          state.shippingPolicies = applyDefaultShippingPolicyChange(state.shippingPolicies, policyId, true)
        }
      })
      .addCase(updateShippingPolicy.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.shippingPolicies = upsertShippingPolicy(state.shippingPolicies, action.payload)
        state.isSaving = false
        state.lastFetch = Date.now()
      })
      .addCase(updateShippingPolicy.rejected, (state, action) => {
        restoreShopPolicies(state, takeRollback<ShopPoliciesSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update shipping policy.'
        state.isSaving = false
      })

      .addCase(deleteShippingPolicy.pending, (state, action) => {
        state.isDeleting = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotShopPolicies(state))
        const policyId = action.meta.arg.policyId
        state.shippingPolicies = removeShippingPolicyById(state.shippingPolicies, policyId)
        if (state.currentPolicyId === policyId) state.currentPolicyId = null
      })
      .addCase(deleteShippingPolicy.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isDeleting = false
        state.lastFetch = Date.now()
      })
      .addCase(deleteShippingPolicy.rejected, (state, action) => {
        restoreShopPolicies(state, takeRollback<ShopPoliciesSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to delete shipping policy.'
        state.isDeleting = false
      })

      .addCase(loadListingShippingPolicies.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadListingShippingPolicies.fulfilled, (state, action) => {
        const { listingId, policies } = action.payload
        state.listingShippingPolicies[listingId] = policies
        state.listingFetchTimes[listingId] = Date.now()
        state.isLoading = false
      })
      .addCase(loadListingShippingPolicies.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload ?? 'Failed to load listing shipping policies.'
      })

      .addCase(assignShippingPolicyToListing.pending, (state, action) => {
        state.isAssigning = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotListingAssignments(state))
        const { listingId, deliveryProfileId } = action.meta.arg
        const policy =
          state.shippingPolicies.find((row) => row.id === deliveryProfileId) ??
          Object.values(state.listingShippingPolicies)
            .flat()
            .find((row) => row.id === deliveryProfileId)
        if (!policy) return
        const current = state.listingShippingPolicies[listingId] ?? []
        state.listingShippingPolicies[listingId] = upsertListingShippingAssignment(
          current,
          buildOptimisticListingShippingAssignment(policy),
        )
      })
      .addCase(assignShippingPolicyToListing.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isAssigning = false
        state.listingFetchTimes[action.payload.listingId] = 0
      })
      .addCase(assignShippingPolicyToListing.rejected, (state, action) => {
        restoreListingAssignments(state, takeRollback<ListingAssignmentsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to assign shipping policy to listing.'
        state.isAssigning = false
      })

      .addCase(removeShippingPolicyFromListing.pending, (state, action) => {
        state.isAssigning = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotListingAssignments(state))
        const { listingId, deliveryProfileId } = action.meta.arg
        const current = state.listingShippingPolicies[listingId] ?? []
        state.listingShippingPolicies[listingId] = removeListingShippingAssignment(current, deliveryProfileId)
      })
      .addCase(removeShippingPolicyFromListing.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isAssigning = false
        state.listingFetchTimes[action.payload.listingId] = 0
      })
      .addCase(removeShippingPolicyFromListing.rejected, (state, action) => {
        restoreListingAssignments(state, takeRollback<ListingAssignmentsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to remove shipping policy from listing.'
        state.isAssigning = false
      })
  },
})

export const shippingPolicyReducer = shippingPolicySlice.reducer

export const {
  setShippingPolicyShopId,
  setCurrentShippingPolicyId,
  setShippingPolicyFormData,
  loadShippingPolicyFormFromPolicy,
  resetShippingPolicyFormData,
  validateShippingPolicyForm,
  setShippingPolicyError,
  clearShippingPolicyError,
  resetShippingPolicyState,
} = shippingPolicySlice.actions

export const selectShippingPolicies = (state: RootState) => state.shippingPolicy.shippingPolicies
export const selectShippingPolicyLoading = (state: RootState) => state.shippingPolicy.isLoading
export const selectShippingPolicySaving = (state: RootState) => state.shippingPolicy.isSaving
export const selectShippingPolicyDeleting = (state: RootState) => state.shippingPolicy.isDeleting
export const selectShippingPolicyAssigning = (state: RootState) => state.shippingPolicy.isAssigning
export const selectShippingPolicyError = (state: RootState) => state.shippingPolicy.error
export const selectShippingPolicyShopId = (state: RootState) => state.shippingPolicy.shopId
export const selectShippingPolicyFormData = (state: RootState) => state.shippingPolicy.formData
export const selectShippingPolicyValidation = (state: RootState) => state.shippingPolicy.validation

export function selectShippingPolicyById(state: RootState, policyId: string): ShippingPolicy | null {
  return state.shippingPolicy.shippingPolicies.find((row) => row.id === policyId) ?? null
}

export function selectCurrentShippingPolicy(state: RootState): ShippingPolicy | null {
  const id = state.shippingPolicy.currentPolicyId
  if (!id) return null
  return selectShippingPolicyById(state, id)
}

export function selectListingShippingPolicies(
  state: RootState,
  listingId: string,
): AssignedShippingPolicy[] {
  return state.shippingPolicy.listingShippingPolicies[listingId] ?? []
}

export function selectSortedShippingPolicies(state: RootState): ShippingPolicy[] {
  return sortShippingPolicies(state.shippingPolicy.shippingPolicies)
}
