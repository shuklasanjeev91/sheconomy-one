import { resolveAppOrigin } from '~/config/app-origin'

export function getWindowOrigin(): string {
  if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
    return window.location.origin
  }

  return resolveAppOrigin()
}

export function getSearchParam(key: string): string | null {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') {
    return null
  }
  const search = window.location.search
  if (search == null) return null
  return new URLSearchParams(search).get(key)
}

export function buildAbsoluteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : resolveAppOrigin()
  return `${origin.replace(/\/$/, '')}${normalized}`
}
