import { fetchListingsByIds } from '~/commerce/lib/commerce'
import { listingSummaryToPostProduct } from '~/community/lib/attach-listing-products'
import type { PostProduct } from '~/community/lib/community'
import { supabase } from '~/lib/supabase/client'

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function extractListingIds(postData: unknown): string[] {
  const data = toRecord(postData)
  if (!data) return []
  const attached = data.attached_products
  if (!Array.isArray(attached)) return []
  const ids: string[] = []
  for (const entry of attached) {
    const row = toRecord(entry)
    const listingId = typeof row?.listingId === 'string' ? row.listingId : null
    if (listingId) ids.push(listingId)
  }
  const legacyProduct = toRecord(data.product_data)
  const legacyId = typeof legacyProduct?.listingId === 'string' ? legacyProduct.listingId : null
  if (legacyId) ids.push(legacyId)
  return ids
}

/** Aggregate unique listings tagged across a member's recent posts. */
export async function fetchProfileShoppableProducts(
  userId: string,
  limit = 12,
): Promise<PostProduct[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('post_data')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(40)

  if (error || !data?.length) return []

  const listingIds: string[] = []
  const seen = new Set<string>()
  for (const row of data) {
    for (const id of extractListingIds(row.post_data)) {
      if (seen.has(id)) continue
      seen.add(id)
      listingIds.push(id)
      if (listingIds.length >= limit) break
    }
    if (listingIds.length >= limit) break
  }

  if (!listingIds.length) return []
  const listings = await fetchListingsByIds(listingIds)
  return listings.map(listingSummaryToPostProduct)
}
