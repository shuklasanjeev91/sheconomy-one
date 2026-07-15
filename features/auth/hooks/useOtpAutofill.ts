import { useEffect } from 'react'

import { otpAutofillService } from '~/lib/platform/otp-autofill'
import { isCompleteOtp } from '~/features/auth/validation'

/**
 * Start platform OTP listening while the verification step is visible.
 * Cleans up on unmount / when disabled.
 */
export function useOtpAutofill(options: {
  enabled: boolean
  onCode: (code: string) => void
}) {
  const { enabled, onCode } = options

  useEffect(() => {
    if (!enabled || !otpAutofillService.isSupported()) return

    const controller = new AbortController()
    let cancelled = false

    void (async () => {
      const code = await otpAutofillService.startListening({
        abortSignal: controller.signal,
      })
      if (cancelled || !code || !isCompleteOtp(code)) return
      onCode(code)
    })()

    return () => {
      cancelled = true
      controller.abort()
      otpAutofillService.stopListening()
    }
  }, [enabled, onCode])
}
