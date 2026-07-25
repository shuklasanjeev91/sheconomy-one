import type { Href } from 'one'

import { APP_SCHEME, buildAppUrl, buildNativeSchemeUrl, resolveAppOrigin } from '~/config/app-origin'

import { navigateApp } from '~/lib/platform/navigate'

/**
 * Open an in-app path via soft SPA routing on web, iOS, and Android.
 * Use this from notifications / deep-link handlers while the app is running.
 * (Out-of-app scheme handoff is handled by the OS / linking config, not here.)
 */
export async function openAppPath(path: string): Promise<boolean> {
  const normalized = path.startsWith('/') ? path : `/${path}`
  navigateApp(normalized as Href)
  return true
}

/** Parse an incoming deep link / universal link into an in-app path. */
export function pathFromIncomingUrl(url: string): string | null {
  if (!url) return null

  if (url.startsWith(`${APP_SCHEME}://`)) {
    const rest = url.slice(`${APP_SCHEME}://`.length)
    const path = rest.startsWith('/') ? rest : `/${rest}`
    return path || '/'
  }

  try {
    const origin = resolveAppOrigin()
    if (url.startsWith(origin)) {
      return url.slice(origin.length) || '/'
    }

    const parsed = new URL(url)
    const expectedHost = new URL(origin).host
    if (parsed.host === expectedHost) {
      return `${parsed.pathname}${parsed.search}` || '/'
    }
  } catch {
    return null
  }

  return null
}

export { APP_SCHEME, buildAppUrl, buildNativeSchemeUrl, resolveAppOrigin }
