import { useCallback } from 'react'
import { useParams } from 'one'

import { ListingScreen } from '~/commerce/screens/ListingScreen'
import { fetchListingDetail, fetchListingDetailById } from '~/commerce/lib/listing-loader'
import { isUuid } from '~/commerce/lib/seo-urls'
import { useNativeLoader } from '~/hooks/useNativeLoader'

/**
 * Native listing detail — avoid One `useLoader` (empty/slow on device).
 * Prefetch + cache via `useNativeLoader` so card taps paint quickly.
 */
export default function ListingNativePage() {
  const { slug } = useParams<{ slug: string }>()
  const loader = useCallback(() => {
    const ref = slug ?? ''
    return isUuid(ref) ? fetchListingDetailById(ref) : fetchListingDetail(ref)
  }, [slug])
  const { data, loading } = useNativeLoader(loader, {
    cacheKey: slug ? `route:listing:${slug}` : undefined,
  })

  return (
    <ListingScreen
      initial={data}
      awaitingInitial={Boolean(slug) && loading && !data?.data && !data?.error}
    />
  )
}
