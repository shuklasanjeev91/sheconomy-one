import { supabase } from '~/lib/supabase'

import {
  uploadBlobWithProgress,
  uploadFilesWithAggregateProgress,
  type UploadProgressHandler,
} from '~/lib/supabase/storage-upload-progress'

export type { UploadProgressHandler }

export const STORAGE_BUCKETS = {
  listingImages: 'listing-images',
  shopImages: 'shop-images',
  postImages: 'post-images',
  visualPreviews: 'visual-previews',
  categoriesMedia: 'categories_media',
  meetingBackgrounds: 'meeting-backgrounds',
} as const

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const CATEGORY_IMAGE_MAX_BYTES = 8 * 1024 * 1024
const CATEGORY_IMAGE_ACCEPTED_MIME = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export type UploadResult = {
  path: string
  publicUrl: string
}

/** Local file prepared for storage — prefer `data` (Uint8Array) over RN Blobs. */
export type StorageUploadFile = {
  data?: Uint8Array | ArrayBuffer
  arrayBuffer?: ArrayBuffer
  blob?: Blob
  mimeType: string
  fileName?: string
}

function resolveStorageUploadBody(
  file: StorageUploadFile,
): ArrayBuffer | Uint8Array | Blob | null {
  if (file.data instanceof Uint8Array && file.data.byteLength > 0) return file.data
  if (file.data instanceof ArrayBuffer && file.data.byteLength > 0) return file.data
  if (file.arrayBuffer && file.arrayBuffer.byteLength > 0) return file.arrayBuffer
  if (file.blob && file.blob.size > 0) return file.blob
  return null
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('webp')) return 'webp'
  if (mimeType.includes('gif')) return 'gif'
  if (mimeType.includes('mp4') || mimeType.includes('m4v')) return 'mp4'
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('quicktime') || mimeType.includes('mov')) return 'mov'
  if (mimeType.startsWith('video/')) return 'mp4'
  return 'jpg'
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10)
}

export function getStoragePublicUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadStorageObject(
  bucket: string,
  path: string,
  body: ArrayBuffer | Blob | File | Uint8Array,
  contentType: string,
  options?: { onProgress?: UploadProgressHandler; maxBytes?: number },
) {
  const size =
    body instanceof ArrayBuffer
      ? body.byteLength
      : body instanceof Uint8Array
        ? body.byteLength
        : (body as Blob).size
  const maxBytes = options?.maxBytes ?? MAX_IMAGE_BYTES
  if (size <= 0) {
    return { data: null, error: 'Image data is empty.' }
  }
  if (size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024))
    return {
      data: null,
      error: contentType.startsWith('video/')
        ? `Video must be ${mb} MB or smaller.`
        : `Image must be ${mb} MB or smaller.`,
    }
  }

  // Prefer raw bytes — RN Blob uploads can "succeed" with empty/corrupt objects.
  const uploadBody: ArrayBuffer | Uint8Array | Blob =
    body instanceof ArrayBuffer || body instanceof Uint8Array
      ? body
      : body

  const { error } = await uploadBlobWithProgress(bucket, path, uploadBody, contentType, {
    upsert: true,
    onProgress: options?.onProgress,
  })

  if (error) {
    return { data: null, error }
  }

  return {
    data: {
      path,
      publicUrl: getStoragePublicUrl(bucket, path),
    } satisfies UploadResult,
    error: null as string | null,
  }
}

export async function uploadListingImages(
  userId: string,
  shopId: string,
  files: StorageUploadFile[],
  options?: { onProgress?: UploadProgressHandler },
) {
  const uploads: UploadResult[] = []

  const { error: batchError } = await uploadFilesWithAggregateProgress(
    files,
    async (file, onFileProgress) => {
      const index = uploads.length
      const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
      const path = `${userId}/shops/${shopId}/listings/${Date.now()}-${index}-${randomSuffix()}.${ext}`
      const body = resolveStorageUploadBody(file)
      if (!body) {
        return { error: 'Image data is empty.' }
      }
      const { data, error } = await uploadStorageObject(
        STORAGE_BUCKETS.listingImages,
        path,
        body,
        file.mimeType,
        { onProgress: onFileProgress },
      )

      if (error || !data) {
        return { error: error ?? 'Upload failed.' }
      }

      uploads.push(data)
      return { error: null }
    },
    options?.onProgress,
  )

  if (batchError) {
    return { urls: uploads.map((item) => item.publicUrl), error: batchError }
  }

  return { urls: uploads.map((item) => item.publicUrl), error: null as string | null }
}

/**
 * Upload an event cover image to the public `post-images` bucket. The path is
 * prefixed with the user id so the bucket's owner-scoped update/delete policies
 * apply. Returns the public URL to store on the event / post row.
 */
export async function uploadEventCoverImage(
  userId: string,
  file: StorageUploadFile,
  options?: { onProgress?: UploadProgressHandler },
) {
  const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
  const path = `${userId}/events/${Date.now()}-${randomSuffix()}.${ext}`
  const body = resolveStorageUploadBody(file)
  if (!body) {
    return { data: null, error: 'Image data is empty.' }
  }

  return uploadStorageObject(STORAGE_BUCKETS.postImages, path, body, file.mimeType, options)
}

export async function uploadPostImages(
  userId: string,
  files: StorageUploadFile[],
  options?: { onProgress?: UploadProgressHandler },
) {
  const uploads: UploadResult[] = []

  const { error: batchError } = await uploadFilesWithAggregateProgress(
    files,
    async (file, onFileProgress) => {
      const index = uploads.length
      const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
      const path = `${userId}/posts/${Date.now()}-${index}-${randomSuffix()}.${ext}`
      const body = resolveStorageUploadBody(file)
      if (!body) {
        return { error: 'Image data is empty.' }
      }
      const { data, error } = await uploadStorageObject(
        STORAGE_BUCKETS.postImages,
        path,
        body,
        file.mimeType,
        { onProgress: onFileProgress },
      )

      if (error || !data) {
        return { error: error ?? 'Upload failed.' }
      }

      uploads.push(data)
      return { error: null }
    },
    options?.onProgress,
  )

  if (batchError) {
    return { urls: uploads.map((item) => item.publicUrl), error: batchError }
  }

  return { urls: uploads.map((item) => item.publicUrl), error: null as string | null }
}

/** Upload listing videos to the listing-images bucket (100 MB max each). */
export async function uploadListingVideos(
  userId: string,
  shopId: string,
  files: StorageUploadFile[],
  options?: { onProgress?: UploadProgressHandler },
) {
  const uploads: UploadResult[] = []

  const { error: batchError } = await uploadFilesWithAggregateProgress(
    files,
    async (file, onFileProgress) => {
      const index = uploads.length
      const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
      const path = `${userId}/shops/${shopId}/listings/videos/${Date.now()}-${index}-${randomSuffix()}.${ext}`
      const body = resolveStorageUploadBody(file)
      if (!body) {
        return { error: 'Video data is empty.' }
      }
      const { data, error } = await uploadStorageObject(
        STORAGE_BUCKETS.listingImages,
        path,
        body,
        file.mimeType,
        { onProgress: onFileProgress, maxBytes: MAX_VIDEO_BYTES },
      )

      if (error || !data) {
        return { error: error ?? 'Upload failed.' }
      }

      uploads.push(data)
      return { error: null }
    },
    options?.onProgress,
  )

  if (batchError) {
    return { urls: uploads.map((item) => item.publicUrl), error: batchError }
  }

  return { urls: uploads.map((item) => item.publicUrl), error: null as string | null }
}

/**
 * Upload post videos to the public `post-images` bucket (same owner-scoped policies).
 * Larger size limit than images (100 MB).
 */
export async function uploadPostVideos(
  userId: string,
  files: StorageUploadFile[],
  options?: { onProgress?: UploadProgressHandler },
) {
  const uploads: UploadResult[] = []

  const { error: batchError } = await uploadFilesWithAggregateProgress(
    files,
    async (file, onFileProgress) => {
      const index = uploads.length
      const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
      const path = `${userId}/posts/videos/${Date.now()}-${index}-${randomSuffix()}.${ext}`
      const body = resolveStorageUploadBody(file)
      if (!body) {
        return { error: 'Video data is empty.' }
      }
      const { data, error } = await uploadStorageObject(
        STORAGE_BUCKETS.postImages,
        path,
        body,
        file.mimeType,
        { onProgress: onFileProgress, maxBytes: MAX_VIDEO_BYTES },
      )

      if (error || !data) {
        return { error: error ?? 'Upload failed.' }
      }

      uploads.push(data)
      return { error: null }
    },
    options?.onProgress,
  )

  if (batchError) {
    return { urls: uploads.map((item) => item.publicUrl), error: batchError }
  }

  return { urls: uploads.map((item) => item.publicUrl), error: null as string | null }
}

/**
 * Upload a group chat avatar to the public `post-images` bucket. Path is
 * prefixed with the uploader's id to satisfy owner-scoped write policies.
 */
export async function uploadGroupAvatarImage(
  userId: string,
  file: StorageUploadFile,
  options?: { onProgress?: UploadProgressHandler },
) {
  const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
  const path = `${userId}/group-avatars/${Date.now()}-${randomSuffix()}.${ext}`
  const body = resolveStorageUploadBody(file)
  if (!body) return { data: null, error: 'Image data is empty.' }

  return uploadStorageObject(STORAGE_BUCKETS.postImages, path, body, file.mimeType, options)
}

export type ProfileMediaUpload = {
  /** Prefer arrayBuffer on native — RN Blobs can upload as empty objects. */
  arrayBuffer?: ArrayBuffer
  blob?: Blob
  mimeType: string
  fileName?: string
}

function resolveUploadBody(file: ProfileMediaUpload): ArrayBuffer | Blob | null {
  if (file.arrayBuffer && file.arrayBuffer.byteLength > 0) return file.arrayBuffer
  if (file.blob && (file.blob.size > 0 || typeof file.blob.arrayBuffer === 'function')) {
    return file.blob
  }
  return null
}

/**
 * Upload the signed-in user's profile picture to the public `post-images`
 * bucket. Path is prefixed with the user id to satisfy owner-scoped policies.
 */
export async function uploadProfileAvatarImage(
  userId: string,
  file: ProfileMediaUpload,
  options?: { onProgress?: UploadProgressHandler },
) {
  const body = resolveUploadBody(file)
  if (!body) return { data: null, error: 'Image data is empty.' }
  // Prefer mime-based extension so HEIC filenames don't label JPEG bytes as .heic.
  const ext = extensionForMime(file.mimeType)
  const path = `${userId}/avatar/${Date.now()}-${randomSuffix()}.${ext}`

  return uploadStorageObject(STORAGE_BUCKETS.postImages, path, body, file.mimeType, options)
}

/**
 * Upload the signed-in user's cover/banner image to the public `post-images`
 * bucket. Path is prefixed with the user id to satisfy owner-scoped policies.
 */
/** Upload return evidence / review photos under the buyer's owner-scoped prefix. */
export async function uploadOrderEvidenceImages(
  userId: string,
  orderId: string,
  files: StorageUploadFile[],
  kind: 'return' | 'review' | 'exchange' = 'return',
) {
  const uploads: UploadResult[] = []
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
    const path = `${userId}/orders/${orderId}/${kind}/${Date.now()}-${index}-${randomSuffix()}.${ext}`
    const body = resolveStorageUploadBody(file)
    if (!body) return { data: null as UploadResult[] | null, error: 'Image data is empty.' }
    const { data, error } = await uploadStorageObject(
      STORAGE_BUCKETS.postImages,
      path,
      body,
      file.mimeType,
    )
    if (error || !data) return { data: null as UploadResult[] | null, error: error ?? 'Upload failed' }
    uploads.push(data)
  }
  return { data: uploads, error: null as string | null }
}

export async function uploadProfileCoverImage(
  userId: string,
  file: ProfileMediaUpload,
  options?: { onProgress?: UploadProgressHandler },
) {
  const body = resolveUploadBody(file)
  if (!body) return { data: null, error: 'Image data is empty.' }
  const ext = extensionForMime(file.mimeType)
  const path = `${userId}/cover/${Date.now()}-${randomSuffix()}.${ext}`

  return uploadStorageObject(STORAGE_BUCKETS.postImages, path, body, file.mimeType, options)
}

export async function uploadShopLogoImage(
  userId: string,
  shopId: string,
  file: StorageUploadFile,
  options?: { onProgress?: UploadProgressHandler },
) {
  const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
  const path = `${userId}/shops/${shopId}/logo/${Date.now()}-${randomSuffix()}.${ext}`
  const body = resolveStorageUploadBody(file)
  if (!body) return { data: null, error: 'Image data is empty.' }

  return uploadStorageObject(STORAGE_BUCKETS.shopImages, path, body, file.mimeType, options)
}

/**
 * Upload curated category / subcategory artwork to the public `categories_media`
 * bucket. Returns the public URL to store on `categories.category_image_url`.
 */
export async function uploadCategoryImage(
  file: StorageUploadFile,
  options?: { categoryId?: string | null; onProgress?: UploadProgressHandler },
) {
  const mimeType = file.mimeType || 'image/jpeg'
  if (!(CATEGORY_IMAGE_ACCEPTED_MIME as readonly string[]).includes(mimeType)) {
    return {
      data: null,
      error: 'Only JPEG, PNG, WebP, or GIF images are accepted.',
    }
  }

  const body = resolveStorageUploadBody(file)
  const size =
    body instanceof ArrayBuffer
      ? body.byteLength
      : body instanceof Uint8Array
        ? body.byteLength
        : body?.size ?? 0
  if (!body || size <= 0) {
    return { data: null, error: 'Image data is empty.' }
  }
  if (size > CATEGORY_IMAGE_MAX_BYTES) {
    return { data: null, error: 'Image must be 8 MB or smaller.' }
  }

  const ext = file.fileName?.split('.').pop() ?? extensionForMime(mimeType)
  const folder = options?.categoryId?.trim() || 'unsaved'
  const path = `category_images/uploads/${folder}/${Date.now()}-${randomSuffix()}.${ext}`

  return uploadStorageObject(STORAGE_BUCKETS.categoriesMedia, path, body, mimeType, {
    onProgress: options?.onProgress,
    maxBytes: CATEGORY_IMAGE_MAX_BYTES,
  })
}

/** Upload a user selfie / room photo for visual preview (private bucket). */
export async function uploadVisualPreviewInput(
  userId: string,
  file: StorageUploadFile,
  options?: { onProgress?: UploadProgressHandler },
) {
  const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
  const path = `${userId}/inputs/${Date.now()}-${randomSuffix()}.${ext}`
  const body = resolveStorageUploadBody(file)
  if (!body) return { data: null, error: 'Image data is empty.' }

  return uploadStorageObject(STORAGE_BUCKETS.visualPreviews, path, body, file.mimeType, {
    ...options,
    maxBytes: 7 * 1024 * 1024,
  })
}


// ─── GST Document Upload ─────────────────────────────────────────────────────

/**
 * Upload a vendor's GST document to the private shop-gst-documents bucket.
 * Returns the storage PATH (not a public URL — use a signed URL to read it).
 * Path format: {userId}/shops/{shopId}/gst/{timestamp}-{random}.{ext}
 */
export async function uploadShopGstDocument(
  userId: string,
  shopId: string,
  file: { blob: Blob; mimeType: string; fileName?: string },
  options?: { onProgress?: UploadProgressHandler },
): Promise<{ data: UploadResult | null; error: string | null }> {
  const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
  const path = `${userId}/shops/${shopId}/gst/${Date.now()}-${randomSuffix()}.${ext}`

  const size = file.blob.size
  if (size <= 0) return { data: null, error: 'Document file is empty.' }
  if (size > 10 * 1024 * 1024) return { data: null, error: 'GST document must be 10 MB or smaller.' }

  const { error } = await uploadBlobWithProgress(
    'shop-gst-documents',
    path,
    file.blob,
    file.mimeType,
    { upsert: true, onProgress: options?.onProgress },
  )

  if (error) return { data: null, error }

  // Note: bucket is PRIVATE — no public URL. Return path only.
  return {
    data: {
      path,
      publicUrl: '', // intentionally empty — use signed URL
    },
    error: null,
  }
}

/**
 * Get a short-lived signed URL to view a vendor's GST document.
 * Use this in admin review screens or vendor settings.
 * Expires in 1 hour by default.
 */
export async function getGstDocumentSignedUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('shop-gst-documents')
    .createSignedUrl(path, expiresInSeconds)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
