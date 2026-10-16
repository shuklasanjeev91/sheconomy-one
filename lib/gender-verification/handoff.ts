import { buildAbsoluteUrl } from '~/lib/platform/url'
import { supabase } from '~/lib/supabase/client'

export type GenderVerificationHandoff = {
  id: string
  token: string
  expires_at: string
}

export type GenderVerificationHandoffStatus = {
  status: 'pending' | 'opened' | 'verified' | 'expired' | 'missing' | 'unknown'
  failureReason: string | null
}

/** Phones and tablets do the camera check themselves. Computers show a QR code. */
export function isMobileVerificationDevice(userAgent?: string | null): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
}

export async function deviceHasWebcam(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return false
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.some((device) => device.kind === 'videoinput')
  } catch {
    return false
  }
}

/**
 * Desktop, or any web device with no camera, cannot run the face check locally.
 * A phone that scans the QR code opens the handoff URL and starts it there.
 */
export function shouldUsePhoneHandoff(input: {
  isNative: boolean
  isMobile: boolean
  hasWebcam: boolean
}): boolean {
  if (input.isNative) return false
  if (!input.hasWebcam) return true
  return !input.isMobile
}

export function buildGenderVerificationHandoffUrl(token: string): string {
  return buildAbsoluteUrl(`/auth/verify-handoff?t=${encodeURIComponent(token)}`)
}

export async function createGenderVerificationHandoff(): Promise<{
  handoff: GenderVerificationHandoff | null
  error: string | null
}> {
  const { data, error } = await supabase.rpc('create_gender_verification_handoff' as never)
  if (error) return { handoff: null, error: error.message }
  const row = data as GenderVerificationHandoff | null
  if (!row?.id || !row.token) return { handoff: null, error: 'Could not start phone verification.' }
  return { handoff: row, error: null }
}

export async function pollGenderVerificationHandoff(id: string): Promise<GenderVerificationHandoffStatus> {
  const { data, error } = await supabase.rpc('poll_gender_verification_handoff' as never, {
    p_id: id,
  } as never)
  if (error) return { status: 'unknown', failureReason: error.message }
  const row = data as { status?: string; failure_reason?: string | null } | null
  const status = row?.status
  if (
    status === 'pending' ||
    status === 'opened' ||
    status === 'verified' ||
    status === 'expired' ||
    status === 'missing'
  ) {
    return { status, failureReason: row?.failure_reason ?? null }
  }
  return { status: 'unknown', failureReason: null }
}
