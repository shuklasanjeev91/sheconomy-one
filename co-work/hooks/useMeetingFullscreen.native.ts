import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, StatusBar } from 'react-native'

/**
 * Immersive meeting full screen on iOS / Android — hides the system status bar
 * (and navigation bar on Android) so the video stage can use the full display.
 */
export function useMeetingFullscreen(_target?: unknown) {
  const [active, setActive] = useState(false)
  const activeRef = useRef(false)

  useEffect(() => {
    return () => {
      if (!activeRef.current) return
      activeRef.current = false
      StatusBar.setHidden(false, 'fade')
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(true)
      }
    }
  }, [])

  const toggle = useCallback(async () => {
    const next = !activeRef.current
    activeRef.current = next
    StatusBar.setHidden(next, 'fade')
    if (Platform.OS === 'android') {
      // Immersive: translucent bar so meeting chrome can draw edge-to-edge.
      StatusBar.setTranslucent(true)
      StatusBar.setBackgroundColor(next ? 'transparent' : 'rgba(0,0,0,0.35)', true)
    }
    setActive(next)
  }, [])

  return {
    supported: true,
    active,
    toggle,
    unsupportedMessage: '',
  }
}
