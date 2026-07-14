/** Platform entry — Metro/Vite resolve `.native` / `.web` automatically. */
export { default, otpAutofillService } from './otp-autofill.web'

/** Optional 11-char Android SMS Retriever app hash for SMS templates. */
export function getAndroidSmsAppHash(): string | null {
  const value =
    typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_ANDROID_SMS_HASH : undefined
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed.length > 0 ? trimmed : null
}
