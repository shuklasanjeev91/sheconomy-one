export * from './types'
export * from './scope-from-path'
export * from './access'
export * from './history'
export * from './federate'
export * from './suggest'

export function buildSearchHref(query?: string, scope?: string): string {
  const params = new URLSearchParams()
  const q = query?.trim()
  if (q) params.set('q', q)
  if (scope && scope !== 'all') params.set('scope', scope)
  const search = params.toString()
  return search ? `/search?${search}` : '/search'
}
