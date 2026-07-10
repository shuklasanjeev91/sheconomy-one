import { useSyncExternalStore } from 'react'

import {
  getViewportMediaServerSnapshot,
  getViewportMediaSnapshot,
  subscribeViewportMedia,
  type ViewportMediaFlags,
} from '~/lib/layout/viewport-media'

/**
 * Reliable viewport breakpoints on web via `matchMedia`.
 * Tamagui `useMedia()` can report stale mobile values after hydration.
 */
export function useViewportMedia(): ViewportMediaFlags {
  const gtSm = useSyncExternalStore(
    (cb) => subscribeViewportMedia('gtSm', cb),
    () => getViewportMediaSnapshot('gtSm'),
    getViewportMediaServerSnapshot,
  )
  const gtMd = useSyncExternalStore(
    (cb) => subscribeViewportMedia('gtMd', cb),
    () => getViewportMediaSnapshot('gtMd'),
    getViewportMediaServerSnapshot,
  )
  const gtLg = useSyncExternalStore(
    (cb) => subscribeViewportMedia('gtLg', cb),
    () => getViewportMediaSnapshot('gtLg'),
    getViewportMediaServerSnapshot,
  )
  const gtXl = useSyncExternalStore(
    (cb) => subscribeViewportMedia('gtXl', cb),
    () => getViewportMediaSnapshot('gtXl'),
    getViewportMediaServerSnapshot,
  )
  const desktopWeb = useSyncExternalStore(
    (cb) => subscribeViewportMedia('desktopWeb', cb),
    () => getViewportMediaSnapshot('desktopWeb'),
    getViewportMediaServerSnapshot,
  )

  return { gtSm, gtMd, gtLg, gtXl, desktopWeb }
}
