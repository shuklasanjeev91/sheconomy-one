import { PUBLIC_SUPABASE_URL } from '~/config/supabase-public'

export const SHECONOMY_LOGO_BUCKET = 'sheconomy-logo' as const

/**
 * Public paths in the `sheconomy-logo` bucket.
 * Prefer `brand/*` (synced from repo assets); fall back to legacy root names.
 */
const LOGO_PATHS = {
  /** Full wordmark — horizontal logo for auth / marketing chrome */
  primary: 'brand/logo-wordmark.png',
  /** Square icon for compact nav */
  icon: 'brand/logo-icon.png',
} as const

/** Legacy objects that already live at the bucket root (read fallback). */
const LEGACY_LOGO_PATHS = {
  primary: 'sheconomy-logo_v2.png',
  icon: '80x80.png',
} as const

export type SheconomyLogoVariant = keyof typeof LOGO_PATHS

function publicObjectUrl(objectPath: string): string {
  const base = PUBLIC_SUPABASE_URL.replace(/\/$/, '')
  const encoded = objectPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `${base}/storage/v1/object/public/${SHECONOMY_LOGO_BUCKET}/${encoded}`
}

export function getSheconomyLogoUrl(variant: SheconomyLogoVariant = 'primary') {
  return publicObjectUrl(LOGO_PATHS[variant])
}

/** Legacy CDN URL — used only if the brand/* object is missing. */
export function getSheconomyLogoUrlLegacy(variant: SheconomyLogoVariant = 'primary') {
  return publicObjectUrl(LEGACY_LOGO_PATHS[variant])
}

/** Square brand mark for favicons and app icons */
export function getSheconomyFaviconUrl() {
  return getSheconomyLogoUrl('icon')
}

export function getBrandAssetUrl(objectPath: string) {
  const normalized = objectPath.replace(/^\//, '')
  return publicObjectUrl(normalized.startsWith('brand/') ? normalized : `brand/${normalized}`)
}
