import {
  getDefaultDeviceLabel,
  getDevicePlatform,
  getOrCreateDeviceId,
  getUserAgent,
} from '~/features/auth/services/device-id'
import { supabase } from '~/lib/supabase/client'

export type AuthLoginSession = {
  id: string
  user_id: string
  auth_session_id: string | null
  device_id: string
  device_label: string | null
  platform: string
  user_agent: string | null
  ip: string | null
  geo: Record<string, unknown> | null
  is_suspicious: boolean
  revoked_at: string | null
  last_seen_at: string
  created_at: string
  is_current?: boolean
}

type RecordResult = {
  session: AuthLoginSession | null
  is_suspicious: boolean
  error: string | null
}

/** Record / refresh this device's login session after authenticated events. */
export async function recordLoginSession(options?: {
  provider?: string | null
}): Promise<RecordResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return { session: null, is_suspicious: false, error: 'Not signed in' }
  }

  const deviceId = await getOrCreateDeviceId()
  const { data, error } = await supabase.rpc('record_auth_login_session' as never, {
    p_device_id: deviceId,
    p_device_label: getDefaultDeviceLabel(),
    p_platform: getDevicePlatform(),
    p_user_agent: getUserAgent(),
    p_auth_session_id: session.access_token?.slice(0, 36) ?? null,
    p_provider: options?.provider ?? null,
  } as never)

  if (error) {
    return { session: null, is_suspicious: false, error: error.message }
  }

  const row = data as {
    session?: AuthLoginSession
    is_suspicious?: boolean
  } | null

  return {
    session: row?.session ?? null,
    is_suspicious: Boolean(row?.is_suspicious),
    error: null,
  }
}

export async function listLoginSessions(): Promise<{
  sessions: AuthLoginSession[]
  error: string | null
}> {
  const deviceId = await getOrCreateDeviceId()
  const { data, error } = await supabase
    .from('auth_login_sessions' as never)
    .select('*')
    .is('revoked_at', null)
    .order('last_seen_at', { ascending: false })

  if (error) return { sessions: [], error: error.message }

  const sessions = ((data ?? []) as AuthLoginSession[]).map((row) => ({
    ...row,
    is_current: row.device_id === deviceId,
  }))

  return { sessions, error: null }
}

export async function revokeLoginSession(sessionId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('revoke_auth_login_session' as never, {
    p_session_id: sessionId,
  } as never)
  return { error: error?.message ?? null }
}

export async function revokeOtherLoginSessions(): Promise<{ error: string | null }> {
  const deviceId = await getOrCreateDeviceId()
  const { error } = await supabase.rpc('revoke_other_auth_login_sessions' as never, {
    p_keep_device_id: deviceId,
  } as never)
  return { error: error?.message ?? null }
}

export async function revokeAllLoginSessions(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('revoke_all_auth_login_sessions' as never)
  return { error: error?.message ?? null }
}

/** Mark this install's session row revoked (local sign-out). */
export async function revokeCurrentLoginSession(): Promise<{ error: string | null }> {
  const deviceId = await getOrCreateDeviceId()
  const { data, error: listError } = await supabase
    .from('auth_login_sessions' as never)
    .select('id')
    .eq('device_id', deviceId)
    .is('revoked_at', null)
    .maybeSingle()

  if (listError) return { error: listError.message }
  const id = (data as { id?: string } | null)?.id
  if (!id) return { error: null }
  return revokeLoginSession(id)
}

const HEARTBEAT_STORAGE_KEY = 'sheconomy.auth.last_heartbeat'

let lastHeartbeat = 0

function getStoredHeartbeat(): number {
  if (lastHeartbeat > 0) return lastHeartbeat
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem(HEARTBEAT_STORAGE_KEY)
      if (stored) {
        lastHeartbeat = Number(stored) || 0
      }
    } catch {}
  }
  return lastHeartbeat
}

function setStoredHeartbeat(ts: number) {
  lastHeartbeat = ts
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(HEARTBEAT_STORAGE_KEY, String(ts))
    } catch {}
  }
}

/** Throttled last-seen heartbeat for the current device (5-minute cooldown). */
export async function heartbeatLoginSession(): Promise<void> {
  const now = Date.now()
  if (now - getStoredHeartbeat() < 5 * 60 * 1000) return
  setStoredHeartbeat(now)
  await recordLoginSession()
}
