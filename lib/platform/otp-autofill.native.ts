import { Platform } from 'react-native'

import type { OtpAutofillService } from '~/features/auth/types'

/**
 * Native OTP autofill uses OS keyboard suggestions via TextInput props:
 * - iOS: textContentType="oneTimeCode"
 * - Android: autoComplete="sms-otp" (Play Services SMS Retriever / autofill)
 *
 * We do not request READ_SMS / RECEIVE_SMS. A dedicated SMS Retriever
 * native listener can be layered later; for now listening is a no-op and
 * the OTP field accepts OS autofill + paste.
 */

let listening = false

export const otpAutofillService: OtpAutofillService = {
  isSupported() {
    return Platform.OS === 'ios' || Platform.OS === 'android'
  },

  async startListening() {
    listening = true
    // OS fills the focused OTP field; no inbox read.
    return null
  },

  stopListening() {
    listening = false
  },
}

/** True while OTP screen has activated native listening lifecycle. */
export function isNativeOtpListening() {
  return listening
}

export default otpAutofillService
