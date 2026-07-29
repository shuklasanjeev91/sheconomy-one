import { searchWithAi, type AiSearchResult } from '~/lib/ai/client'
import type { ListingBrowseFilters } from '~/commerce/lib/filters'

export type AiSearchModeResult = AiSearchResult & {
  filters: ListingBrowseFilters
}

/**
 * Natural-language marketplace search via the ai-assist edge function.
 */
export async function runAiSearch(message: string): Promise<AiSearchModeResult> {
  const trimmed = message.trim()
  if (!trimmed) {
    throw new Error('Enter what you are looking for.')
  }

  const result = await searchWithAi({ message: trimmed })
  const filters: ListingBrowseFilters = {}
  if (result.filters?.minPrice != null && Number.isFinite(result.filters.minPrice)) {
    filters.minPrice = result.filters.minPrice
  }
  if (result.filters?.maxPrice != null && Number.isFinite(result.filters.maxPrice)) {
    filters.maxPrice = result.filters.maxPrice
  }
  if (result.filters?.listingType === 'physical' || result.filters?.listingType === 'digital') {
    filters.listingType = result.filters.listingType
  }

  return {
    ...result,
    searchTerm: result.searchTerm.trim() || trimmed,
    filters,
  }
}

export function buildAiSearchHref(query: string): string {
  const params = new URLSearchParams()
  const q = query.trim()
  if (q) params.set('q', q)
  params.set('mode', 'ai')
  params.set('scope', 'listings')
  return `/search?${params.toString()}`
}
