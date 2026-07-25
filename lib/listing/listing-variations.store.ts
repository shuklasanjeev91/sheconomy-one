/**
 * Redux Toolkit slice for a listing's variations.
 *
 * Kept separate from the main listing slice (as requested) so screens that only
 * edit variations don't re-render on unrelated listing changes. Optimistic
 * add / update / delete with rollback, wrapping `listing-variations.service`.
 */

import { createAsyncThunk, createSlice, current } from '@reduxjs/toolkit'

import type { AppDispatch } from '~/lib/store'

import * as variationsService from '~/lib/listing/listing-variations.service'
import type {
  ListingVariation,
  ListingVariationInsert,
  ListingVariationUpdate,
} from '~/lib/listing/listing.type'

type VariationsState = {
  byListingId: string | null
  items: ListingVariation[]
  isLoading: boolean
  isMutating: boolean
  error: string | null
}

const initialState: VariationsState = {
  byListingId: null,
  items: [],
  isLoading: false,
  isMutating: false,
  error: null,
}

type ThunkConfig = { rejectValue: string; dispatch: AppDispatch }

const rollbackRegistry = new Map<string, ListingVariation[]>()
const optimisticId = (requestId: string) => `temp-${requestId}`

export const loadVariations = createAsyncThunk<
  { listingId: string; items: ListingVariation[] },
  string,
  ThunkConfig
>('variations/load', async (listingId, { rejectWithValue }) => {
  const response = await variationsService.getVariations(listingId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load variations.')
  return { listingId, items: response.data ?? [] }
})

export const addVariation = createAsyncThunk<
  ListingVariation,
  { listingId: string; variation: Partial<ListingVariationInsert>; userId?: string },
  ThunkConfig
>('variations/add', async ({ listingId, variation, userId }, { rejectWithValue }) => {
  const response = await variationsService.addVariation(listingId, variation, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to add variation.')
  }
  return response.data
})

export const updateVariation = createAsyncThunk<
  ListingVariation,
  { variationId: string; updates: ListingVariationUpdate; userId?: string },
  ThunkConfig
>('variations/update', async ({ variationId, updates, userId }, { rejectWithValue }) => {
  const response = await variationsService.updateVariation(variationId, updates, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update variation.')
  }
  return response.data
})

export const deleteVariation = createAsyncThunk<
  string,
  { variationId: string; userId?: string },
  ThunkConfig
>('variations/delete', async ({ variationId, userId }, { rejectWithValue }) => {
  const response = await variationsService.deleteVariation(variationId, userId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to delete variation.')
  return variationId
})

const variationsSlice = createSlice({
  name: 'listingVariations',
  initialState,
  reducers: {
    resetVariations: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadVariations.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadVariations.fulfilled, (state, action) => {
        state.byListingId = action.payload.listingId
        state.items = action.payload.items
        state.isLoading = false
      })
      .addCase(loadVariations.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load variations.'
        state.isLoading = false
      })

      .addCase(addVariation.pending, (state, action) => {
        state.isMutating = true
        state.error = null
        state.items.push({
          ...(action.meta.arg.variation as ListingVariation),
          id: optimisticId(action.meta.requestId),
          listing_id: action.meta.arg.listingId,
        } as ListingVariation)
      })
      .addCase(addVariation.fulfilled, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.items = state.items.map((item) => (item.id === tempId ? action.payload : item))
        state.isMutating = false
      })
      .addCase(addVariation.rejected, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.items = state.items.filter((item) => item.id !== tempId)
        state.error = action.payload ?? 'Failed to add variation.'
        state.isMutating = false
      })

      .addCase(updateVariation.pending, (state, action) => {
        state.isMutating = true
        state.error = null
        rollbackRegistry.set(action.meta.requestId, current(state.items))
        state.items = state.items.map((item) =>
          item.id === action.meta.arg.variationId
            ? ({ ...item, ...action.meta.arg.updates } as ListingVariation)
            : item,
        )
      })
      .addCase(updateVariation.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.items = state.items.map((item) => (item.id === action.payload.id ? action.payload : item))
        state.isMutating = false
      })
      .addCase(updateVariation.rejected, (state, action) => {
        const previous = rollbackRegistry.get(action.meta.requestId)
        if (previous) state.items = previous
        rollbackRegistry.delete(action.meta.requestId)
        state.error = action.payload ?? 'Failed to update variation.'
        state.isMutating = false
      })

      .addCase(deleteVariation.pending, (state, action) => {
        state.isMutating = true
        state.error = null
        rollbackRegistry.set(action.meta.requestId, current(state.items))
        state.items = state.items.filter((item) => item.id !== action.meta.arg.variationId)
      })
      .addCase(deleteVariation.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isMutating = false
      })
      .addCase(deleteVariation.rejected, (state, action) => {
        const previous = rollbackRegistry.get(action.meta.requestId)
        if (previous) state.items = previous
        rollbackRegistry.delete(action.meta.requestId)
        state.error = action.payload ?? 'Failed to delete variation.'
        state.isMutating = false
      })
  },
})

export const { resetVariations } = variationsSlice.actions
export const listingVariationsReducer = variationsSlice.reducer
