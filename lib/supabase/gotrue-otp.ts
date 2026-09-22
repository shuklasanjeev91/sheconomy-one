import { supabaseConfig } from '~/lib/supabase/env'

export const AUTH_OTP_TIMEOUT_MS = 20_000

export const AUTH_OTP_TIMEOUT_MESSAGE =
  'Sending the code is taking too long. Check your connection and try again.'

type GoTrueOtpBody = {
  email?: string
  phone?: string
  create_user: boolean
  data?: { full_name?: string }
  channel?: 'sms'
}

type GoTrueErrorShape = {
  message: string
  name: string
  status: number
  code?: string
}

function asAuthError(message: string, status = 0, code?: string): GoTrueErrorShape {
  return {
    message,
    name: status >= 500 || status === 0 ? 'AuthRetryableFetchError' : 'AuthApiError',
    status,
    code,
  }
}

function emptyOtpResult(error: GoTrueErrorShape | null): {
  data: { user: null; session: null }
  error: GoTrueErrorShape | null
} {
  return {
    data: { user: null, session: null },
    error,
  }
}

function readErrorMessage(payload: Record<string, unknown>, fallback: string) {
  for (const key of ['msg', 'error_description', 'message', 'error'] as const) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return fallback
}

/**
 * POST /auth/v1/otp without PKCE.
 * supabase-js `signInWithOtp` hashes a code challenge first; hung WebCrypto
 * digest leaves the sign-in button on "Sending code…" forever.
 */
export async function requestGoTrueOtp(body: GoTrueOtpBody) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AUTH_OTP_TIMEOUT_MS)

  try {
    const response = await fetch(`${supabaseConfig.url}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${supabaseConfig.anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
      const code = typeof payload.code === 'string' ? payload.code : undefined
      return emptyOtpResult(
        asAuthError(
          readErrorMessage(payload, `Unable to send code (${response.status}).`),
          response.status,
          code,
        ),
      )
    }

    return emptyOtpResult(null)
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    const aborted = name === 'AbortError' || name === 'TimeoutError'
    return emptyOtpResult(
      asAuthError(
        aborted
          ? AUTH_OTP_TIMEOUT_MESSAGE
          : error instanceof Error
            ? error.message
            : 'Unable to send code.',
      ),
    )
  } finally {
    clearTimeout(timer)
  }
}

export function withAuthTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), AUTH_OTP_TIMEOUT_MS)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
