import { Platform } from 'react-native'

import { APP_LAYOUT } from '~/lib/layout/constants'

/** Tamagui v3 breakpoints — keep in sync with `@tamagui/config/v3` media. */
export const VIEWPORT_MEDIA = {
  gtSm: '(min-width: 661px)',
  gtMd: '(min-width: 861px)',
  gtLg: '(min-width: 1121px)',
  gtXl: '(min-width: 1281px)',
  /** Matches `app/_layout.tsx` — window scroll + unlocked body. */
  desktopWeb: `(min-width: ${APP_LAYOUT.desktopMinWidth}px)`,
} as const

export type ViewportMediaFlags = {
  gtSm: boolean
  gtMd: boolean
  gtLg: boolean
  gtXl: boolean
  desktopWeb: boolean
}

function createMediaQueryStore(query: string) {
  return {
    subscribe(callback: () => void) {
      if (Platform.OS !== 'web' || typeof window === 'undefined') {
        return () => {}
      }
      const mq = window.matchMedia(query)
      mq.addEventListener('change', callback)
      return () => mq.removeEventListener('change', callback)
    },
    getSnapshot() {
      if (Platform.OS !== 'web' || typeof window === 'undefined') {
        return false
      }
      return window.matchMedia(query).matches
    },
    getServerSnapshot() {
      return false
    },
  }
}

const mediaStores = {
  gtSm: createMediaQueryStore(VIEWPORT_MEDIA.gtSm),
  gtMd: createMediaQueryStore(VIEWPORT_MEDIA.gtMd),
  gtLg: createMediaQueryStore(VIEWPORT_MEDIA.gtLg),
  gtXl: createMediaQueryStore(VIEWPORT_MEDIA.gtXl),
  desktopWeb: createMediaQueryStore(VIEWPORT_MEDIA.desktopWeb),
} as const

export function subscribeViewportMedia(
  key: keyof typeof mediaStores,
  callback: () => void,
) {
  return mediaStores[key].subscribe(callback)
}

export function getViewportMediaSnapshot(key: keyof typeof mediaStores) {
  return mediaStores[key].getSnapshot()
}

export function getViewportMediaServerSnapshot() {
  return false
}
