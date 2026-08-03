/**
 * listing-image-url.ts
 *
 * Resolves any listing image URL to a displayable URL.
 *
 * Rules:
 *  - Supabase Storage URLs → direct (already public CDN)
 *  - Cloudfront CDN paths  → direct
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
  
  const SUPABASE_PROJECT_URL =
    'https://zsaqrrzwygzwrlzgymxk.supabase.co'
  
  /** Your Supabase Edge Function proxy URL */
  const IMAGE_PROXY_FUNCTION_URL =
    `${SUPABASE_PROJECT_URL}/functions/v1/image-proxy`
  
  /** Cloudfront CDN for uploaded listing images */
  const CLOUDFRONT_CDN_URL =
    'https://dfasp73o8frrg.cloudfront.net/listing-images'
  
  const PLACEHOLDER_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">' +
    '<rect width="400" height="400" fill="#f3f4f6"/>' +
    '<path d="M120 250l60-80 60 80 40-50 60 80H120z" fill="#e5e7eb"/>' +
    '<circle cx="170" cy="150" r="20" fill="#e5e7eb"/>' +
    '</svg>'
  
  export const LISTING_IMAGE_PLACEHOLDER =
    `data:image/svg+xml;utf8,${encodeURIComponent(PLACEHOLDER_SVG)}`
  
  // ─── Module-level broken image cache ─────────────────────────────────────────
  // Survives re-renders, resets on page navigation (same pattern as old project)
  
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
    return (
      value.startsWith('/') ||
      value.startsWith('data:') ||
      value.startsWith('blob:')
    )
  }
  
  function needsProxy(hostname: string): boolean {
    return LISTING_IMAGE_PROXY_REQUIRED_HOSTS.has(hostname.toLowerCase().trim())
  }
  
  function buildProxyUrl(originalUrl: string): string {
    return `${IMAGE_PROXY_FUNCTION_URL}?url=${encodeURIComponent(originalUrl)}`
  }
  
  // ─── Main resolver ────────────────────────────────────────────────────────────
  
  /**
   * Resolve a raw listing image URL to a displayable URL.
   *
   * @param rawUrl   - The URL stored in the DB (may be ibb.co, dropbox, CDN path, etc.)
   * @param fallback - Optional fallback URL if rawUrl is empty/broken (defaults to placeholder)
   * @returns        - A URL safe to pass to <Image src> or <img src>
   */
  export function getListingImageUrl(
    rawUrl: string | null | undefined,
    fallback?: string,
  ): string {
    const placeholder = fallback ?? LISTING_IMAGE_PLACEHOLDER
  
    // console.log('🟡 [ImageResolver] RAW URL:', rawUrl)
  
    if (!rawUrl) {
      console.log('🔴 Empty URL → placeholder')
      return placeholder
    }
  
    const url = rawUrl.trim()
    if (!url) {
      console.log('🔴 Trimmed empty → placeholder')
      return placeholder
    }
  
    if (BROKEN_IMAGE_CACHE.has(url)) {
      console.log('⚠️ Already marked broken:', url)
      return placeholder
    }
  
    if (isLocalAsset(url)) {
      // console.log('🟢 Local asset:', url)
      return url
    }
  
    if (isHttpUrl(url)) {
      let hostname: string
      try {
        hostname = new URL(url).hostname
      } catch {
        console.log('🔴 Invalid URL:', url)
        return placeholder
      }
  
      // console.log('🔵 Hostname:', hostname)
  
      if (needsProxy(hostname)) {
        const proxyUrl = buildProxyUrl(url)
        // console.log('🟣 Using proxy:', proxyUrl)
        return proxyUrl
      }
  
      if (isAllowedListingImageHost(hostname)) {
        // console.log('🟢 Direct allowed URL:', url)
        return url
      }
  
      console.log('🔴 Unknown host → placeholder:', hostname)
      return placeholder
    }
  
    const cdnUrl = `${CLOUDFRONT_CDN_URL}/${url}`
    // console.log('🟢 CDN URL:', cdnUrl)
    return cdnUrl
  }
  
  /**
   * Get a fallback URL to try when the primary image fails to load.
   * For external URLs this tries the Supabase public bucket as a second source.
   * For proxy URLs this returns the placeholder immediately.
   */
  export function getListingImageFallbackUrl(rawUrl: string | null | undefined): string {
    // console.log('🟡 [FallbackResolver] RAW:', rawUrl)
  
    if (!rawUrl) return LISTING_IMAGE_PLACEHOLDER
  
    const url = rawUrl.trim()
    if (!url) return LISTING_IMAGE_PLACEHOLDER
  
    if (isHttpUrl(url)) {
      try {
        const parsed = new URL(url)
  
        if (needsProxy(parsed.hostname)) {
          // console.log('⚠️ Proxy URL → no fallback')
          return LISTING_IMAGE_PLACEHOLDER
        }
  
        const filename = parsed.pathname.split('/').pop()?.split('?')[0]
        // console.log('🟢 Extracted filename:', filename)
  
        if (!filename) return LISTING_IMAGE_PLACEHOLDER
  
        const fallbackUrl = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/listing-images/${filename}`
        // console.log('🟣 Fallback URL:', fallbackUrl)
  
        return fallbackUrl
      } catch {
        console.log('🔴 Invalid fallback URL')
        return LISTING_IMAGE_PLACEHOLDER
      }
    }
  
    const fallbackUrl = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/listing-images/${url}`
    // console.log('🟣 Relative fallback:', fallbackUrl)
  
    return fallbackUrl
  }