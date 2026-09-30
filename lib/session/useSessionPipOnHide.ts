import { useEffect } from 'react'

import { holdAndroidAutoPip } from '~/lib/session/android-pip'

/**
 * Native: Android enters Activity PiP when the user leaves the app mid-session.
 * iOS auto-starts AVKit PiP from the RTCView (`startAutomatically`).
 */
export function useSessionPipOnHide(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    return holdAndroidAutoPip()
  }, [enabled])
}
