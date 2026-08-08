/**
 * listing-image-url.ts
 *
 * Resolves any listing image URL to a displayable URL.
 *
 * Rules:
 *  - Supabase Storage URLs → optional render/image resize when display size known
 *  - Cloudfront CDN paths  → rewrite to Supabase render when sizing (same objects)
 *  - ibb.co / dropbox.com  → route through image-proxy Edge Function
 *  - Other allowed hosts   → direct
 *  - Known broken URLs     → placeholder SVG
 *  - Empty / null          → placeholder SVG
 *
 * Works on both Web (Vite) and Native (Expo) — no Next.js dependency.
 */

import {
  LISTING_IMAGE_PROXY_REQUIRED_HOSTS,
  isAllowedListingImageHost,
} from '~/lib/config/listing-image-import-rules'

// ─── Constants ───────────────────────────────────────────────────────────────

const SUPABASE_PROJECT_URL = 'https://zsaqrrzwygzwrlzgymxk.supabase.co'

/** Your Supabase Edge Function proxy URL */
const IMAGE_PROXY_FUNCTION_URL = `${SUPABASE_PROJECT_URL}/functions/v1/image-proxy`

/** Cloudfront CDN for uploaded listing images */
const CLOUDFRONT_CDN_HOST = 'dfasp73o8frrg.cloudfront.net'
const CLOUDFRONT_CDN_URL = `https://${CLOUDFRONT_CDN_HOST}/listing-images`

const OBJECT_PUBLIC_PREFIX = '/storage/v1/object/public/'
const RENDER_PUBLIC_PREFIX = '/storage/v1/render/image/public/'

/** Default edge for marketplace listing cards (~2x a ~280–320px tile). */
export const LISTING_CARD_IMAGE_EDGE = 640

/** Default edge for product detail hero / gallery. */
export const LISTING_GALLERY_IMAGE_EDGE = 1200

const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">' +
  '<rect width="400" height="400" fill="#f3f4f6"/>' +
  '<path d="M120 250l60-80 60 80 40-50 60 80H120z" fill="#e5e7eb"/>' +
  '<circle cx="170" cy="150" r="20" fill="#e5e7eb"/>' +
  '</svg>'

export const LISTING_IMAGE_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(PLACEHOLDER_SVG)}`

export type ListingImageDisplaySize = {
  /** Target CSS/layout width in px (retina already accounted for by caller). */
  width?: number
  height?: number
  /** 1–100, default 72 */
  quality?: number
  resize?: 'cover' | 'contain' | 'fill'
}

// ─── Module-level broken image cache ─────────────────────────────────────────

const BROKEN_IMAGE_CACHE = new Set<string>()

export function markListingImageBroken(url: string): void {
  if (url) BROKEN_IMAGE_CACHE.add(url)
}

export function isListingImageBroken(url: string): boolean {
  return BROKEN_IMAGE_CACHE.has(url)
}

// ─── URL classification ───────────────────────────────────────────────────────

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

function isLocalAsset(value: string): boolean {
  return value.startsWith('/') || value.startsWith('data:') || value.startsWith('blob:')
}

function needsProxy(hostname: string): boolean {
  return LISTING_IMAGE_PROXY_REQUIRED_HOSTS.has(hostname.toLowerCase().trim())
}

function buildProxyUrl(originalUrl: string): string {
  return `${IMAGE_PROXY_FUNCTION_URL}?url=${encodeURIComponent(originalUrl)}`
}

function clampEdge(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value) || value <= 0) return undefined
  // Cap so we never request absurd transforms for huge layout numbers.
  return Math.min(Math.round(value), 2048)
}

function applyRenderSearchParams(url: URL, size: ListingImageDisplaySize): void {
  const width = clampEdge(size.width)
  const height = clampEdge(size.height)
  if (width) url.searchParams.set('width', String(width))
  if (height) url.searchParams.set('height', String(height))
  url.searchParams.set('resize', size.resize ?? 'cover')
  url.searchParams.set('quality', String(size.quality ?? 72))
}

function buildSupabaseRenderUrl(bucketAndPath: string, size: ListingImageDisplaySize): string {
  const normalized = bucketAndPath.replace(/^\/+/, '')
  const url = new URL(`${SUPABASE_PROJECT_URL}${RENDER_PUBLIC_PREFIX}${normalized}`)
  applyRenderSearchParams(url, size)
  return url.toString()
}

/**
 * Downscale Supabase (and mirrored CloudFront) listing images for cards/galleries.
 * Leaves proxies, data URIs, and non-Supabase hosts untouched.
 */
export function withListingImageDisplaySize(
  url: string,
  size?: ListingImageDisplaySize | null,
): string {
  if (!url || !size) return url
  if (!clampEdge(size.width) && !clampEdge(size.height)) return url
  if (url.startsWith('data:') || url.startsWith('blob:')) return url
  if (url.includes('/functions/v1/image-proxy')) return url

  try {
    const parsed = new URL(url)

    if (parsed.pathname.includes(RENDER_PUBLIC_PREFIX)) {
      applyRenderSearchParams(parsed, size)
      return parsed.toString()
    }

    if (parsed.pathname.includes(OBJECT_PUBLIC_PREFIX)) {
      parsed.pathname = parsed.pathname.replace(OBJECT_PUBLIC_PREFIX, RENDER_PUBLIC_PREFIX)
      // Drop any leftover object query noise.
      parsed.search = ''
      applyRenderSearchParams(parsed, size)
      return parsed.toString()
    }

    // Only rewrite CloudFront paths that actually mirror Supabase `listing-images/`.
    // Most catalog images live under `/images/...` on the same CDN and must stay as-is
    // (rewriting them to render/image produces 400s and blank cards).
    if (parsed.hostname === CLOUDFRONT_CDN_HOST) {
      const path = parsed.pathname.replace(/^\/+/, '')
      if (path.startsWith('listing-images/')) {
        return buildSupabaseRenderUrl(path, size)
      }
    }
  } catch {
    return url
  }

  return url
}

// ─── Main resolver ────────────────────────────────────────────────────────────

/**
 * Resolve a raw listing image URL to a displayable URL.
 *
 * @param rawUrl   - The URL stored in the DB (may be ibb.co, dropbox, CDN path, etc.)
 * @param fallback - Optional fallback URL if rawUrl is empty/broken (defaults to placeholder)
 * @param size     - Optional display size → Supabase image transform (much smaller downloads)
 */
export function getListingImageUrl(
  rawUrl: string | null | undefined,
  fallback?: string,
  size?: ListingImageDisplaySize | null,
): string {
  const placeholder = fallback ?? LISTING_IMAGE_PLACEHOLDER

  if (!rawUrl) return placeholder

  const url = rawUrl.trim()
  if (!url) return placeholder

  if (BROKEN_IMAGE_CACHE.has(url)) return placeholder

  if (isLocalAsset(url)) return url

  if (isHttpUrl(url)) {
    let hostname: string
    try {
      hostname = new URL(url).hostname
    } catch {
      return placeholder
    }

    if (needsProxy(hostname)) {
      return buildProxyUrl(url)
    }

    if (isAllowedListingImageHost(hostname)) {
      return withListingImageDisplaySize(url, size)
    }

    return placeholder
  }

  // Relative storage key — prefer Supabase render when sizing, else CloudFront.
  if (size && (clampEdge(size.width) || clampEdge(size.height))) {
    return buildSupabaseRenderUrl(
      url.includes('/') ? (url.startsWith('listing-images/') ? url : `listing-images/${url}`) : `listing-images/${url}`,
      size,
    )
  }

  return `${CLOUDFRONT_CDN_URL}/${url}`
}

/**
 * Get a fallback URL to try when the primary image fails to load.
 * Prefer the full object URL (no transform) so a bad render request can still show.
 */
export function getListingImageFallbackUrl(
  rawUrl: string | null | undefined,
  _size?: ListingImageDisplaySize | null,
): string {
  if (!rawUrl) return LISTING_IMAGE_PLACEHOLDER

  const url = rawUrl.trim()
  if (!url) return LISTING_IMAGE_PLACEHOLDER

  if (isHttpUrl(url)) {
    try {
      const parsed = new URL(url)

      if (needsProxy(parsed.hostname)) {
        return LISTING_IMAGE_PLACEHOLDER
      }

      if (parsed.pathname.includes(RENDER_PUBLIC_PREFIX)) {
        parsed.pathname = parsed.pathname.replace(RENDER_PUBLIC_PREFIX, OBJECT_PUBLIC_PREFIX)
        parsed.search = ''
        return parsed.toString()
      }

      if (parsed.pathname.includes(OBJECT_PUBLIC_PREFIX)) {
        parsed.search = ''
        return parsed.toString()
      }

      // CloudFront `/listing-images/...` mirrors Supabase storage; other CF paths
      // (e.g. `/images/detailed/...`) are the canonical source — use them as-is.
      if (parsed.hostname === CLOUDFRONT_CDN_HOST) {
        const path = parsed.pathname.replace(/^\/+/, '')
        if (path.startsWith('listing-images/')) {
          return `${SUPABASE_PROJECT_URL}${OBJECT_PUBLIC_PREFIX}${path}`
        }
        return url
      }

      return url
    } catch {
      return LISTING_IMAGE_PLACEHOLDER
    }
  }

  return `${SUPABASE_PROJECT_URL}${OBJECT_PUBLIC_PREFIX}listing-images/${url}`
}
