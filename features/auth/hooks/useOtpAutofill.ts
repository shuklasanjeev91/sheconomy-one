import { useEffect, useRef } from 'react'

import { otpAutofillService } from '~/lib/platform/otp-autofill'
import { isCompleteOtp } from '~/features/auth/validation'

/**
 * Start platform OTP listening while the verification step is visible.
 * Cleans up on unmount / when disabled.
 *
 * iOS: no-op listener (OS oneTimeCode + paste/clipboard handled by OtpCodeInput).
 * Android: SMS Retriever when react-native-otp-verify is linked.
 */
export function useOtpAutofill(options: {
  enabled: boolean
  onCode: (code: string) => void
}) {
  const { enabled, onCode } = options
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode

  useEffect(() => {
    if (!enabled || !otpAutofillService.isSupported()) return

    const controller = new AbortController()
    let cancelled = false

    void (async () => {
      try {
        const code = await otpAutofillService.startListening({
          abortSignal: controller.signal,
        })
        if (cancelled || !code || !isCompleteOtp(code)) return
        onCodeRef.current(code)
      } catch {
        // Native SMS listener is best-effort; manual entry / paste still work.
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
      try {
        otpAutofillService.stopListening()
      } catch {
        // ignore
      }
    }
  }, [enabled])
}
