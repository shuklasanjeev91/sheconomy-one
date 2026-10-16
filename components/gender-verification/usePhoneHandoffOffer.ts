import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import {
  deviceHasWebcam,
  isMobileVerificationDevice,
  shouldUsePhoneHandoff,
} from '~/lib/gender-verification/handoff'

export type PhoneHandoffMode = 'checking' | 'qr' | 'camera'

/**
 * Computers and web devices with no camera show a QR code. A phone with a
 * camera runs verification here. `disabled` forces the camera path (the phone
 * that just scanned the code).
 */
export function usePhoneHandoffOffer(disabled = false) {
  const [mode, setMode] = useState<PhoneHandoffMode>(
    disabled || Platform.OS !== 'web' ? 'camera' : 'checking',
  )
  const [canUseCamera, setCanUseCamera] = useState(Platform.OS !== 'web')
  const [isDesktopWeb, setIsDesktopWeb] = useState(false)

  useEffect(() => {
    if (disabled || Platform.OS !== 'web') return
    let cancelled = false
    void (async () => {
      const hasWebcam = await deviceHasWebcam()
      if (cancelled) return
      const isMobile = isMobileVerificationDevice()
      setCanUseCamera(hasWebcam)
      setIsDesktopWeb(!isMobile)
      setMode(
        shouldUsePhoneHandoff({ isNative: false, isMobile, hasWebcam }) ? 'qr' : 'camera',
      )
    })()
    return () => {
      cancelled = true
    }
  }, [disabled])

  return {
    mode,
    canUseCamera,
    /** Desktop already in the camera flow can switch back to the QR code. */
    canSwitchToPhone: !disabled && isDesktopWeb && mode === 'camera',
    chooseCamera: () => setMode('camera'),
    choosePhone: () => setMode('qr'),
  }
}
