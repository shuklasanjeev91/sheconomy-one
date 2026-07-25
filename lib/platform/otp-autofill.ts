/** Shared helpers for OTP autofill (platform files provide the service). */

/** Optional 11-char Android SMS Retriever app hash for SMS templates. */
export function getAndroidSmsAppHash(): string | null {
  const value =
    typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_ANDROID_SMS_HASH : undefined
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed.length > 0 ? trimmed : null
}

// Platform entry points: Metro/Vite resolve `.native` / `.web` automatically.
// Re-export web as fallback for tooling that does not apply platform extensions.
export { default, otpAutofillService } from '~/lib/platform/otp-autofill.web'
