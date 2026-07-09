import { supabaseConfig } from '~/lib/supabase/env'

type ImageMetadata = {
  bucket?: string | null
  storage_path?: string | null
  public_url?: string | null
}

const LISTING_IMAGE_BUCKETS = [
  'listing-images',
  'post-media',
  'listings',
  'shop-media',
  'sheconomy-logo',
] as const

function getSupabaseOrigin() {
  return supabaseConfig.url.replace(/\/$/, '')
}

function buildStoragePublicUrl(bucket: string, objectPath: string) {
  const origin = getSupabaseOrigin()
  if (!origin || !objectPath) return null

  const normalizedPath = objectPath
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

  return `${origin}/storage/v1/object/public/${bucket}/${normalizedPath}`
}

function guessBucketFromPath(path: string) {
  const normalized = path.replace(/^\/+/, '')
  for (const bucket of LISTING_IMAGE_BUCKETS) {
    if (normalized.startsWith(`${bucket}/`)) {
      return {
        bucket,
        objectPath: normalized.slice(bucket.length + 1),
      }
    }
  }

  if (normalized.startsWith('listings/')) {
    return { bucket: 'post-media', objectPath: normalized }
  }

  return { bucket: 'listing-images', objectPath: normalized }
}

function resolveStorageLikePath(path: string): string | null {
  const trimmed = path.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('/storage/v1/object/public/')) {
    const origin = getSupabaseOrigin()
    return origin ? `${origin}${trimmed}` : trimmed
  }

  if (trimmed.startsWith('storage/v1/object/public/')) {
    const origin = getSupabaseOrigin()
    return origin ? `${origin}/${trimmed}` : trimmed
  }

  const { bucket, objectPath } = guessBucketFromPath(trimmed)
  return buildStoragePublicUrl(bucket, objectPath)
}

/** Returns a displayable image URL or null when the value is missing or unusable. */
export function normalizeListingImageUrl(
  url: string | null | undefined,
  metadata?: unknown,
): string | null {
  const meta = (metadata ?? null) as ImageMetadata | null

  if (meta?.public_url?.trim()) {
    const fromMetaPublic = normalizeListingImageUrl(meta.public_url)
    if (fromMetaPublic) return fromMetaPublic
  }

  if (meta?.storage_path?.trim()) {
    const bucket = meta.bucket?.trim() || guessBucketFromPath(meta.storage_path).bucket
    const objectPath = meta.storage_path.replace(/^\/+/, '')
    const fromMetaPath = buildStoragePublicUrl(bucket, objectPath)
    if (fromMetaPath) return fromMetaPath
  }

  if (!url?.trim()) return null

  const value = url.trim()

  // Incomplete storage paths saved without a file name.
  if (/\/listing-images\/?$/.test(value)) return null
  if (/\/post-media\/listings\/?$/.test(value)) return null

  if (/^https?:\/\//i.test(value)) return value

  if (value.startsWith('//')) {
    return `https:${value}`
  }

  const resolvedPath = resolveStorageLikePath(value)
  if (resolvedPath) return resolvedPath

  if (/\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i.test(value)) {
    for (const bucket of LISTING_IMAGE_BUCKETS) {
      const candidate = buildStoragePublicUrl(bucket, value)
      if (candidate) return candidate
    }
  }

  return value
}

/** Deduplicated, normalized image URLs for a listing tile or gallery. */
export function getListingImageUrls(
  imageUrls: string[] | null | undefined,
  fallbackUrl?: string | null,
): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const candidate of [...(imageUrls ?? []), fallbackUrl]) {
    const normalized = normalizeListingImageUrl(candidate)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

export function hasListingImages(
  imageUrls: string[] | null | undefined,
  fallbackUrl?: string | null,
): boolean {
  return getListingImageUrls(imageUrls, fallbackUrl).length > 0
}
