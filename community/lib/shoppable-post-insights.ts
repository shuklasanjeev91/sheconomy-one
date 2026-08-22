import { supabase } from '~/lib/supabase/client'

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function countAttachedProducts(postData: unknown): number {
  const data = toRecord(postData)
  if (!data) return 0
  const attached = data.attached_products
  let count = 0
  if (Array.isArray(attached)) count += attached.length
  const legacy = toRecord(data.product_data)
  if (legacy?.listingId) count += 1
  return count
}

function extractListingIds(postData: unknown): string[] {
  const data = toRecord(postData)
  if (!data) return []
  const ids: string[] = []
  const attached = data.attached_products
  if (Array.isArray(attached)) {
    for (const entry of attached) {
      const row = toRecord(entry)
      const listingId = typeof row?.listingId === 'string' ? row.listingId : null
      if (listingId) ids.push(listingId)
    }
  }
  const legacy = toRecord(data.product_data)
  const legacyId = typeof legacy?.listingId === 'string' ? legacy.listingId : null
  if (legacyId) ids.push(legacyId)
  return ids
}

export type ShoppablePostInsightRow = {
  postId: string
  productCount: number
  createdAt: string | null
}

export type ShoppablePostInsights = {
  postsWithProducts: number
  uniqueListingIds: string[]
  topPosts: ShoppablePostInsightRow[]
}

/** Aggregate lightweight shoppable-post stats from recent post payloads. */
export function buildShoppablePostInsights(
  rows: Array<{ id: string; post_data: unknown; created_at: string | null }>,
  topLimit = 3,
): ShoppablePostInsights {
  const listingIds = new Set<string>()
  const shoppablePosts: ShoppablePostInsightRow[] = []

  for (const row of rows) {
    const productCount = countAttachedProducts(row.post_data)
    if (productCount <= 0) continue
    for (const id of extractListingIds(row.post_data)) {
      listingIds.add(id)
    }
    shoppablePosts.push({
      postId: row.id,
      productCount,
      createdAt: row.created_at,
    })
  }

  shoppablePosts.sort(
    (a, b) =>
      b.productCount - a.productCount ||
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
  )

  return {
    postsWithProducts: shoppablePosts.length,
    uniqueListingIds: [...listingIds],
    topPosts: shoppablePosts.slice(0, topLimit),
  }
}

/** Fetch shoppable-post insights for a member's recent posts. */
export async function fetchShoppablePostInsights(
  userId: string,
  topLimit = 3,
): Promise<ShoppablePostInsights> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, post_data, created_at')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(60)

  if (error || !data?.length) {
    return { postsWithProducts: 0, uniqueListingIds: [], topPosts: [] }
  }

  return buildShoppablePostInsights(data, topLimit)
}
