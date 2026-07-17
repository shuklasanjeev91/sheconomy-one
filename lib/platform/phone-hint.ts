import { NativeModules, Platform } from 'react-native'

export type PhoneHintResult = {
  phoneNumber: string | null
  error: string | null
}

/**
 * Android Phone Number Hint / SIM-linked suggestion via Play Services
 * (`react-native-otp-verify` requestHint).
 * No-ops when the native module is missing (e.g. incomplete rebuild).
 */
export async function requestPhoneNumberHint(): Promise<PhoneHintResult> {
  if (Platform.OS !== 'android' || !NativeModules.OtpVerify) {
    return { phoneNumber: null, error: null }
  }

  try {
    const { requestHint } = await import('react-native-otp-verify')
    const phone = await requestHint()
    return { phoneNumber: phone?.trim() || null, error: null }
  } catch (error) {
    return {
      phoneNumber: null,
      error: error instanceof Error ? error.message : null,
    }
  }
}

export function isPhoneHintSupported(): boolean {
  return Platform.OS === 'android' && !!NativeModules.OtpVerify
}
