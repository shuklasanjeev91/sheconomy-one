import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'

import {
  cancelGoogleOneTap,
  isGoogleOneTapSupported,
  promptGoogleOneTap,
} from '~/features/auth/services/google-one-tap'
import { useAppToast } from '~/components/ui'

type GoogleOneTapProps = {
  enabled: boolean
  onSuccess?: () => void
}

/**
 * Triggers Google One Tap when consent is accepted on web.
 * Falls back silently when GIS is cancelled / not displayed — buttons remain.
 */
export function GoogleOneTap({ enabled, onSuccess }: GoogleOneTapProps) {
  const toast = useAppToast()
  const running = useRef(false)

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || !isGoogleOneTapSupported()) {
      cancelGoogleOneTap()
      return
    }

    let cancelled = false
    running.current = true

    void (async () => {
      const result = await promptGoogleOneTap()
      if (cancelled) return
      running.current = false
      if (result.error) {
        toast.show(result.error, { tone: 'danger' })
        return
      }
      if (result.cancelled) return
      onSuccess?.()
    })()

    return () => {
      cancelled = true
      cancelGoogleOneTap()
    }
  }, [enabled, onSuccess, toast])

  return null
}
