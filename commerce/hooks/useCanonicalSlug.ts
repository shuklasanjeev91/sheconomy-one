import { useEffect } from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'one'

import {
  getListingSlug,
  getShopSlug,
  listingSlugMatches,
  shopSlugMatches,
} from '~/commerce/lib/seo-urls'

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

    const canonical = getListingSlug(listing)
    if (canonical === routeSlug || listingSlugMatches(listing, routeSlug)) return

    router.push(`/listing/${encodeURIComponent(canonical)}` as never)
  }, [routeSlug, listing, router])
}

export function useCanonicalShopSlug(
  routeSlug: string | undefined,
  shop?: { slug?: string | null; id: string; shop_name?: string } | null,
) {
  const router = useRouter()

  useEffect(() => {
    // Keep shop URLs stable on native — SEO rewrite can remount and refetch.
    if (Platform.OS !== 'web') return
    if (!routeSlug || !shop) return

    const canonical = getShopSlug(shop)
    if (canonical === routeSlug || shopSlugMatches(shop, routeSlug)) return

    router.push(`/shop/${encodeURIComponent(canonical)}` as never)
  }, [routeSlug, shop, router])
}
