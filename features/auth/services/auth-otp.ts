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
  try {
    const { error } = await sendSupabaseOtp(input.channel, input.identifier, {
      fullName: input.fullName,
    })

    if (error) {
      const mapped = mapAuthErrorMessage(error.message, { code: error.code })
      return {
        success: false,
        verificationId: '',
        expiresIn: 0,
        resendAfter: 30,
        error: mapped.text,
      }
    }
  } catch (error) {
    const mapped = mapAuthErrorMessage(error instanceof Error ? error.message : null)
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
  let data: Awaited<ReturnType<typeof verifySupabaseOtp>>['data']
  try {
    const result = await verifySupabaseOtp(input.channel, input.identifier, input.otp.trim())
    if (result.error) {
      const mapped = mapAuthErrorMessage(result.error.message, { code: result.error.code })
      return { success: false, error: mapped.text, code: mapped.code }
    }
    data = result.data
  } catch (error) {
    const mapped = mapAuthErrorMessage(error instanceof Error ? error.message : null)
    return { success: false, error: mapped.text, code: mapped.code }
  }

  const session = data.session
  const user = data.user ?? session?.user
  let accessToken = session?.access_token
  let refreshToken = session?.refresh_token
  let resolved = user

  if (!resolved || !accessToken) {
    try {
      const { data: sessionData } = await getSession()
      resolved = resolved ?? sessionData.session?.user
      accessToken = accessToken ?? sessionData.session?.access_token
      refreshToken = refreshToken ?? sessionData.session?.refresh_token
    } catch {
      // verifyOtp already created the session; missing metadata is non-fatal.
    }
  }

  return {
    success: true,
    accessToken,
    refreshToken,
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
