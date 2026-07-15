import { resolveAppOrigin } from '~/config/app-origin'

/**
 * If `url` points at this app (relative path or same origin), return the in-app
 * path for SPA navigation. Otherwise return null (treat as external).
 */
export function inAppPathFromUrl(url: string): string | null {
  if (!url) return null

  // mailto / tel / custom schemes are never in-app routes
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^https?:/i.test(url)) {
    return null
  }

  if (url.startsWith('/') && !url.startsWith('//')) {
    return url
  }

  try {
    const origin = resolveAppOrigin()
    if (url.startsWith(origin)) {
      return url.slice(origin.length) || '/'
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
      if (url.startsWith(window.location.origin)) {
        return url.slice(window.location.origin.length) || '/'
      }
    }

    const parsed = new URL(url)
    const expectedHost = new URL(origin).host
    if (parsed.host === expectedHost) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/'
    }
  } catch {
    return null
  }

  return null
}
