import { supabase } from '~/lib/supabase'

export const STORAGE_BUCKETS = {
  listingImages: 'listing-images',
  shopImages: 'shop-images',
  postImages: 'post-images',
} as const

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export type UploadResult = {
  path: string
  publicUrl: string
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('webp')) return 'webp'
  if (mimeType.includes('gif')) return 'gif'
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
  body: ArrayBuffer | Blob | File,
  contentType: string,
) {
  const size = body instanceof ArrayBuffer ? body.byteLength : (body as Blob).size
  if (size > MAX_IMAGE_BYTES) {
    return { data: null, error: 'Image must be 8 MB or smaller.' }
  }

  const { data, error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: true,
    cacheControl: '3600',
  })

  if (error) {
    return { data: null, error: error.message }
  }

  return {
    data: {
      path: data.path,
      publicUrl: getStoragePublicUrl(bucket, data.path),
    } satisfies UploadResult,
    error: null as string | null,
  }
}

export async function uploadListingImages(
  userId: string,
  shopId: string,
  files: Array<{ blob: Blob; mimeType: string; fileName?: string }>,
) {
  const uploads: UploadResult[] = []

  for (const [index, file] of files.entries()) {
    const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
    const path = `${userId}/shops/${shopId}/listings/${Date.now()}-${index}-${randomSuffix()}.${ext}`
    const { data, error } = await uploadStorageObject(
      STORAGE_BUCKETS.listingImages,
      path,
      file.blob,
      file.mimeType,
    )

    if (error || !data) {
      return { urls: uploads.map((item) => item.publicUrl), error: error ?? 'Upload failed.' }
    }

    uploads.push(data)
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
) {
  const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
  const path = `${userId}/events/${Date.now()}-${randomSuffix()}.${ext}`

  return uploadStorageObject(STORAGE_BUCKETS.postImages, path, file.blob, file.mimeType)
}

/**
 * Upload a group chat avatar to the public `post-images` bucket. Path is
 * prefixed with the uploader's id to satisfy owner-scoped write policies.
 */
export async function uploadGroupAvatarImage(
  userId: string,
  file: { blob: Blob; mimeType: string; fileName?: string },
) {
  const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
  const path = `${userId}/group-avatars/${Date.now()}-${randomSuffix()}.${ext}`

  return uploadStorageObject(STORAGE_BUCKETS.postImages, path, file.blob, file.mimeType)
}

/**
 * Upload the signed-in user's profile picture to the public `post-images`
 * bucket. Path is prefixed with the user id to satisfy owner-scoped policies.
 */
export async function uploadProfileAvatarImage(
  userId: string,
  file: { blob: Blob; mimeType: string; fileName?: string },
) {
  const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
  const path = `${userId}/avatar/${Date.now()}-${randomSuffix()}.${ext}`

  return uploadStorageObject(STORAGE_BUCKETS.postImages, path, file.blob, file.mimeType)
}

/**
 * Upload the signed-in user's cover/banner image to the public `post-images`
 * bucket. Path is prefixed with the user id to satisfy owner-scoped policies.
 */
export async function uploadProfileCoverImage(
  userId: string,
  file: { blob: Blob; mimeType: string; fileName?: string },
) {
  const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
  const path = `${userId}/cover/${Date.now()}-${randomSuffix()}.${ext}`

  return uploadStorageObject(STORAGE_BUCKETS.postImages, path, file.blob, file.mimeType)
}

export async function uploadShopLogoImage(
  userId: string,
  shopId: string,
  file: { blob: Blob; mimeType: string; fileName?: string },
) {
  const ext = file.fileName?.split('.').pop() ?? extensionForMime(file.mimeType)
  const path = `${userId}/shops/${shopId}/logo/${Date.now()}-${randomSuffix()}.${ext}`

  return uploadStorageObject(STORAGE_BUCKETS.shopImages, path, file.blob, file.mimeType)
}
