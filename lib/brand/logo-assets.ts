import {
  getSheconomyLogoUrl,
  getSheconomyLogoUrlLegacy,
  type SheconomyLogoVariant,
} from '~/lib/supabase/brand'

/**
 * Brand mark URLs from the public `sheconomy-logo` Supabase bucket.
 * Always remote (no local require) so web + native share one source of truth.
 */
export function getBrandLogoSource(variant: SheconomyLogoVariant = 'primary'): {
  src: string
  fallbackSrc: string
} {
  return {
    src: getSheconomyLogoUrl(variant),
    fallbackSrc: getSheconomyLogoUrlLegacy(variant),
  }
}
