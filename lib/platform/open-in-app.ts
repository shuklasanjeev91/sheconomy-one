import { APP_SCHEME, buildNativeSchemeUrl } from '~/config/app-origin'

export const IOS_APP_STORE_URL = 'https://apps.apple.com/app/id6499198194'
export const ANDROID_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.sheconomy.ecommerce'
export const IOS_APP_STORE_ID = '6499198194'
export const ANDROID_PACKAGE_ID = 'com.sheconomy.ecommerce'

/** Current browser path (+ query) for deep-link handoff. */
export function getWebPathForApp(): string {
  if (typeof window === 'undefined') return '/'
  return `${window.location.pathname}${window.location.search}` || '/'
}

/** Custom-scheme URL that opens the installed native app. */
export function buildOpenInAppSchemeUrl(path = getWebPathForApp()): string {
  return buildNativeSchemeUrl(path)
}

/**
 * Android Chrome Intent URL — opens the app when installed, otherwise sends the
 * user to the Play Store. Use this for an explicit "Open" tap.
 */
export function buildAndroidIntentUrl(path = getWebPathForApp()): string {
  const normalized = (path.startsWith('/') ? path.slice(1) : path) || ''
  const fallback = encodeURIComponent(ANDROID_PLAY_STORE_URL)
  return `intent://${normalized}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE_ID};S.browser_fallback_url=${fallback};end`
}

/**
 * Android Intent URL for a silent, automatic attempt.
 *
 * Deliberately omits `package` and `S.browser_fallback_url`: Chrome sends users
 * to the Play Store whenever a package is named and the app is missing, which
 * would hijack every mobile-web visitor who has not installed the app. Without
 * them, the intent simply does nothing when no handler exists.
 */
export function buildAndroidAutoIntentUrl(path = getWebPathForApp()): string {
  const normalized = (path.startsWith('/') ? path.slice(1) : path) || ''
  return `intent://${normalized}#Intent;scheme=${APP_SCHEME};end`
}

const APP_INSTALLED_KEY = 'sheconomy.openInApp.installed'

/**
 * Browsers cannot ask whether the app is installed (iOS Safari especially), so we
 * remember the last hand-off outcome: '1' after the page was hidden by the app
 * opening, '0' after an automatic attempt that went nowhere.
 */
export function readAppInstalledHint(): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(APP_INSTALLED_KEY)
    return value === '1' ? true : value === '0' ? false : null
  } catch {
    return null
  }
}

function writeAppInstalledHint(installed: boolean) {
  try {
    window.localStorage.setItem(APP_INSTALLED_KEY, installed ? '1' : '0')
  } catch {
    // ignore storage failures
  }
}

/**
 * Navigate to an app URL and learn whether the app took over. Safari's
 * "Open in app?" prompt can take a few seconds to answer, hence the long window.
 * Only automatic attempts record a miss so a cancelled tap never forgets the app.
 */
export function launchNativeApp(
  target: string,
  options: { automatic?: boolean; onResult?: (opened: boolean) => void } = {},
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  let settled = false
  const finish = (opened: boolean) => {
    if (settled) return
    settled = true
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onHidden)
    window.clearTimeout(timer)
    if (opened || options.automatic) writeAppInstalledHint(opened)
    options.onResult?.(opened)
  }
  const onHidden = () => finish(true)
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') finish(true)
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onHidden)
  const timer = window.setTimeout(() => finish(false), 6000)
  window.location.href = target
}

export function buildSmartAppBannerContent(path = getWebPathForApp()): string {
  const argument = path.startsWith('/') ? path : `/${path}`
  return `app-id=${IOS_APP_STORE_ID}, app-argument=${argument}`
}
