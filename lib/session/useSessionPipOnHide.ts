import { useEffect } from 'react'

import { holdAndroidAutoPip } from '~/lib/session/android-pip'

/**
 * Native: Android enters Activity PiP when the user leaves the app mid-session.
 * iOS auto-starts AVKit PiP from the RTCView (`startAutomatically`).
 * Pass false while sharing the screen: the PiP window would be captured into the share.
 */
export function useSessionPipOnHide(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    return holdAndroidAutoPip()
  }, [enabled])
}
