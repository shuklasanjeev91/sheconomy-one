import { useEffect, useMemo, useState } from 'react'

import { fetchListingsByIds } from '~/commerce/lib/commerce'
import type { PostProduct } from '~/community/lib/community'
import {
  mergePostProductWithLive,
  type EnrichedPostProduct,
} from '~/community/lib/post-product-live'

function snapshotAsAvailable(snapshot: PostProduct): EnrichedPostProduct {
  return {
    ...snapshot,
    liveStatus: 'available',
    priceUpdated: false,
    priceDropped: false,
    snapshotPrice: snapshot.price,
    averageRating: null,
    totalReviews: null,
    soldOut: false,
    soldOutVariantGated: false,
  }
}

/**
 * Batch-fetch live listing rows for post attachments and merge over snapshots.
 */
export function usePostProductsLive(products: PostProduct[]): EnrichedPostProduct[] {
  const listingIds = useMemo(
    () =>
      [...new Set(products.map((item) => item.listingId).filter(Boolean))] as string[],
    [products],
  )
  const idsKey = listingIds.join(',')

  const [liveById, setLiveById] = useState<
    Map<string, Awaited<ReturnType<typeof fetchListingsByIds>>[number]>
  >(new Map())
  const [loaded, setLoaded] = useState(!listingIds.length)

  useEffect(() => {
    if (!listingIds.length) {
      setLiveById(new Map())
      setLoaded(true)
      return
    }
    let cancelled = false
    setLoaded(false)
    void fetchListingsByIds(listingIds).then((rows) => {
      if (cancelled) return
      setLiveById(new Map(rows.map((row) => [row.id, row])))
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [idsKey, listingIds])

  return useMemo(() => {
    if (!loaded) {
      return products.map(snapshotAsAvailable)
    }
    return products.map((snapshot) =>
      mergePostProductWithLive(
        snapshot,
        snapshot.listingId ? liveById.get(snapshot.listingId) : undefined,
      ),
    )
  }, [liveById, loaded, products])
}
