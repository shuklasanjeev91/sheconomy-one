import { useEffect, useState } from 'react'

import { fetchPostById } from '~/community/lib/community'

/** Snapshot price from a community post attachment for PDP posted-at chip. */
export function useCommunityPostSnapshotPrice(
  listingId: string | undefined,
  postId: string | null | undefined,
) {
  const [snapshotPrice, setSnapshotPrice] = useState<number | null>(null)
  const [currency, setCurrency] = useState<string | null>(null)

  useEffect(() => {
    if (!listingId || !postId) {
      setSnapshotPrice(null)
      setCurrency(null)
      return
    }
    let cancelled = false
    void fetchPostById(postId).then((result) => {
      if (cancelled || !result.data) return
      const products = result.data.products?.length
        ? result.data.products
        : result.data.product
          ? [result.data.product]
          : []
      const match = products.find((product) => product.listingId === listingId)
      setSnapshotPrice(typeof match?.price === 'number' ? match.price : null)
      setCurrency(match?.currency ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [listingId, postId])

  return { snapshotPrice, currency }
}
