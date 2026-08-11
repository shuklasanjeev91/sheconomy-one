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

export function buildSmartAppBannerContent(path = getWebPathForApp()): string {
  const argument = path.startsWith('/') ? path : `/${path}`
  return `app-id=${IOS_APP_STORE_ID}, app-argument=${argument}`
}
