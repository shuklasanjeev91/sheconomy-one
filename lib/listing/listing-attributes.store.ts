/**
 * Redux Toolkit slice for a listing's attributes.
 *
 * Separate slice with optimistic add / update / delete + rollback, wrapping
 * `listing-attributes.service`. Mirrors the variations store.
 */

import { createAsyncThunk, createSlice, current } from '@reduxjs/toolkit'

import type { AppDispatch } from '~/lib/store'

import * as attributesService from '~/lib/listing/listing-attributes.service'
import type {
  ListingAttribute,
  ListingAttributeInsert,
  ListingAttributeUpdate,
} from '~/lib/listing/listing.type'

type AttributesState = {
  byListingId: string | null
  items: ListingAttribute[]
  isLoading: boolean
  isMutating: boolean
  error: string | null
}

const initialState: AttributesState = {
  byListingId: null,
  items: [],
  isLoading: false,
  isMutating: false,
  error: null,
}

type ThunkConfig = { rejectValue: string; dispatch: AppDispatch }

const rollbackRegistry = new Map<string, ListingAttribute[]>()
const optimisticId = (requestId: string) => `temp-${requestId}`

export const loadAttributes = createAsyncThunk<
  { listingId: string; items: ListingAttribute[] },
  string,
  ThunkConfig
>('attributes/load', async (listingId, { rejectWithValue }) => {
  const response = await attributesService.getAttributes(listingId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load attributes.')
  return { listingId, items: response.data ?? [] }
})

export const addAttribute = createAsyncThunk<
  ListingAttribute,
  { listingId: string; attribute: Partial<ListingAttributeInsert>; userId?: string },
  ThunkConfig
>('attributes/add', async ({ listingId, attribute, userId }, { rejectWithValue }) => {
  const response = await attributesService.addAttribute(listingId, attribute, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to add attribute.')
  }
  return response.data
})

export const updateAttribute = createAsyncThunk<
  ListingAttribute,
  { attributeId: string; updates: ListingAttributeUpdate; userId?: string },
  ThunkConfig
>('attributes/update', async ({ attributeId, updates, userId }, { rejectWithValue }) => {
  const response = await attributesService.updateAttribute(attributeId, updates, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update attribute.')
  }
  return response.data
})

export const deleteAttribute = createAsyncThunk<
  string,
  { attributeId: string; userId?: string },
  ThunkConfig
>('attributes/delete', async ({ attributeId, userId }, { rejectWithValue }) => {
  const response = await attributesService.deleteAttribute(attributeId, userId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to delete attribute.')
  return attributeId
})

const attributesSlice = createSlice({
  name: 'listingAttributes',
  initialState,
  reducers: {
    resetAttributes: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadAttributes.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadAttributes.fulfilled, (state, action) => {
        state.byListingId = action.payload.listingId
        state.items = action.payload.items
        state.isLoading = false
      })
      .addCase(loadAttributes.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load attributes.'
        state.isLoading = false
      })

      .addCase(addAttribute.pending, (state, action) => {
        state.isMutating = true
        state.error = null
        state.items.push({
          ...(action.meta.arg.attribute as ListingAttribute),
          id: optimisticId(action.meta.requestId),
          listing_id: action.meta.arg.listingId,
        } as ListingAttribute)
      })
      .addCase(addAttribute.fulfilled, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.items = state.items.map((item) => (item.id === tempId ? action.payload : item))
        state.isMutating = false
      })
      .addCase(addAttribute.rejected, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.items = state.items.filter((item) => item.id !== tempId)
        state.error = action.payload ?? 'Failed to add attribute.'
        state.isMutating = false
      })

      .addCase(updateAttribute.pending, (state, action) => {
        state.isMutating = true
        state.error = null
        rollbackRegistry.set(action.meta.requestId, current(state.items))
        state.items = state.items.map((item) =>
          item.id === action.meta.arg.attributeId
            ? ({ ...item, ...action.meta.arg.updates } as ListingAttribute)
            : item,
        )
      })
      .addCase(updateAttribute.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.items = state.items.map((item) => (item.id === action.payload.id ? action.payload : item))
        state.isMutating = false
      })
      .addCase(updateAttribute.rejected, (state, action) => {
        const previous = rollbackRegistry.get(action.meta.requestId)
        if (previous) state.items = previous
        rollbackRegistry.delete(action.meta.requestId)
        state.error = action.payload ?? 'Failed to update attribute.'
        state.isMutating = false
      })

      .addCase(deleteAttribute.pending, (state, action) => {
        state.isMutating = true
        state.error = null
        rollbackRegistry.set(action.meta.requestId, current(state.items))
        state.items = state.items.filter((item) => item.id !== action.meta.arg.attributeId)
      })
      .addCase(deleteAttribute.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isMutating = false
      })
      .addCase(deleteAttribute.rejected, (state, action) => {
        const previous = rollbackRegistry.get(action.meta.requestId)
        if (previous) state.items = previous
        rollbackRegistry.delete(action.meta.requestId)
        state.error = action.payload ?? 'Failed to delete attribute.'
        state.isMutating = false
      })
  },
})

export const { resetAttributes } = attributesSlice.actions
export const listingAttributesReducer = attributesSlice.reducer
