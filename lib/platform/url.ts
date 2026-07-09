import { resolveAppOrigin } from '~/config/app-origin'

export function getWindowOrigin(): string {
  if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
    return window.location.origin
  }

  return resolveAppOrigin()
}

export function getSearchParam(key: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(key)
}

export function buildAbsoluteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : resolveAppOrigin()
  return `${origin.replace(/\/$/, '')}${normalized}`
}
