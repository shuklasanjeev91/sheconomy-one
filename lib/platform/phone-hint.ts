import { NativeModules, Platform } from 'react-native'

export type PhoneHintResult = {
  phoneNumber: string | null
  error: string | null
}

/** Single-flight so React Strict Mode remounts share one Play Services hint dialog. */
let phoneHintInFlight: Promise<PhoneHintResult> | null = null

const HINT_TIMEOUT_MS = 120_000

/**
 * Android Phone Number Hint / SIM-linked suggestion via Play Services
 * (`react-native-otp-verify` requestHint).
 * No-ops when the native module is missing (e.g. incomplete rebuild).
 */
export async function requestPhoneNumberHint(): Promise<PhoneHintResult> {
  if (Platform.OS !== 'android' || !NativeModules.OtpVerify) {
    return { phoneNumber: null, error: null }
  }

  if (phoneHintInFlight) return phoneHintInFlight

  phoneHintInFlight = (async () => {
    try {
      const { requestHint } = await import('react-native-otp-verify')
      const phone = await Promise.race([
        requestHint(),
        new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error('Phone number picker timed out.')), HINT_TIMEOUT_MS)
        }),
      ])
      return { phoneNumber: phone?.trim() || null, error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '')
      // User dismissed the picker — not an actionable failure.
      if (message.includes('USER_CANCELLED') || message.toLowerCase().includes('cancel')) {
        return { phoneNumber: null, error: null }
      }
      return {
        phoneNumber: null,
        error: message || null,
      }
    } finally {
      // Allow a later manual retry after the dialog settles.
      phoneHintInFlight = null
    }
  })()

  return phoneHintInFlight
}

export function isPhoneHintSupported(): boolean {
  return Platform.OS === 'android' && !!NativeModules.OtpVerify
}
