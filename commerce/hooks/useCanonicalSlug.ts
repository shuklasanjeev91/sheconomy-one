import { useEffect } from 'react'
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
    if (!routeSlug || !listing) return

    const canonical = getListingSlug(listing)
    if (canonical === routeSlug || listingSlugMatches(listing, routeSlug)) return

    router.replace(`/listing/${encodeURIComponent(canonical)}` as never)
  }, [routeSlug, listing, router])
}

export function useCanonicalShopSlug(
  routeSlug: string | undefined,
  shop?: { slug?: string | null; id: string; shop_name?: string } | null,
) {
  const router = useRouter()

  useEffect(() => {
    if (!routeSlug || !shop) return

    const canonical = getShopSlug(shop)
    if (canonical === routeSlug || shopSlugMatches(shop, routeSlug)) return

    router.replace(`/shop/${encodeURIComponent(canonical)}` as never)
  }, [routeSlug, shop, router])
}
