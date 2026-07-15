import { Platform } from 'react-native'

import type { OtpAutofillService } from '~/features/auth/types'
import { normalizeOtpDigits } from '~/features/auth/validation'

/**
 * Native OTP autofill:
 * - iOS: OS keyboard suggestions via textContentType="oneTimeCode"
 * - Android: SMS Retriever (preferred when SMS includes app hash) via
 *   react-native-otp-verify; User Consent path is used by the same listener
 *   when Retriever hashing is unavailable
 *
 * Never requests READ_SMS / RECEIVE_SMS.
 */

let listening = false

function extractCode(message: string): string | null {
  const match = message.match(/\b(\d{6})\b/)
  return match?.[1] ? normalizeOtpDigits(match[1]) : null
}

async function startAndroidSmsListen(
  abortSignal?: AbortSignal,
): Promise<string | null> {
  try {
    const {
      getHash,
      getOtp,
      addListener,
      removeListener,
    } = await import('react-native-otp-verify')

    if (typeof getHash === 'function') {
      try {
        const hashes = await getHash()
        if (__DEV__ && hashes?.length) {
          console.info('[otp-autofill] Android SMS app hashes', hashes)
        }
      } catch {
        // Hash lookup is best-effort for SMS Retriever templates.
      }
    }

    await getOtp()

    return await new Promise<string | null>((resolve) => {
      let settled = false
      const finish = (code: string | null) => {
        if (settled) return
        settled = true
        try {
          removeListener()
        } catch {
          // ignore
        }
        resolve(code)
      }

      const onAbort = () => finish(null)
      if (abortSignal?.aborted) {
        onAbort()
        return
      }
      abortSignal?.addEventListener('abort', onAbort, { once: true })

      addListener((message: string) => {
        abortSignal?.removeEventListener('abort', onAbort)
        finish(extractCode(message))
      })
    })
  } catch {
    return null
  }
}

export const otpAutofillService: OtpAutofillService = {
  isSupported() {
    return Platform.OS === 'ios' || Platform.OS === 'android'
  },

  async startListening(options?: { abortSignal?: AbortSignal }) {
    listening = true
    if (Platform.OS === 'android') {
      return startAndroidSmsListen(options?.abortSignal)
    }
    return null
  },

  stopListening() {
    listening = false
    void import('react-native-otp-verify')
      .then((mod) => {
        try {
          mod.removeListener()
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // Module unavailable on this build.
      })
  },
}

export function isNativeOtpListening() {
  return listening
}

export default otpAutofillService
