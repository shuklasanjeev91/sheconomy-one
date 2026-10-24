export * from '~/lib/search/types'
export * from '~/lib/search/scope-from-path'
export * from '~/lib/search/access'
export * from '~/lib/search/history'
export * from '~/lib/search/federate'
export * from '~/lib/search/suggest'
export * from '~/lib/search/filter'
export { buildAiSearchHref, resolveAiListingSearchTerm, runAiSearch } from '~/lib/search/ai-search'
export { isTripListingText, isWeekendPlanQuery } from '~/lib/search/weekend-plan'
export { isShopSetupQuestion } from '~/lib/search/suggest-intent'
export { searchQueryFromImage } from '~/lib/search/image-search'

export function buildSearchHref(query?: string, scope?: string, mode?: 'ai' | null): string {
  const params = new URLSearchParams()
  const q = query?.trim()
  if (q) params.set('q', q)
  if (scope && scope !== 'all') params.set('scope', scope)
  if (mode === 'ai') params.set('mode', 'ai')
  const search = params.toString()
  return search ? `/search?${search}` : '/search'
}
