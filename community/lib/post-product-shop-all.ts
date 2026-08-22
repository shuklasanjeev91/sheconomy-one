import type { EnrichedPostProduct } from '~/community/lib/post-product-live'

export type ShopAllSkipReason = 'sold_out' | 'unavailable' | 'missing_id' | 'variant_required'

export type ShopAllResult = {
  addedListingIds: string[]
  skipped: Array<{ listingId: string; reason: ShopAllSkipReason }>
}

/** Aggregate batch add-to-cart results for multi-product posts. */
export function summarizeShopAllResults(
  results: Array<{ listingId: string; error: string | null; eligible: boolean; reason?: ShopAllSkipReason }>,
): ShopAllResult {
  const addedListingIds: string[] = []
  const skipped: ShopAllResult['skipped'] = []

  for (const row of results) {
    if (!row.eligible) {
      skipped.push({ listingId: row.listingId, reason: row.reason ?? 'unavailable' })
      continue
    }
    if (row.error) {
      skipped.push({ listingId: row.listingId, reason: 'variant_required' })
      continue
    }
    addedListingIds.push(row.listingId)
  }

  return { addedListingIds, skipped }
}

export function shopAllEligibleProducts(products: EnrichedPostProduct[]): EnrichedPostProduct[] {
  return products.filter(
    (product) =>
      product.listingId &&
      product.liveStatus === 'available' &&
      !product.soldOut,
  )
}
