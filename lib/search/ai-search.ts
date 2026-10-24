import { searchWithAi, type AiSearchResult } from '~/lib/ai/client'
import type { ListingBrowseFilters } from '~/commerce/lib/filters'
import { answerForWeekendPlan } from '~/lib/search/weekend-plan'

export type AiSearchModeResult = AiSearchResult & {
  filters: ListingBrowseFilters
}

/**
 * Prefer the shopper's typed brand/shop name when AI padded it with category fluff.
 * Keeps ranking and ILIKE matching aligned with what they typed.
 */
export function resolveAiListingSearchTerm(original: string, aiTerm: string): string {
  const typed = original.trim()
  const generated = aiTerm.trim()
  if (!typed) return generated
  if (!generated) return typed

  const typedTokens = typed.split(/\s+/).filter(Boolean)
  if (typedTokens.length > 2) return generated

  const typedLower = typed.toLowerCase()
  const generatedLower = generated.toLowerCase()
  if (
    generatedLower !== typedLower &&
    generatedLower.includes(typedLower) &&
    generated.length > typed.length + 2
  ) {
    return typed
  }

  return generated
}

/**
 * Natural-language marketplace search via the ai-assist edge function.
 */
export async function runAiSearch(message: string, location?: string | null): Promise<AiSearchModeResult> {
  const trimmed = message.trim()
  if (!trimmed) {
    throw new Error('Enter what you are looking for.')
  }

  const result = await searchWithAi({ message: trimmed, location })
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
    answer: answerForWeekendPlan(trimmed, result.answer),
    searchTerm: resolveAiListingSearchTerm(trimmed, result.searchTerm.trim() || trimmed),
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
