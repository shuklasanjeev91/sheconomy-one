/**
 * Listing images service — upload, moderation, and CRUD for `listing_images`.
 *
 * Ported from the legacy `listingImagesService`, with two deliberate changes:
 *
 *  1. Storage IO is delegated to `~/lib/supabase/storage-upload` (no duplicate
 *     bucket logic).
 *  2. NSFW moderation is a **pluggable hook**. On web the service lazily loads
 *     the migrated TensorFlow classifier (`lib/nsfwjs`) and screens every
 *     upload through it — mirroring how the legacy `listingImagesService` used
 *     the classifier directly. A custom moderator can be swapped in with
 *     `registerImageModerator(...)`. On native, uploads use the server
 *     `moderate_image` ai-assist path. If moderation cannot run, uploads are
 *     blocked (fail closed). No image is uploaded before it is moderated.
 */

import { supabase } from '~/lib/supabase'
import {
  STORAGE_BUCKETS,
  getStoragePublicUrl,
  uploadStorageObject,
  type UploadProgressHandler,
} from '~/lib/supabase/storage-upload'
import { uploadFilesWithAggregateProgress } from '~/lib/supabase/storage-upload-progress'

import { fail, ok, resolveUserId, verifyListingManageAccess } from './listing.access'
import { createListingError, LISTING_ERROR_CODES } from './listing.errors'
import { LISTING_IMAGE_CONSTRAINTS } from './listing.type'
import type {
  ListingImage,
  ListingImageInsert,
  ListingImageUpdate,
  ListingImageUpload,
  ListingServiceResponse,
} from './listing.type'

// ============= MODERATION HOOK =============

export type ImageModerationVerdict = 'approved' | 'rejected'

export type ImageModerationResult = {
  verdict: ImageModerationVerdict
  /** Human-readable reasons when rejected (e.g. ["porn", "hentai"]). */
  reasons: string[]
  confidence?: number
}

/**
 * Contract the (future) NSFW classifier implements. Register it once with
 * `registerImageModerator`; the images service will then screen every upload.
 */
export type ImageModerator = {
  analyze: (image: Blob | File) => Promise<ImageModerationResult>
  analyzeBatch?: (
    images: (Blob | File)[],
    onProgress?: (progress: { processed: number; total: number }) => void,
  ) => Promise<{ results: ImageModerationResult[] }>
}

let activeModerator: ImageModerator | null = null
let defaultModeratorPromise: Promise<ImageModerator | null> | null = null

/** Plug in (or clear) the image moderator. Overrides the default web classifier. */
export function registerImageModerator(moderator: ImageModerator | null): void {
  activeModerator = moderator
}

export function getImageModerator(): ImageModerator | null {
  return activeModerator
}

/**
 * Resolve the moderator to use: a registered one wins; otherwise, on web, we
 * lazily load the migrated NSFW classifier adapter (kept out of native bundles
 * and out of the module graph until the first upload). Cached after first load.
 */
async function resolveModerator(): Promise<ImageModerator | null> {
  if (activeModerator) return activeModerator

  if (!defaultModeratorPromise) {
    defaultModeratorPromise = import('../nsfwjs/listing-image-moderator')
      .then((mod) => mod.nsfwImageModerator)
      .catch(() => null)
  }
  return defaultModeratorPromise
}

/**
 * Screen a batch of images. Resolves when all are approved; throws a
 * `ListingError(NSFW_CONTENT)` if any is rejected. If no moderator is available
 * we reject the upload (fail closed) so native and web share one safety policy.
 */
async function moderateImages(
  images: (Blob | File)[],
  onProgress?: (progress: { processed: number; total: number }) => void,
): Promise<void> {
  if (images.length === 0) return
  const moderator = await resolveModerator()
  if (!moderator) {
    throw createListingError(
      LISTING_ERROR_CODES.NSFW_CONTENT,
      'Image moderation is unavailable. Please try again.',
    )
  }

  let results: ImageModerationResult[]
  if (images.length > 1 && moderator.analyzeBatch) {
    results = (await moderator.analyzeBatch(images, onProgress)).results
  } else {
    results = []
    for (let i = 0; i < images.length; i += 1) {
      results.push(await moderator.analyze(images[i]))
      onProgress?.({ processed: i + 1, total: images.length })
    }
  }

  const rejected = results.filter((result) => result.verdict === 'rejected')
  if (rejected.length > 0) {
    const reasons = [...new Set(rejected.flatMap((result) => result.reasons))].filter(Boolean)
    const detail = reasons.length ? ` (${reasons.join(', ')})` : ''
    throw createListingError(
      LISTING_ERROR_CODES.NSFW_CONTENT,
      `${rejected.length} image${rejected.length > 1 ? 's were' : ' was'} flagged as inappropriate${detail}.`,
    )
  }
}

// ============= VALIDATION =============

function validateUploadFile(file: ListingImageUpload): string | null {
  const size = file.blob instanceof Blob ? file.blob.size : 0
  if (size > LISTING_IMAGE_CONSTRAINTS.MAX_SIZE_BYTES) {
    return 'Image is too large. Maximum size is 10 MB.'
  }
  if (
    file.mimeType &&
    !(LISTING_IMAGE_CONSTRAINTS.ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimeType)
  ) {
    return 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.'
  }
  return null
}

function extensionForUpload(file: ListingImageUpload): string {
  if (file.fileName?.includes('.')) return file.fileName.split('.').pop() as string
  if (file.mimeType.includes('png')) return 'png'
  if (file.mimeType.includes('webp')) return 'webp'
  if (file.mimeType.includes('gif')) return 'gif'
  return 'jpg'
}

// ============= UPLOAD =============

export type UploadedImage = {
  url: string
  path: string
  fileSize: number
  fileType: string
}

/**
 * Moderate then upload a single image to the listing-images bucket.
 * Returns the public URL + storage path (not yet linked to a listing row).
 */
export async function uploadImage(
  file: ListingImageUpload,
  listingId?: string | null,
  options?: { onProgress?: UploadProgressHandler },
): Promise<ListingServiceResponse<UploadedImage>> {
  const validationError = validateUploadFile(file)
  if (validationError) return fail(validationError)

  try {
    await moderateImages([file.blob])

    const ext = extensionForUpload(file)
    const prefix = listingId ? listingId : 'temp'
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`

    const { data, error } = await uploadStorageObject(
      STORAGE_BUCKETS.listingImages,
      path,
      file.blob,
      file.mimeType,
      { onProgress: options?.onProgress },
    )
    if (error || !data) return fail(error ?? 'Upload failed.')

    return ok<UploadedImage>({
      url: data.publicUrl,
      path: data.path,
      fileSize: file.blob instanceof Blob ? file.blob.size : 0,
      fileType: file.mimeType,
    })
  } catch (error) {
    return fail(error)
  }
}

/**
 * Moderate ALL images first, then upload them, rolling back already-uploaded
 * files if a later upload fails. Mirrors the legacy `batchUploadImages`.
 */
export async function batchUploadImages(
  files: ListingImageUpload[],
  listingId?: string | null,
  options?: {
    onModerationProgress?: (progress: { processed: number; total: number }) => void
    onUploadProgress?: UploadProgressHandler
  },
): Promise<ListingServiceResponse<UploadedImage[]>> {
  if (!files.length) return fail('No files provided for upload.')

  const invalid = files.map(validateUploadFile).find(Boolean)
  if (invalid) return fail(invalid)

  try {
    await moderateImages(
      files.map((file) => file.blob),
      options?.onModerationProgress,
    )

    const uploaded: UploadedImage[] = []
    const uploadedPaths: string[] = []

    const { error: batchError } = await uploadFilesWithAggregateProgress(
      files,
      async (file, onFileProgress) => {
        const result = await uploadImage(file, listingId, { onProgress: onFileProgress })
        if (!result.success || !result.data) {
          return { error: result.error ?? 'Upload failed.' }
        }
        uploaded.push(result.data)
        uploadedPaths.push(result.data.path)
        return { error: null }
      },
      options?.onUploadProgress,
    )

    if (batchError) {
      if (uploadedPaths.length) await rollbackUploadedImages(uploadedPaths)
      return fail(batchError)
    }

    return ok(uploaded)
  } catch (error) {
    return fail(error)
  }
}

/** Best-effort removal of uploaded objects (used to undo a partial batch). */
export async function rollbackUploadedImages(paths: string[]): Promise<void> {
  if (!paths.length) return
  try {
    await supabase.storage.from(STORAGE_BUCKETS.listingImages).remove(paths)
  } catch {
    // Rollback is best-effort; nothing else to do here.
  }
}

// ============= CRUD =============

export async function getImages(
  listingId: string,
): Promise<ListingServiceResponse<ListingImage[]>> {
  if (!listingId) return ok([])

  try {
    const { data, error } = await supabase
      .from('listing_images')
      .select('*')
      .eq('listing_id', listingId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function addImage(
  listingId: string,
  image: Partial<ListingImageInsert> & { image_url: string },
  userId?: string | null,
): Promise<ListingServiceResponse<ListingImage>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!image.image_url) return fail('Image URL is required.')

  try {
    const access = await verifyListingManageAccess(listingId, id)
    if (!access.success) return fail(access.error)

    const payload: ListingImageInsert = {
      listing_id: listingId,
      image_url: image.image_url,
      alt_text: image.alt_text ?? null,
      display_order: Number(image.display_order) || 0,
      is_primary: image.is_primary ?? false,
      file_size: image.file_size ?? null,
      width: image.width ?? null,
      height: image.height ?? null,
      image_type: image.image_type ?? null,
    }

    const { data, error } = await supabase
      .from('listing_images')
      .insert(payload)
      .select('*')
      .single()

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

/**
 * Upload a file and immediately attach it to a listing (moderate → upload →
 * insert row). Convenience for the common "add one image" flow.
 */
export async function uploadAndAttachImage(
  listingId: string,
  file: ListingImageUpload,
  options: { alt_text?: string | null; is_primary?: boolean; display_order?: number } = {},
  userId?: string | null,
): Promise<ListingServiceResponse<ListingImage>> {
  const uploadResult = await uploadImage(file, listingId)
  if (!uploadResult.success || !uploadResult.data) return fail(uploadResult.error)

  return addImage(
    listingId,
    {
      image_url: uploadResult.data.url,
      alt_text: options.alt_text ?? null,
      is_primary: options.is_primary ?? false,
      display_order: options.display_order ?? 0,
      file_size: uploadResult.data.fileSize,
      image_type: uploadResult.data.fileType,
    },
    userId,
  )
}

export async function updateImage(
  imageId: string,
  updates: ListingImageUpdate,
  userId?: string | null,
): Promise<ListingServiceResponse<ListingImage>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const { data: owned } = await supabase
      .from('listing_images')
      .select('id, listing_id')
      .eq('id', imageId)
      .maybeSingle()
    if (!owned) return fail('Image not found or access denied')

    const access = await verifyListingManageAccess(owned.listing_id, id)
    if (!access.success) return fail(access.error)

    const { data, error } = await supabase
      .from('listing_images')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', imageId)
      .select('*')
      .single()

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteImage(
  imageId: string,
  userId?: string | null,
): Promise<ListingServiceResponse<{ id: string }>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const { data: owned } = await supabase
      .from('listing_images')
      .select('id, listing_id')
      .eq('id', imageId)
      .maybeSingle()
    if (!owned) return fail('Image not found or access denied')

    const access = await verifyListingManageAccess(owned.listing_id, id)
    if (!access.success) return fail(access.error)

    const { error } = await supabase.from('listing_images').delete().eq('id', imageId)
    if (error) return fail(error)
    return ok({ id: imageId })
  } catch (error) {
    return fail(error)
  }
}

/** Persist a new display order (index in the array becomes `display_order`). */
export async function reorderImages(
  listingId: string,
  orderedImageIds: string[],
  userId?: string | null,
): Promise<ListingServiceResponse<{ listingId: string }>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    const access = await verifyListingManageAccess(listingId, id)
    if (!access.success) return fail(access.error)

    const results = await Promise.all(
      orderedImageIds.map((imageId, index) =>
        supabase
          .from('listing_images')
          .update({ display_order: index })
          .eq('id', imageId)
          .eq('listing_id', listingId),
      ),
    )

    const firstError = results.find((result) => result.error)?.error
    if (firstError) return fail(firstError)
    return ok({ listingId })
  } catch (error) {
    return fail(error)
  }
}
