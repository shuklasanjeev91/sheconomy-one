import { useSyncExternalStore } from 'react'
import { Platform } from 'react-native'
import { useGlobalSearchParams, usePathname } from 'one'

import { getSearchParam } from '~/lib/platform/url'

import {
  getVendorSettingsActiveSubId,
  normalizeSettingsSectionParam,
  normalizeVendorPathname,
  readSettingsSectionFromPathname,
  type VendorSettingsSectionId,
} from '~/commerce/components/vendor/vendor-nav'

/**
 * Web-only: re-render when `?section=` changes via history API.
 * Must not run on native — RN has no browser History/`popstate`, and calling
 * `window.addEventListener('popstate', …)` throws (`'popstate' is not a function`).
 */
function subscribeToBrowserSearch(callback: () => void) {
  if (Platform.OS !== 'web') return () => {}
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {}
  }
  if (typeof history === 'undefined' || typeof history.pushState !== 'function') {
    return () => {}
  }

  window.addEventListener('popstate', callback)

  const originalPushState = history.pushState.bind(history)
  const originalReplaceState = history.replaceState.bind(history)

  history.pushState = (...args) => {
    originalPushState(...args)
    callback()
  }
  history.replaceState = (...args) => {
    originalReplaceState(...args)
    callback()
  }

  return () => {
    window.removeEventListener('popstate', callback)
    history.pushState = originalPushState
    history.replaceState = originalReplaceState
  }
}

function readBrowserSectionSnapshot(): string | null {
  if (Platform.OS !== 'web') return null
  return getSearchParam('section')
}

/** Active settings sub-nav id (`settings-payments`, etc.) synced with the URL. */
export function useVendorSettingsActiveSubId(): string | undefined {
  const pathname = usePathname()
  const globalParams = useGlobalSearchParams() as Record<string, string | string[] | undefined>
  const browserSection = useSyncExternalStore(
    subscribeToBrowserSearch,
    readBrowserSectionSnapshot,
    () => null,
  )

  const normalizedPath = normalizeVendorPathname(pathname)
  if (normalizedPath !== '/vendor/settings') return undefined

  const fromPathname = readSettingsSectionFromPathname(pathname)
  const rawParam = globalParams.section
  const fromGlobal = Array.isArray(rawParam) ? rawParam[0] : rawParam

  const section: VendorSettingsSectionId = normalizeSettingsSectionParam(
    fromPathname ?? browserSection ?? fromGlobal ?? 'general',
  )

  return getVendorSettingsActiveSubId(section)
}
