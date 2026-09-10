import { buildAppUrl, resolveAppOrigin } from '~/config/app-origin'

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

/**
 * Absolute public URL for share / SEO / deep links.
 * Always uses https://sheconomy.in, never the current preview host
 * (e.g. sheconomy-one-eight.vercel.app) or localhost.
 */
export function buildAbsoluteUrl(path: string): string {
  return buildAppUrl(path)
}
