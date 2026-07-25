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
} as const

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024

export type UploadResult = {
  path: string
  publicUrl: string
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
  files: Array<{ blob: Blob; mimeType: string; fileName?: string }>,
  options?: { onProgress?: UploadProgressHandler },
) {
  const uploads: UploadResult[] = []

  const { error: batchError } = await uploadFilesWithAggregateProgress(
    files,
    async (file, onFileProgress) => {
      const index = uploads.length
      const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
      const path = `${userId}/shops/${shopId}/listings/${Date.now()}-${index}-${randomSuffix()}.${ext}`
      const { data, error } = await uploadStorageObject(
        STORAGE_BUCKETS.listingImages,
        path,
        file.blob,
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
  file: { blob: Blob; mimeType: string; fileName?: string },
  options?: { onProgress?: UploadProgressHandler },
) {
  const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
  const path = `${userId}/events/${Date.now()}-${randomSuffix()}.${ext}`

  return uploadStorageObject(STORAGE_BUCKETS.postImages, path, file.blob, file.mimeType, options)
}

export async function uploadPostImages(
  userId: string,
  files: Array<{ blob: Blob; mimeType: string; fileName?: string }>,
  options?: { onProgress?: UploadProgressHandler },
) {
  const uploads: UploadResult[] = []

  const { error: batchError } = await uploadFilesWithAggregateProgress(
    files,
    async (file, onFileProgress) => {
      const index = uploads.length
      const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
      const path = `${userId}/posts/${Date.now()}-${index}-${randomSuffix()}.${ext}`
      const { data, error } = await uploadStorageObject(
        STORAGE_BUCKETS.postImages,
        path,
        file.blob,
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
  files: Array<{ blob: Blob; mimeType: string; fileName?: string }>,
  options?: { onProgress?: UploadProgressHandler },
) {
  const uploads: UploadResult[] = []

  const { error: batchError } = await uploadFilesWithAggregateProgress(
    files,
    async (file, onFileProgress) => {
      const index = uploads.length
      const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
      const path = `${userId}/shops/${shopId}/listings/videos/${Date.now()}-${index}-${randomSuffix()}.${ext}`
      const { data, error } = await uploadStorageObject(
        STORAGE_BUCKETS.listingImages,
        path,
        file.blob,
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
  files: Array<{ blob: Blob; mimeType: string; fileName?: string }>,
  options?: { onProgress?: UploadProgressHandler },
) {
  const uploads: UploadResult[] = []

  const { error: batchError } = await uploadFilesWithAggregateProgress(
    files,
    async (file, onFileProgress) => {
      const index = uploads.length
      const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
      const path = `${userId}/posts/videos/${Date.now()}-${index}-${randomSuffix()}.${ext}`
      const { data, error } = await uploadStorageObject(
        STORAGE_BUCKETS.postImages,
        path,
        file.blob,
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
  file: { blob: Blob; mimeType: string; fileName?: string },
  options?: { onProgress?: UploadProgressHandler },
) {
  const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
  const path = `${userId}/group-avatars/${Date.now()}-${randomSuffix()}.${ext}`

  return uploadStorageObject(STORAGE_BUCKETS.postImages, path, file.blob, file.mimeType, options)
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
  files: Array<{ blob: Blob; mimeType: string; fileName?: string }>,
  kind: 'return' | 'review' = 'return',
) {
  const uploads: UploadResult[] = []
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
    const path = `${userId}/orders/${orderId}/${kind}/${Date.now()}-${index}-${randomSuffix()}.${ext}`
    const { data, error } = await uploadStorageObject(
      STORAGE_BUCKETS.postImages,
      path,
      file.blob,
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
  file: { blob: Blob; mimeType: string; fileName?: string },
  options?: { onProgress?: UploadProgressHandler },
) {
  const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
  const path = `${userId}/shops/${shopId}/logo/${Date.now()}-${randomSuffix()}.${ext}`

  return uploadStorageObject(STORAGE_BUCKETS.shopImages, path, file.blob, file.mimeType, options)
}

/** Upload a user selfie / room photo for Gemini visual preview (private bucket). */
export async function uploadVisualPreviewInput(
  userId: string,
  file: { blob: Blob; mimeType: string; fileName?: string },
  options?: { onProgress?: UploadProgressHandler },
) {
  const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
  const path = `${userId}/inputs/${Date.now()}-${randomSuffix()}.${ext}`

  return uploadStorageObject(
    STORAGE_BUCKETS.visualPreviews,
    path,
    file.blob,
    file.mimeType,
    { ...options, maxBytes: 7 * 1024 * 1024 },
  )
}
