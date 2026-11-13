import { useEffect } from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'one'

import {
  getListingSlug,
  getShopSlug,
  isUuid,
  listingSlugMatches,
  shopSlugMatches,
} from '~/commerce/lib/seo-urls'

/**
 * SEO-upgrade UUID (or `uuid-title`) listing URLs to the canonical slug.
 * Never rewrite when the loaded listing does not belong to the current route —
 * that race during soft-nav between PDPs caused max-update-depth crashes.
 */
export function useCanonicalListingSlug(
  routeSlug: string | undefined,
  listing?: { slug?: string | null; id: string; title?: string } | null,
) {
  const router = useRouter()

  useEffect(() => {
    // Native opens by UUID for speed — rewriting to a title slug remounts the
    // route and re-triggers slow slug resolution.
    if (Platform.OS !== 'web') return
    if (!routeSlug || !listing) return

    const normalized = routeSlug.trim().toLowerCase()
    const idPrefix = normalized.split('-')[0]
    const routeIsThisListingId =
      listing.id.toLowerCase() === normalized ||
      (isUuid(idPrefix) && listing.id.toLowerCase() === idPrefix)

    // Soft-nav: slug changed but listing state is still the previous PDP.
    if (!routeIsThisListingId && !listingSlugMatches(listing, routeSlug)) return

    const canonical = getListingSlug(listing)
    if (canonical === routeSlug || listingSlugMatches(listing, routeSlug)) return
    if (!routeIsThisListingId) return

    router.replace(`/listing/${encodeURIComponent(canonical)}` as never)
  }, [routeSlug, listing?.id, listing?.slug, listing?.title, router])
}

/**
 * SEO-upgrade UUID shop URLs to the canonical slug. Same soft-nav guard as listings.
 */
export function useCanonicalShopSlug(
  routeSlug: string | undefined,
  shop?: { slug?: string | null; id: string; shop_name?: string } | null,
) {
  const router = useRouter()

  useEffect(() => {
    // Keep shop URLs stable on native — SEO rewrite can remount and refetch.
    if (Platform.OS !== 'web') return
    if (!routeSlug || !shop) return

    const normalized = routeSlug.trim().toLowerCase()
    const routeIsThisShopId =
      shop.id.toLowerCase() === normalized ||
      (isUuid(normalized) && shop.id.toLowerCase() === normalized)

    if (!routeIsThisShopId && !shopSlugMatches(shop, routeSlug)) return

    const canonical = getShopSlug(shop)
    if (canonical === routeSlug || shopSlugMatches(shop, routeSlug)) return
    if (!routeIsThisShopId) return

    router.replace(`/shop/${encodeURIComponent(canonical)}` as never)
  }, [routeSlug, shop?.id, shop?.slug, shop?.shop_name, router])
}
