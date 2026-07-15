import type { OtpAutofillService } from '~/features/auth/types'
import { normalizeOtpDigits } from '~/features/auth/validation'

type OtpCredentialLike = {
  code?: string
}

let activeAbort: AbortController | null = null

function supportsWebOtp(): boolean {
  return (
    typeof window !== 'undefined' &&
    'OTPCredential' in window &&
    typeof navigator !== 'undefined' &&
    !!navigator.credentials
  )
}

export const otpAutofillService: OtpAutofillService = {
  isSupported() {
    return supportsWebOtp()
  },

  async startListening(options) {
    if (!supportsWebOtp()) return null

    this.stopListening()
    const controller = new AbortController()
    activeAbort = controller

    const onAbort = () => controller.abort()
    options?.abortSignal?.addEventListener('abort', onAbort)

    const timeout = setTimeout(() => controller.abort(), 120_000)

    try {
      const credential = (await (
        navigator.credentials as CredentialsContainer & {
          get: (options: unknown) => Promise<OtpCredentialLike | null>
        }
      ).get({
        otp: { transport: ['sms'] },
        signal: controller.signal,
      })) as OtpCredentialLike | null

      const code = credential?.code ? normalizeOtpDigits(credential.code) : null
      return code && code.length === 6 ? code : null
    } catch {
      return null
    } finally {
      clearTimeout(timeout)
      options?.abortSignal?.removeEventListener('abort', onAbort)
      if (activeAbort === controller) activeAbort = null
    }
  },

  stopListening() {
    activeAbort?.abort()
    activeAbort = null
  },
}

export default otpAutofillService
