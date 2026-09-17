import { useEffect } from 'react'

import {
  enterGlobalSessionPip,
  peekGlobalSession,
} from '~/lib/session/global-session'
import {
  detectSessionPipCapabilities,
  requestWebSessionPictureInPicture,
} from '~/lib/session/picture-in-picture'

/**
 * When the browser tab is hidden while a fullscreen session is live, try
 * Document/video PiP so media stays visible. Soft-fails when the browser
 * blocks auto-PiP (user gesture required) — minimize still works.
 */
export function useSessionPipOnHide(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return
      const session = peekGlobalSession()
      if (!session || session.presentation !== 'fullscreen') return
      const caps = detectSessionPipCapabilities()
      if (!caps.supported) return

      void (async () => {
        const result = await requestWebSessionPictureInPicture(
          '.sheconomy-meeting-overlay video, video',
        )
        if (result.ok) {
          enterGlobalSessionPip()
        }
      })()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled])
}
