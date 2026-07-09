import { Linking, Platform } from 'react-native'

import { APP_SCHEME, buildAppUrl, buildNativeSchemeUrl, resolveAppOrigin } from '~/config/app-origin'

import { openExternalUrl } from './openUrl'

/** Open a path in the native app (scheme) or web origin. */
export async function openAppPath(path: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.location.href = buildAppUrl(path)
      return true
    }
    return false
  }

  const schemeUrl = buildNativeSchemeUrl(path)
  const canOpenScheme = await Linking.canOpenURL(schemeUrl)
  if (canOpenScheme) {
    await Linking.openURL(schemeUrl)
    return true
  }

  return openExternalUrl(buildAppUrl(path))
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
