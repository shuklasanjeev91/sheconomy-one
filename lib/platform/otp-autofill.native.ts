import { NativeModules, Platform } from 'react-native'

import type { OtpAutofillService } from '~/features/auth/types'
import { normalizeOtpDigits } from '~/features/auth/validation'

/**
 * Native OTP autofill:
 * - iOS: OS keyboard suggestions via textContentType="oneTimeCode" (no native module)
 * - Android: SMS Retriever / User Consent via react-native-otp-verify when linked
 *
 * Never requests READ_SMS / RECEIVE_SMS.
 * Never import react-native-otp-verify on iOS — the package has no iOS native code and
 * throws "doesn't seem to be linked" at module load time.
 */

type AndroidOtpVerify = {
  getHash?: () => Promise<string[]>
  getOtp: () => Promise<boolean>
  addListener: (handler: (message: string) => void) => { remove?: () => void }
  removeListener: () => void
}

let listening = false
let androidModule: AndroidOtpVerify | null | undefined

function extractCode(message: string): string | null {
  const match = message.match(/\b(\d{6})\b/)
  return match?.[1] ? normalizeOtpDigits(match[1]) : null
}

function isAndroidOtpVerifyLinked(): boolean {
  return Platform.OS === 'android' && !!NativeModules.OtpVerify
}

async function loadAndroidOtpVerify(): Promise<AndroidOtpVerify | null> {
  if (Platform.OS !== 'android') return null
  if (androidModule !== undefined) return androidModule
  if (!isAndroidOtpVerifyLinked()) {
    androidModule = null
    return null
  }

  try {
    androidModule = (await import('react-native-otp-verify')) as AndroidOtpVerify
    return androidModule
  } catch {
    androidModule = null
    return null
  }
}

async function startAndroidSmsListen(
  abortSignal?: AbortSignal,
): Promise<string | null> {
  const otpVerify = await loadAndroidOtpVerify()
  if (!otpVerify) return null

  try {
    if (typeof otpVerify.getHash === 'function') {
      try {
        const hashes = await otpVerify.getHash()
        if (__DEV__ && hashes?.length) {
          console.info('[otp-autofill] Android SMS app hashes', hashes)
        }
      } catch {
        // Hash lookup is best-effort for SMS Retriever templates.
      }
    }

    await otpVerify.getOtp()

    return await new Promise<string | null>((resolve) => {
      let settled = false
      const finish = (code: string | null) => {
        if (settled) return
        settled = true
        try {
          otpVerify.removeListener()
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

      otpVerify.addListener((message: string) => {
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
    // iOS uses TextInput oneTimeCode; Android uses SMS Retriever when linked.
    return Platform.OS === 'ios' || isAndroidOtpVerifyLinked()
  },

  async startListening(options?: { abortSignal?: AbortSignal }) {
    listening = true
    if (Platform.OS === 'android') {
      return startAndroidSmsListen(options?.abortSignal)
    }
    // iOS: no native SMS listener — rely on textContentType / paste / clipboard.
    return null
  },

  stopListening() {
    listening = false
    if (Platform.OS !== 'android') return

    const mod = androidModule
    if (!mod) return
    try {
      mod.removeListener()
    } catch {
      // ignore
    }
  },
}

export function isNativeOtpListening() {
  return listening
}

export default otpAutofillService
