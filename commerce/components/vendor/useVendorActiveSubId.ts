import { useSyncExternalStore } from 'react'
import { Platform } from 'react-native'
import { useGlobalSearchParams, usePathname } from 'one'

import {
  readSectionFromLocation,
  resolveVendorActiveSubId,
  resolveVendorSection,
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

/** The `?section=` value the URL currently points at, kept in sync on web. */
function useSectionParam(): string | string[] | undefined | null {
  const globalParams = useGlobalSearchParams() as Record<string, string | string[] | undefined>
  const browserSection = useSyncExternalStore(
    subscribeToBrowserSearch,
    readSectionFromLocation,
    () => null,
  )
  return browserSection ?? globalParams.section
}

/**
 * Active sub-nav id (`orders-issues`, `settings-payments`, …) synced with the
 * URL. Returns `undefined` on pages that don't host `?section=` sub-pages.
 */
export function useVendorActiveSubId(): string | undefined {
  const pathname = usePathname()
  return resolveVendorActiveSubId(pathname, useSectionParam())
}

/**
 * Normalized section id for the current section-hosting page (`all`, `issues`,
 * …), or `null` elsewhere. Used by host screens to pick which panel to render.
 */
export function useVendorSectionId(): string | null {
  const pathname = usePathname()
  return resolveVendorSection(pathname, useSectionParam())?.section ?? null
}
