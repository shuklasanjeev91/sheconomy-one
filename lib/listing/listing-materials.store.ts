/**
 * Redux Toolkit slice for a listing's materials.
 *
 * Separate slice with optimistic add / update / delete + rollback, wrapping
 * `listing-materials.service`. Mirrors the variations / attributes stores.
 */

import { createAsyncThunk, createSlice, current } from '@reduxjs/toolkit'

import type { AppDispatch } from '~/lib/store'

import * as materialsService from '~/lib/listing/listing-materials.service'
import type {
  ListingMaterial,
  ListingMaterialInsert,
  ListingMaterialUpdate,
} from '~/lib/listing/listing.type'

type MaterialsState = {
  byListingId: string | null
  items: ListingMaterial[]
  isLoading: boolean
  isMutating: boolean
  error: string | null
}

const initialState: MaterialsState = {
  byListingId: null,
  items: [],
  isLoading: false,
  isMutating: false,
  error: null,
}

type ThunkConfig = { rejectValue: string; dispatch: AppDispatch }

const rollbackRegistry = new Map<string, ListingMaterial[]>()
const optimisticId = (requestId: string) => `temp-${requestId}`

export const loadMaterials = createAsyncThunk<
  { listingId: string; items: ListingMaterial[] },
  string,
  ThunkConfig
>('materials/load', async (listingId, { rejectWithValue }) => {
  const response = await materialsService.getMaterials(listingId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load materials.')
  return { listingId, items: response.data ?? [] }
})

export const addMaterial = createAsyncThunk<
  ListingMaterial,
  { listingId: string; material: Partial<ListingMaterialInsert>; userId?: string },
  ThunkConfig
>('materials/add', async ({ listingId, material, userId }, { rejectWithValue }) => {
  const response = await materialsService.addMaterial(listingId, material, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to add material.')
  }
  return response.data
})

export const updateMaterial = createAsyncThunk<
  ListingMaterial,
  { materialId: string; updates: ListingMaterialUpdate; userId?: string },
  ThunkConfig
>('materials/update', async ({ materialId, updates, userId }, { rejectWithValue }) => {
  const response = await materialsService.updateMaterial(materialId, updates, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update material.')
  }
  return response.data
})

export const deleteMaterial = createAsyncThunk<
  string,
  { materialId: string; userId?: string },
  ThunkConfig
>('materials/delete', async ({ materialId, userId }, { rejectWithValue }) => {
  const response = await materialsService.deleteMaterial(materialId, userId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to delete material.')
  return materialId
})

const materialsSlice = createSlice({
  name: 'listingMaterials',
  initialState,
  reducers: {
    resetMaterials: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadMaterials.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadMaterials.fulfilled, (state, action) => {
        state.byListingId = action.payload.listingId
        state.items = action.payload.items
        state.isLoading = false
      })
      .addCase(loadMaterials.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load materials.'
        state.isLoading = false
      })

      .addCase(addMaterial.pending, (state, action) => {
        state.isMutating = true
        state.error = null
        state.items.push({
          ...(action.meta.arg.material as ListingMaterial),
          id: optimisticId(action.meta.requestId),
          listing_id: action.meta.arg.listingId,
        } as ListingMaterial)
      })
      .addCase(addMaterial.fulfilled, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.items = state.items.map((item) => (item.id === tempId ? action.payload : item))
        state.isMutating = false
      })
      .addCase(addMaterial.rejected, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.items = state.items.filter((item) => item.id !== tempId)
        state.error = action.payload ?? 'Failed to add material.'
        state.isMutating = false
      })

      .addCase(updateMaterial.pending, (state, action) => {
        state.isMutating = true
        state.error = null
        rollbackRegistry.set(action.meta.requestId, current(state.items))
        state.items = state.items.map((item) =>
          item.id === action.meta.arg.materialId
            ? ({ ...item, ...action.meta.arg.updates } as ListingMaterial)
            : item,
        )
      })
      .addCase(updateMaterial.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.items = state.items.map((item) => (item.id === action.payload.id ? action.payload : item))
        state.isMutating = false
      })
      .addCase(updateMaterial.rejected, (state, action) => {
        const previous = rollbackRegistry.get(action.meta.requestId)
        if (previous) state.items = previous
        rollbackRegistry.delete(action.meta.requestId)
        state.error = action.payload ?? 'Failed to update material.'
        state.isMutating = false
      })

      .addCase(deleteMaterial.pending, (state, action) => {
        state.isMutating = true
        state.error = null
        rollbackRegistry.set(action.meta.requestId, current(state.items))
        state.items = state.items.filter((item) => item.id !== action.meta.arg.materialId)
      })
      .addCase(deleteMaterial.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isMutating = false
      })
      .addCase(deleteMaterial.rejected, (state, action) => {
        const previous = rollbackRegistry.get(action.meta.requestId)
        if (previous) state.items = previous
        rollbackRegistry.delete(action.meta.requestId)
        state.error = action.payload ?? 'Failed to delete material.'
        state.isMutating = false
      })
  },
})

export const { resetMaterials } = materialsSlice.actions
export const listingMaterialsReducer = materialsSlice.reducer
