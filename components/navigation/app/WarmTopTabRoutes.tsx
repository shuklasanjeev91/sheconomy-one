import { useEffect } from 'react'
import { InteractionManager, Platform } from 'react-native'

/**
 * After first paint, warm the five product-root route modules so tab switches
 * don't flash a blank frame while the JS chunk evaluates.
 */
export function WarmTopTabRoutes() {
  useEffect(() => {
    let cancelled = false

    const warm = () => {
      if (cancelled) return
      void Promise.allSettled([
        import('~/app/community/index'),
        import('~/app/chat/index'),
        import('~/app/class/index'),
        import('~/app/co-work/index'),
        import('~/community/screens/CommunityFeedScreen'),
        import('~/chat/screens/ChatScreen'),
        import('~/class/screens/ClassesScreen'),
        import('~/co-work/screens/CoWorkScreen'),
      ])
    }

    if (Platform.OS === 'web') {
      const id = window.setTimeout(warm, 600)
      return () => {
        cancelled = true
        window.clearTimeout(id)
      }
    }

    const handle = InteractionManager.runAfterInteractions(() => {
      warm()
    })
    return () => {
      cancelled = true
      handle.cancel?.()
    }
  }, [])

  return null
}
