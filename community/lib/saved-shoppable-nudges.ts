import { fetchListingsByIds } from '~/commerce/lib/commerce'
import type { PostProduct } from '~/community/lib/community'
import { isListingSoldOut } from '~/community/lib/post-product-live'

export type SavedShoppableEntry = {
  postId: string
  products: PostProduct[] | null | undefined
}

/** Count saved posts where any attached product has dropped in price vs live. */
export function countSavedShoppablePriceDrops(
  rows: Array<{ postId: string; priceDropped: boolean }>,
): number {
  const posts = new Set<string>()
  for (const row of rows) {
    if (row.priceDropped) posts.add(row.postId)
  }
  return posts.size
}

/** Build per-post price-drop flags by comparing snapshots to live listing rows. */
export async function buildSavedShoppablePriceDropRows(
  entries: SavedShoppableEntry[],
): Promise<Array<{ postId: string; priceDropped: boolean }>> {
  const listingIds = [
    ...new Set(
      entries.flatMap((entry) =>
        (entry.products ?? [])
          .map((product) => product.listingId)
          .filter((id): id is string => !!id),
      ),
    ),
  ]
  if (!listingIds.length) return []

  const liveRows = await fetchListingsByIds(listingIds)
  const liveById = new Map(liveRows.map((row) => [row.id, row]))

  return entries.map((entry) => {
    const products = entry.products ?? []
    const priceDropped = products.some((product) => {
      if (!product.listingId) return false
      const live = liveById.get(product.listingId)
      if (!live || isListingSoldOut(live)) return false
      const snapshot = typeof product.price === 'number' ? product.price : null
      const livePrice = typeof live.price === 'number' ? live.price : null
      return snapshot != null && livePrice != null && livePrice < snapshot
    })
    return { postId: entry.postId, priceDropped }
  })
}
