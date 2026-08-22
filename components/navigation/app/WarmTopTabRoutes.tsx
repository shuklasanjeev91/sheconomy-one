import { useEffect } from 'react'
import { InteractionManager, Platform } from 'react-native'

import { warmAllProductTabRoutes } from '~/components/navigation/app/warm-product-tab-route'
import { scheduleIdle } from '~/lib/schedule-idle'

/**
 * After first paint, warm the five product-root route modules so tab switches
 * don't flash a blank frame while the JS chunk evaluates.
 */
export function WarmTopTabRoutes() {
  useEffect(() => {
    let cancelled = false
    let cancelIdle: (() => void) | undefined

    const warm = () => {
      if (cancelled) return
      warmAllProductTabRoutes()
    }

    if (Platform.OS === 'web') {
      cancelIdle = scheduleIdle(warm, 300)
      return () => {
        cancelled = true
        cancelIdle?.()
      }
    }

    const handle = InteractionManager.runAfterInteractions(warm)
    return () => {
      cancelled = true
      handle.cancel?.()
      cancelIdle?.()
    }
  }, [])

  return null
}
