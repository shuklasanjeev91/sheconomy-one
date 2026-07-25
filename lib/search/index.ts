export * from '~/lib/search/types'
export * from '~/lib/search/scope-from-path'
export * from '~/lib/search/access'
export * from '~/lib/search/history'
export * from '~/lib/search/federate'
export * from '~/lib/search/suggest'
export * from '~/lib/search/filter'

export function buildSearchHref(query?: string, scope?: string): string {
  const params = new URLSearchParams()
  const q = query?.trim()
  if (q) params.set('q', q)
  if (scope && scope !== 'all') params.set('scope', scope)
  const search = params.toString()
  return search ? `/search?${search}` : '/search'
}
