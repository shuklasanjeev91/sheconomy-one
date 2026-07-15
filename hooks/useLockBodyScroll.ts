import { useEffect } from 'react'
import { Platform } from 'react-native'

/**
 * While `active` is true, prevent the page behind a full-screen overlay from
 * scrolling (web only). The previous `overflow` values are restored on cleanup,
 * so nesting/looping overlays stay safe. No-op on native.
 */
export function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) return
    if (Platform.OS !== 'web' || typeof document === 'undefined') return

    const { body, documentElement } = document
    const prevBodyOverflow = body.style.overflow
    const prevHtmlOverflow = documentElement.style.overflow

    body.style.overflow = 'hidden'
    documentElement.style.overflow = 'hidden'

    return () => {
      body.style.overflow = prevBodyOverflow
      documentElement.style.overflow = prevHtmlOverflow
    }
  }, [active])
}
