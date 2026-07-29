/**
 * Redux slice for return policy management (shop policies + listing assignments).
 *
 * Ported from legacy Zustand `listingProfileStore.js` (return policy slice).
 * Supports vendor, admin, and shared flows via optional `accessContext` on thunks.
 */

import { createAsyncThunk, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch, RootState } from '~/lib/store'

import * as returnPolicyService from '~/lib/return-policy/return-policy.service'
import type {
  AssignedReturnPolicy,
  DeleteReturnPolicyResult,
  ReturnPolicy,
  ReturnPolicyAccessContext,
  ReturnPolicyFormData,
  ReturnPolicyInput,
  ReturnPolicyValidationResult,
} from '~/lib/return-policy/return-policy.type'
import { EMPTY_RETURN_POLICY_FORM_DATA } from '~/lib/return-policy/return-policy.type'
import {
  applyDefaultPolicyChange,
  buildOptimisticListingAssignment,
  buildOptimisticReturnPolicy,
  removeListingAssignment,
  removeReturnPolicyById,
  shouldUseReturnPolicyCache,
  sortReturnPolicies,
  upsertListingAssignment,
  upsertReturnPolicy,
} from '~/lib/return-policy/return-policy.utils'
import { validateReturnPolicyInput } from '~/lib/return-policy/return-policy.validation'

// ============= STATE =============

type ReturnPolicyState = {
  shopId: string | null
  returnPolicies: ReturnPolicy[]
  listingReturnPolicies: Record<string, AssignedReturnPolicy[]>
  currentPolicyId: string | null
  lastFetch: number | null
  listingFetchTimes: Record<string, number>
  formData: ReturnPolicyFormData
  validation: ReturnPolicyValidationResult
  isLoading: boolean
  isSaving: boolean
  isDeleting: boolean
  isAssigning: boolean
  error: string | null
}

const initialState: ReturnPolicyState = {
  shopId: null,
  returnPolicies: [],
  listingReturnPolicies: {},
  currentPolicyId: null,
  lastFetch: null,
  listingFetchTimes: {},
  formData: { ...EMPTY_RETURN_POLICY_FORM_DATA },
  validation: { isValid: true, errors: {}, fieldErrors: [] },
  isLoading: false,
  isSaving: false,
  isDeleting: false,
  isAssigning: false,
  error: null,
}

type ThunkConfig = { state: RootState; dispatch: AppDispatch; rejectValue: string }

type ShopPoliciesSnapshot = {
  returnPolicies: ReturnPolicy[]
  currentPolicyId: string | null
  lastFetch: number | null
}

type ListingAssignmentsSnapshot = {
  listingReturnPolicies: Record<string, AssignedReturnPolicy[]>
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

function snapshotShopPolicies(state: ReturnPolicyState): ShopPoliciesSnapshot {
  return {
    returnPolicies: current(state.returnPolicies),
    currentPolicyId: state.currentPolicyId,
    lastFetch: state.lastFetch,
  }
}

function restoreShopPolicies(state: ReturnPolicyState, snapshot?: ShopPoliciesSnapshot): void {
  if (!snapshot) return
  state.returnPolicies = snapshot.returnPolicies
  state.currentPolicyId = snapshot.currentPolicyId
  state.lastFetch = snapshot.lastFetch
}

function snapshotListingAssignments(state: ReturnPolicyState): ListingAssignmentsSnapshot {
  return {
    listingReturnPolicies: current(state.listingReturnPolicies),
    listingFetchTimes: { ...state.listingFetchTimes },
  }
}

function restoreListingAssignments(state: ReturnPolicyState, snapshot?: ListingAssignmentsSnapshot): void {
  if (!snapshot) return
  state.listingReturnPolicies = snapshot.listingReturnPolicies
  state.listingFetchTimes = snapshot.listingFetchTimes
}

// ============= THUNKS =============

export const loadReturnPolicies = createAsyncThunk<
  ReturnPolicy[],
  { shopId: string; forceRefresh?: boolean } | undefined,
  ThunkConfig
>('returnPolicy/loadReturnPolicies', async (args, { getState, rejectWithValue }) => {
  const shopId = args?.shopId
  if (!shopId) return rejectWithValue('Shop ID is required.')

  const state = getState().returnPolicy
  if (
    state.shopId === shopId &&
    shouldUseReturnPolicyCache(state.lastFetch, args?.forceRefresh)
  ) {
    return state.returnPolicies
  }

  return resolveResponse(returnPolicyService.getReturnPolicies(shopId), rejectWithValue)
})

export const createReturnPolicy = createAsyncThunk<
  ReturnPolicy,
  { shopId: string; input: ReturnPolicyInput; accessContext?: ReturnPolicyAccessContext },
  ThunkConfig
>('returnPolicy/createReturnPolicy', ({ shopId, input, accessContext }, { rejectWithValue }) =>
  resolveResponse(
    returnPolicyService.createReturnPolicy(shopId, input, accessContext),
    rejectWithValue,
  ) as Promise<ReturnPolicy>,
)

export const updateReturnPolicy = createAsyncThunk<
  ReturnPolicy,
  {
    policyId: string
    input: Partial<ReturnPolicyInput>
    accessContext?: ReturnPolicyAccessContext
  },
  ThunkConfig
>('returnPolicy/updateReturnPolicy', ({ policyId, input, accessContext }, { rejectWithValue }) =>
  resolveResponse(
    returnPolicyService.updateReturnPolicy(policyId, input, accessContext),
    rejectWithValue,
  ) as Promise<ReturnPolicy>,
)

export const deleteReturnPolicy = createAsyncThunk<
  DeleteReturnPolicyResult,
  { policyId: string; accessContext?: ReturnPolicyAccessContext },
  ThunkConfig
>('returnPolicy/deleteReturnPolicy', ({ policyId, accessContext }, { rejectWithValue }) =>
  resolveResponse(
    returnPolicyService.deleteReturnPolicy(policyId, accessContext),
    rejectWithValue,
  ) as Promise<DeleteReturnPolicyResult>,
)

export const loadListingReturnPolicies = createAsyncThunk<
  { listingId: string; policies: AssignedReturnPolicy[] },
  { listingId: string; forceRefresh?: boolean },
  ThunkConfig
>('returnPolicy/loadListingReturnPolicies', async ({ listingId, forceRefresh }, { getState, rejectWithValue }) => {
  const state = getState().returnPolicy
  const lastFetch = state.listingFetchTimes[listingId]
  if (!forceRefresh && shouldUseReturnPolicyCache(lastFetch)) {
    return {
      listingId,
      policies: state.listingReturnPolicies[listingId] ?? [],
    }
  }

  const policies = await resolveResponse(
    returnPolicyService.getListingReturnPolicies(listingId),
    rejectWithValue,
  ) as AssignedReturnPolicy[]

  return { listingId, policies }
})

export const assignReturnPolicyToListing = createAsyncThunk<
  { listingId: string; returnPolicyId: string },
  {
    listingId: string
    returnPolicyId: string
    accessContext?: ReturnPolicyAccessContext
  },
  ThunkConfig
>(
  'returnPolicy/assignReturnPolicyToListing',
  ({ listingId, returnPolicyId, accessContext }, { rejectWithValue }) =>
    resolveResponse(
      returnPolicyService.assignReturnPolicyToListing(listingId, returnPolicyId, accessContext),
      rejectWithValue,
    ) as Promise<{ listingId: string; returnPolicyId: string }>,
)

export const removeReturnPolicyFromListing = createAsyncThunk<
  { listingId: string; returnPolicyId: string },
  {
    listingId: string
    returnPolicyId: string
    accessContext?: ReturnPolicyAccessContext
  },
  ThunkConfig
>(
  'returnPolicy/removeReturnPolicyFromListing',
  ({ listingId, returnPolicyId, accessContext }, { rejectWithValue }) =>
    resolveResponse(
      returnPolicyService.removeReturnPolicyFromListing(listingId, returnPolicyId, accessContext),
      rejectWithValue,
    ) as Promise<{ listingId: string; returnPolicyId: string }>,
)

// ============= SLICE =============

const returnPolicySlice = createSlice({
  name: 'returnPolicy',
  initialState,
  reducers: {
    setReturnPolicyShopId: (state, action: PayloadAction<string | null>) => {
      if (state.shopId !== action.payload) {
        state.shopId = action.payload
        state.returnPolicies = []
        state.lastFetch = null
        state.currentPolicyId = null
      }
    },
    setCurrentReturnPolicyId: (state, action: PayloadAction<string | null>) => {
      state.currentPolicyId = action.payload
    },
    setReturnPolicyFormData: (state, action: PayloadAction<Partial<ReturnPolicyFormData>>) => {
      state.formData = { ...state.formData, ...action.payload }
    },
    loadReturnPolicyFormFromPolicy: (state, action: PayloadAction<ReturnPolicyFormData>) => {
      state.formData = { ...action.payload }
      state.validation = { isValid: true, errors: {}, fieldErrors: [] }
    },
    resetReturnPolicyFormData: (state) => {
      state.formData = { ...EMPTY_RETURN_POLICY_FORM_DATA }
      state.validation = { isValid: true, errors: {}, fieldErrors: [] }
    },
    validateReturnPolicyForm: (state) => {
      state.validation = validateReturnPolicyInput(state.formData)
    },
    setReturnPolicyError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    clearReturnPolicyError: (state) => {
      state.error = null
    },
    resetReturnPolicyState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // ---- load shop policies ----
      .addCase(loadReturnPolicies.pending, (state, action) => {
        state.isLoading = true
        state.error = null
        if (action.meta.arg?.shopId) state.shopId = action.meta.arg.shopId
      })
      .addCase(loadReturnPolicies.fulfilled, (state, action) => {
        state.returnPolicies = sortReturnPolicies(action.payload)
        state.isLoading = false
        state.lastFetch = Date.now()
      })
      .addCase(loadReturnPolicies.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload ?? 'Failed to load return policies.'
      })

      // ---- create (optimistic insert) ----
      .addCase(createReturnPolicy.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotShopPolicies(state))

        const { shopId, input } = action.meta.arg
        state.shopId = shopId
        const optimistic = buildOptimisticReturnPolicy(action.meta.requestId, shopId, input)
        state.returnPolicies = upsertReturnPolicy(state.returnPolicies, optimistic)
        state.currentPolicyId = optimistic.id
      })
      .addCase(createReturnPolicy.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        const tempId = optimisticId(action.meta.requestId)
        state.returnPolicies = upsertReturnPolicy(
          state.returnPolicies.filter((row) => row.id !== tempId),
          action.payload,
        )
        state.currentPolicyId = action.payload.id
        state.isSaving = false
        state.lastFetch = Date.now()
      })
      .addCase(createReturnPolicy.rejected, (state, action) => {
        restoreShopPolicies(state, takeRollback<ShopPoliciesSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to create return policy.'
        state.isSaving = false
      })

      // ---- update (optimistic merge) ----
      .addCase(updateReturnPolicy.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotShopPolicies(state))

        const { policyId, input } = action.meta.arg
        state.returnPolicies = sortReturnPolicies(
          state.returnPolicies.map((policy) =>
            policy.id === policyId
              ? {
                  ...policy,
                  ...input,
                  policy_name: input.policy_name?.trim() ?? policy.policy_name,
                  condition_description:
                    input.condition_description === undefined
                      ? policy.condition_description
                      : input.condition_description?.trim() || null,
                  policy_details:
                    input.policy_details === undefined
                      ? policy.policy_details
                      : input.policy_details?.trim() || null,
                  updated_at: new Date().toISOString(),
                }
              : policy,
          ),
        )

        if (input.is_default === true) {
          state.returnPolicies = applyDefaultPolicyChange(state.returnPolicies, policyId, true)
        }
      })
      .addCase(updateReturnPolicy.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.returnPolicies = upsertReturnPolicy(state.returnPolicies, action.payload)
        if (state.currentPolicyId === action.payload.id) {
          state.currentPolicyId = action.payload.id
        }
        state.isSaving = false
        state.lastFetch = Date.now()
      })
      .addCase(updateReturnPolicy.rejected, (state, action) => {
        restoreShopPolicies(state, takeRollback<ShopPoliciesSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to update return policy.'
        state.isSaving = false
      })

      // ---- delete (optimistic remove) ----
      .addCase(deleteReturnPolicy.pending, (state, action) => {
        state.isDeleting = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotShopPolicies(state))

        const policyId = action.meta.arg.policyId
        state.returnPolicies = removeReturnPolicyById(state.returnPolicies, policyId)
        if (state.currentPolicyId === policyId) state.currentPolicyId = null
      })
      .addCase(deleteReturnPolicy.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isDeleting = false
        state.lastFetch = Date.now()
      })
      .addCase(deleteReturnPolicy.rejected, (state, action) => {
        restoreShopPolicies(state, takeRollback<ShopPoliciesSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to delete return policy.'
        state.isDeleting = false
      })

      // ---- listing assignments: load ----
      .addCase(loadListingReturnPolicies.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadListingReturnPolicies.fulfilled, (state, action) => {
        const { listingId, policies } = action.payload
        state.listingReturnPolicies[listingId] = policies
        state.listingFetchTimes[listingId] = Date.now()
        state.isLoading = false
      })
      .addCase(loadListingReturnPolicies.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload ?? 'Failed to load listing return policies.'
      })

      // ---- assign (optimistic) ----
      .addCase(assignReturnPolicyToListing.pending, (state, action) => {
        state.isAssigning = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotListingAssignments(state))

        const { listingId, returnPolicyId } = action.meta.arg
        const policy =
          state.returnPolicies.find((row) => row.id === returnPolicyId) ??
          Object.values(state.listingReturnPolicies)
            .flat()
            .find((row) => row.id === returnPolicyId)

        if (!policy) return

        const current = state.listingReturnPolicies[listingId] ?? []
        state.listingReturnPolicies[listingId] = upsertListingAssignment(
          current,
          buildOptimisticListingAssignment(policy),
        )
      })
      .addCase(assignReturnPolicyToListing.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isAssigning = false
        state.listingFetchTimes[action.payload.listingId] = 0
      })
      .addCase(assignReturnPolicyToListing.rejected, (state, action) => {
        restoreListingAssignments(state, takeRollback<ListingAssignmentsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to assign return policy to listing.'
        state.isAssigning = false
      })

      // ---- remove assignment (optimistic) ----
      .addCase(removeReturnPolicyFromListing.pending, (state, action) => {
        state.isAssigning = true
        state.error = null
        stashRollback(action.meta.requestId, snapshotListingAssignments(state))

        const { listingId, returnPolicyId } = action.meta.arg
        const current = state.listingReturnPolicies[listingId] ?? []
        state.listingReturnPolicies[listingId] = removeListingAssignment(current, returnPolicyId)
      })
      .addCase(removeReturnPolicyFromListing.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isAssigning = false
        state.listingFetchTimes[action.payload.listingId] = 0
      })
      .addCase(removeReturnPolicyFromListing.rejected, (state, action) => {
        restoreListingAssignments(state, takeRollback<ListingAssignmentsSnapshot>(action.meta.requestId))
        state.error = action.payload ?? 'Failed to remove return policy from listing.'
        state.isAssigning = false
      })
  },
})

export const returnPolicyReducer = returnPolicySlice.reducer

export const {
  setReturnPolicyShopId,
  setCurrentReturnPolicyId,
  setReturnPolicyFormData,
  loadReturnPolicyFormFromPolicy,
  resetReturnPolicyFormData,
  validateReturnPolicyForm,
  setReturnPolicyError,
  clearReturnPolicyError,
  resetReturnPolicyState,
} = returnPolicySlice.actions

// ============= SELECTORS =============

export const selectReturnPolicies = (state: RootState) => state.returnPolicy.returnPolicies
export const selectReturnPolicyLoading = (state: RootState) => state.returnPolicy.isLoading
export const selectReturnPolicySaving = (state: RootState) => state.returnPolicy.isSaving
export const selectReturnPolicyDeleting = (state: RootState) => state.returnPolicy.isDeleting
export const selectReturnPolicyAssigning = (state: RootState) => state.returnPolicy.isAssigning
export const selectReturnPolicyError = (state: RootState) => state.returnPolicy.error
export const selectReturnPolicyShopId = (state: RootState) => state.returnPolicy.shopId
export const selectReturnPolicyFormData = (state: RootState) => state.returnPolicy.formData
export const selectReturnPolicyValidation = (state: RootState) => state.returnPolicy.validation

export function selectReturnPolicyById(state: RootState, policyId: string): ReturnPolicy | null {
  return state.returnPolicy.returnPolicies.find((row) => row.id === policyId) ?? null
}

export function selectCurrentReturnPolicy(state: RootState): ReturnPolicy | null {
  const id = state.returnPolicy.currentPolicyId
  if (!id) return null
  return selectReturnPolicyById(state, id)
}

export function selectListingReturnPolicies(
  state: RootState,
  listingId: string,
): AssignedReturnPolicy[] {
  return state.returnPolicy.listingReturnPolicies[listingId] ?? []
}

export function selectSortedReturnPolicies(state: RootState): ReturnPolicy[] {
  return sortReturnPolicies(state.returnPolicy.returnPolicies)
}
