import type { Href } from 'one'

import { APP_SCHEME, buildAppUrl, buildNativeSchemeUrl, resolveAppOrigin } from '~/config/app-origin'
import { pathFromIncomingUrl } from '~/lib/platform/path-from-incoming-url'
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

export { pathFromIncomingUrl }
export { APP_SCHEME, buildAppUrl, buildNativeSchemeUrl, resolveAppOrigin }
