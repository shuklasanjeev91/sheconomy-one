import { Platform } from 'react-native'

import { supabase } from '~/lib/supabase/client'
import { supabaseConfig } from '~/lib/supabase/env'

export type QrChallenge = {
  id: string
  device_code: string
  expires_at: string
}

function webAppOrigin(): string {
  if (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_WEB_APP_URL) {
    return process.env.EXPO_PUBLIC_WEB_APP_URL.replace(/\/$/, '')
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'https://app.sheconomy.com'
}

/** URL encoded into the QR (opens mobile approve route when scanned). */
export function buildQrLoginUrl(deviceCode: string): string {
  return `${webAppOrigin()}/auth/qr?c=${encodeURIComponent(deviceCode)}`
}

export async function createQrLoginChallenge(): Promise<{
  challenge: QrChallenge | null
  error: string | null
}> {
  const { data, error } = await supabase.rpc('create_qr_login_challenge' as never)
  if (error) return { challenge: null, error: error.message }
  const row = data as QrChallenge
  return { challenge: row, error: null }
}

export async function approveQrLoginChallenge(deviceCode: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('approve_qr_login_challenge' as never, {
    p_device_code: deviceCode,
  } as never)
  return { error: error?.message ?? null }
}

export async function pollQrLoginChallenge(challengeId: string): Promise<{
  status: string
  error: string | null
}> {
  const { data, error } = await supabase.rpc('poll_qr_login_challenge' as never, {
    p_id: challengeId,
  } as never)
  if (error) return { status: 'unknown', error: error.message }
  const row = data as { status?: string }
  return { status: row?.status ?? 'unknown', error: null }
}

/** After mobile approval, mint a session for the web guest via Edge Function. */
export async function redeemQrLoginChallenge(challengeId: string): Promise<{ error: string | null }> {
  const url = `${supabaseConfig.url}/functions/v1/qr-login-redeem`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseConfig.anonKey,
      Authorization: `Bearer ${supabaseConfig.anonKey}`,
    },
    body: JSON.stringify({ challengeId }),
  })

  const payload = (await res.json().catch(() => ({}))) as {
    error?: string
    token_hash?: string
    type?: 'email' | 'sms'
  }

  if (!res.ok || !payload.token_hash) {
    return { error: payload.error || 'Unable to complete QR login.' }
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: payload.token_hash,
    type: payload.type === 'sms' ? 'sms' : 'email',
  })

  if (error) return { error: error.message }
  return { error: null }
}
