import { supabase } from '~/lib/supabase/client'

const TREE_ID_CACHE_TTL_MS = 5 * 60 * 1000
const treeIdCache = new Map<string, { ids: string[]; expiresAt: number }>()

/**
 * PostgREST filter matching a category and every descendant beneath it.
 * `id_path` is a slash-joined chain of ids ("MKT-00019/MKT-00173/MKT-00821"),
 * so the id can sit at any of the four positions below — the last one is the
 * category's own row whenever it is a leaf.
 */
export function categoryTreeFilter(categoryId: string): string {
  return [
    `id_path.eq.${categoryId}`,
    `id_path.like.${categoryId}/*`,
    `id_path.like.*/${categoryId}/*`,
    `id_path.like.*/${categoryId}`,
  ].join(',')
}

/** The direct child of `rootId` that `idPath` runs through, if any. */
export function categoryTreeBranch(rootId: string, idPath: string | null | undefined): string | null {
  if (!idPath) return null
  const segments = idPath.split('/')
  const index = segments.indexOf(rootId)
  if (index < 0) return null
  return segments[index + 1] ?? null
}

/** A category plus its descendants, for the id-list filters that facets use. */
export async function fetchCategoryTreeIds(categoryId: string): Promise<string[]> {
  const cached = treeIdCache.get(categoryId)
  if (cached && cached.expiresAt > Date.now()) return cached.ids

  const { data, error } = await supabase
    .from('categories')
    .select('category_id')
    .eq('status', 'A')
    .or(categoryTreeFilter(categoryId))

  const ids = error
    ? [categoryId]
    : [categoryId, ...(data ?? []).map((row) => row.category_id).filter((id) => id !== categoryId)]

  treeIdCache.set(categoryId, { ids, expiresAt: Date.now() + TREE_ID_CACHE_TTL_MS })
  return ids
}
