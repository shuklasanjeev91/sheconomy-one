/**
 * User-agent based device detection.
 *
 * Migrated (and slimmed) from the old `lib/utils/mobile-detection.js`. The old
 * file also bundled native app-store deep-linking helpers — those are dropped
 * here because sheconomy-one **is** the native app (Expo / React Native), so
 * "open in app / redirect to the store" flows do not apply.
 *
 * Kept: the pure `detectMobileDevice(userAgent)` classifier, useful for
 * analytics, feature flags, or tailoring web copy. On native, prefer
 * `useAppLayout()` / `Platform` for layout decisions.
 */

import { Platform } from 'react-native'

export type DeviceOS = 'ios' | 'android' | 'windows' | 'blackberry' | 'unknown'
export type DeviceBrowser =
  | 'chrome'
  | 'safari'
  | 'firefox'
  | 'edge'
  | 'opera'
  | 'unknown'
export type DeviceType = 'phone' | 'tablet' | 'desktop'

export type DeviceInfo = {
  isMobile: boolean
  isTablet: boolean
  isMobilePhone: boolean
  isDesktop: boolean
  os: DeviceOS
  browser: DeviceBrowser
  deviceType: DeviceType
  isAndroid: boolean
  isIOS: boolean
  isWindowsPhone: boolean
  userAgent: string
}

const DESKTOP_INFO: DeviceInfo = {
  isMobile: false,
  isTablet: false,
  isMobilePhone: false,
  isDesktop: true,
  os: 'unknown',
  browser: 'unknown',
  deviceType: 'desktop',
  isAndroid: false,
  isIOS: false,
  isWindowsPhone: false,
  userAgent: '',
}

/** Resolve the user-agent string when one isn't passed (web only). */
function resolveUserAgent(userAgent?: string): string | null {
  if (userAgent) return userAgent
  if (typeof navigator !== 'undefined' && navigator.userAgent) return navigator.userAgent
  return null
}

/**
 * Classify a device from its user-agent string. Falls back to the browser's own
 * UA on web when none is supplied; returns a desktop profile when unknown.
 */
export function detectMobileDevice(userAgent?: string): DeviceInfo {
  const ua = resolveUserAgent(userAgent)
  if (!ua) return { ...DESKTOP_INFO }

  const lower = ua.toLowerCase()

  const isAndroid = /android/.test(lower)
  const isIOS = /iphone|ipad|ipod/.test(lower)
  const isWindowsPhone = /windows phone/.test(lower)
  const isBlackBerry = /blackberry|bb10/.test(lower)

  // iPadOS Safari reports as desktop MacIntel with touch points.
  let isIPad = /ipad/.test(lower)
  if (!isIPad && typeof navigator !== 'undefined') {
    isIPad =
      (navigator as Navigator & { maxTouchPoints?: number }).platform === 'MacIntel' &&
      ((navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0) > 1
  }
  const isAndroidTablet = isAndroid && !/mobile/.test(lower)
  const isTablet = isIPad || isAndroidTablet

  const isMobilePhone =
    (isAndroid || isIOS || isWindowsPhone || isBlackBerry) && !isTablet
  const isMobile = isMobilePhone || isTablet

  let os: DeviceOS = 'unknown'
  if (isIOS) os = 'ios'
  else if (isAndroid) os = 'android'
  else if (isWindowsPhone) os = 'windows'
  else if (isBlackBerry) os = 'blackberry'

  let browser: DeviceBrowser = 'unknown'
  if (/chrome/.test(lower) && !/edg/.test(lower)) browser = 'chrome'
  else if (/safari/.test(lower) && !/chrome/.test(lower)) browser = 'safari'
  else if (/firefox/.test(lower)) browser = 'firefox'
  else if (/edg/.test(lower)) browser = 'edge'
  else if (/opera|opr/.test(lower)) browser = 'opera'

  const deviceType: DeviceType = isTablet ? 'tablet' : isMobilePhone ? 'phone' : 'desktop'

  return {
    isMobile,
    isTablet,
    isMobilePhone,
    isDesktop: !isMobile,
    os,
    browser,
    deviceType,
    isAndroid,
    isIOS,
    isWindowsPhone,
    userAgent: ua,
  }
}

/**
 * Embedded webviews used by messaging / social apps.
 *
 * These matter for deep linking: iOS Universal Links are ignored inside an
 * in-app browser, so a `sheconomy://` handoff is the only way out of them.
 * WhatsApp on Android uses a plain Chrome Custom Tab and adds no marker, so
 * Android handoff is driven by `isAndroid` rather than this check.
 */
export function isInAppBrowser(userAgent?: string): boolean {
  const ua = resolveUserAgent(userAgent)
  if (!ua) return false

  return /FBAN|FBAV|FB_IAB|FBIOS|Instagram|LinkedInApp|Snapchat|Pinterest|MicroMessenger|Line\/|Twitter|GSA\//i.test(
    ua
  )
}

/**
 * Current device info. On native this trusts `Platform.OS`; on web it inspects
 * the browser user-agent.
 */
export function getDeviceInfo(): DeviceInfo {
  if (Platform.OS === 'ios') {
    return { ...DESKTOP_INFO, isMobile: true, isMobilePhone: true, isDesktop: false, os: 'ios', deviceType: 'phone', isIOS: true }
  }
  if (Platform.OS === 'android') {
    return { ...DESKTOP_INFO, isMobile: true, isMobilePhone: true, isDesktop: false, os: 'android', deviceType: 'phone', isAndroid: true }
  }
  return detectMobileDevice()
}
