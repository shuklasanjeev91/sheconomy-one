import {
  sendOtp as sendSupabaseOtp,
  verifyOtp as verifySupabaseOtp,
  getSession,
  type OtpChannel,
  type PhoneAuthInput,
} from '~/lib/supabase/auth'
import { mapAuthErrorMessage } from '~/features/auth/validation'
import type { SendOtpResponse, VerifyOtpResponse } from '~/features/auth/types'

export type ClientSendOtpInput = {
  channel: OtpChannel
  identifier: string | PhoneAuthInput
  fullName?: string
  purpose?: 'login' | 'register' | 'verify'
}

/**
 * Client wrapper around Supabase OTP (server verifies codes).
 * Never logs OTP values. verificationId is a client handle for UX state only.
 */
export async function sendAuthOtp(input: ClientSendOtpInput): Promise<SendOtpResponse> {
  const { error } = await sendSupabaseOtp(input.channel, input.identifier, {
    fullName: input.fullName,
  })

  if (error) {
    const mapped = mapAuthErrorMessage(error.message)
    return {
      success: false,
      verificationId: '',
      expiresIn: 0,
      resendAfter: 30,
      error: mapped.text,
    }
  }

  const idBase =
    input.channel === 'email'
      ? String(input.identifier)
      : typeof input.identifier === 'string'
        ? input.identifier
        : `${input.identifier.country.dialCode}${input.identifier.nationalNumber}`

  return {
    success: true,
    verificationId: `${input.channel}:${idBase}:${Date.now()}`,
    expiresIn: 300,
    resendAfter: 30,
  }
}

export async function verifyAuthOtp(input: {
  channel: OtpChannel
  identifier: string | PhoneAuthInput
  otp: string
}): Promise<VerifyOtpResponse> {
  // OTP is passed only to Supabase over HTTPS — never logged.
  const { data, error } = await verifySupabaseOtp(
    input.channel,
    input.identifier,
    input.otp.trim(),
  )

  if (error) {
    const mapped = mapAuthErrorMessage(error.message)
    return { success: false, error: mapped.text, code: mapped.code }
  }

  const session = data.session
  const user = data.user ?? session?.user
  const { data: sessionData } = await getSession()
  const resolved = user ?? sessionData.session?.user

  return {
    success: true,
    accessToken: session?.access_token ?? sessionData.session?.access_token,
    refreshToken: session?.refresh_token ?? sessionData.session?.refresh_token,
    user: resolved
      ? {
          id: resolved.id,
          name:
            (resolved.user_metadata?.full_name as string | undefined) ??
            (resolved.user_metadata?.name as string | undefined) ??
            null,
          email: resolved.email ?? null,
          mobile: resolved.phone ?? null,
        }
      : undefined,
  }
}
