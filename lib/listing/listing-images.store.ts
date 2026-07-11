/**
 * Redux Toolkit slice for a listing's images.
 *
 * Separate slice with optimistic add / update / delete / reorder + rollback,
 * wrapping `listing-images.service`. Uploads go through the moderation hook in
 * the service, so images are screened (once the NSFW classifier is registered)
 * before they ever reach the gallery.
 */

import { createAsyncThunk, createSlice, current } from '@reduxjs/toolkit'

import type { AppDispatch } from '~/lib/store'

import * as imagesService from './listing-images.service'
import type { ListingImage, ListingImageUpdate, ListingImageUpload } from './listing.type'

type ImagesState = {
  byListingId: string | null
  items: ListingImage[]
  isLoading: boolean
  isUploading: boolean
  isMutating: boolean
  error: string | null
}

const initialState: ImagesState = {
  byListingId: null,
  items: [],
  isLoading: false,
  isUploading: false,
  isMutating: false,
  error: null,
}

type ThunkConfig = { rejectValue: string; dispatch: AppDispatch }

const rollbackRegistry = new Map<string, ListingImage[]>()

export const loadImages = createAsyncThunk<
  { listingId: string; items: ListingImage[] },
  string,
  ThunkConfig
>('images/load', async (listingId, { rejectWithValue }) => {
  const response = await imagesService.getImages(listingId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load images.')
  return { listingId, items: response.data ?? [] }
})

/** Add an image that already has a public URL (no upload/moderation needed). */
export const addImage = createAsyncThunk<
  ListingImage,
  { listingId: string; imageUrl: string; isPrimary?: boolean; displayOrder?: number; userId?: string },
  ThunkConfig
>('images/add', async ({ listingId, imageUrl, isPrimary, displayOrder, userId }, { rejectWithValue }) => {
  const response = await imagesService.addImage(
    listingId,
    { image_url: imageUrl, is_primary: isPrimary ?? false, display_order: displayOrder ?? 0 },
    userId,
  )
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to add image.')
  }
  return response.data
})

/** Upload a picked file (moderated) then attach it to the listing. */
export const uploadImage = createAsyncThunk<
  ListingImage,
  {
    listingId: string
    file: ListingImageUpload
    isPrimary?: boolean
    displayOrder?: number
    altText?: string | null
    userId?: string
  },
  ThunkConfig
>('images/upload', async ({ listingId, file, isPrimary, displayOrder, altText, userId }, { rejectWithValue }) => {
  const response = await imagesService.uploadAndAttachImage(
    listingId,
    file,
    { is_primary: isPrimary ?? false, display_order: displayOrder ?? 0, alt_text: altText ?? null },
    userId,
  )
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to upload image.')
  }
  return response.data
})

export const updateImage = createAsyncThunk<
  ListingImage,
  { imageId: string; updates: ListingImageUpdate; userId?: string },
  ThunkConfig
>('images/update', async ({ imageId, updates, userId }, { rejectWithValue }) => {
  const response = await imagesService.updateImage(imageId, updates, userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to update image.')
  }
  return response.data
})

export const deleteImage = createAsyncThunk<
  string,
  { imageId: string; userId?: string },
  ThunkConfig
>('images/delete', async ({ imageId, userId }, { rejectWithValue }) => {
  const response = await imagesService.deleteImage(imageId, userId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to delete image.')
  return imageId
})

export const reorderImages = createAsyncThunk<
  { listingId: string; order: string[] },
  { listingId: string; order: string[]; userId?: string },
  ThunkConfig
>('images/reorder', async ({ listingId, order, userId }, { rejectWithValue }) => {
  const response = await imagesService.reorderImages(listingId, order, userId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to reorder images.')
  return { listingId, order }
})

const imagesSlice = createSlice({
  name: 'listingImages',
  initialState,
  reducers: {
    resetImages: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadImages.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadImages.fulfilled, (state, action) => {
        state.byListingId = action.payload.listingId
        state.items = action.payload.items
        state.isLoading = false
      })
      .addCase(loadImages.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load images.'
        state.isLoading = false
      })

      // ---- add by URL (optimistic) ----
      .addCase(addImage.pending, (state, action) => {
        state.isMutating = true
        state.error = null
        state.items.push({
          id: `temp-${action.meta.requestId}`,
          listing_id: action.meta.arg.listingId,
          image_url: action.meta.arg.imageUrl,
          is_primary: action.meta.arg.isPrimary ?? false,
          display_order: action.meta.arg.displayOrder ?? state.items.length,
        } as ListingImage)
      })
      .addCase(addImage.fulfilled, (state, action) => {
        const tempId = `temp-${action.meta.requestId}`
        state.items = state.items.map((item) => (item.id === tempId ? action.payload : item))
        state.isMutating = false
      })
      .addCase(addImage.rejected, (state, action) => {
        const tempId = `temp-${action.meta.requestId}`
        state.items = state.items.filter((item) => item.id !== tempId)
        state.error = action.payload ?? 'Failed to add image.'
        state.isMutating = false
      })

      // ---- upload (no optimistic row: we don't have a URL until it lands) ----
      .addCase(uploadImage.pending, (state) => {
        state.isUploading = true
        state.error = null
      })
      .addCase(uploadImage.fulfilled, (state, action) => {
        state.items.push(action.payload)
        state.isUploading = false
      })
      .addCase(uploadImage.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to upload image.'
        state.isUploading = false
      })

      // ---- update (optimistic) ----
      .addCase(updateImage.pending, (state, action) => {
        state.isMutating = true
        state.error = null
        rollbackRegistry.set(action.meta.requestId, current(state.items))
        state.items = state.items.map((item) =>
          item.id === action.meta.arg.imageId
            ? ({ ...item, ...action.meta.arg.updates } as ListingImage)
            : item,
        )
      })
      .addCase(updateImage.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.items = state.items.map((item) => (item.id === action.payload.id ? action.payload : item))
        state.isMutating = false
      })
      .addCase(updateImage.rejected, (state, action) => {
        const previous = rollbackRegistry.get(action.meta.requestId)
        if (previous) state.items = previous
        rollbackRegistry.delete(action.meta.requestId)
        state.error = action.payload ?? 'Failed to update image.'
        state.isMutating = false
      })

      // ---- delete (optimistic) ----
      .addCase(deleteImage.pending, (state, action) => {
        state.isMutating = true
        state.error = null
        rollbackRegistry.set(action.meta.requestId, current(state.items))
        state.items = state.items.filter((item) => item.id !== action.meta.arg.imageId)
      })
      .addCase(deleteImage.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isMutating = false
      })
      .addCase(deleteImage.rejected, (state, action) => {
        const previous = rollbackRegistry.get(action.meta.requestId)
        if (previous) state.items = previous
        rollbackRegistry.delete(action.meta.requestId)
        state.error = action.payload ?? 'Failed to delete image.'
        state.isMutating = false
      })

      // ---- reorder (optimistic) ----
      .addCase(reorderImages.pending, (state, action) => {
        state.error = null
        rollbackRegistry.set(action.meta.requestId, current(state.items))
        const orderIndex = new Map(action.meta.arg.order.map((id, index) => [id, index]))
        state.items = [...state.items]
          .map((item) => ({ ...item, display_order: orderIndex.get(item.id) ?? item.display_order }))
          .sort((a, b) => a.display_order - b.display_order)
      })
      .addCase(reorderImages.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(reorderImages.rejected, (state, action) => {
        const previous = rollbackRegistry.get(action.meta.requestId)
        if (previous) state.items = previous
        rollbackRegistry.delete(action.meta.requestId)
        state.error = action.payload ?? 'Failed to reorder images.'
      })
  },
})

export const { resetImages } = imagesSlice.actions
export const listingImagesReducer = imagesSlice.reducer
