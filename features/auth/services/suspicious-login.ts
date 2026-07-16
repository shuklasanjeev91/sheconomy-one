import type { AuthLoginSession } from '~/features/auth/services/login-sessions'
import { revokeOtherLoginSessions } from '~/features/auth/services/login-sessions'
import { signOut as supabaseSignOut } from '~/lib/supabase/auth'

/**
 * Suspicious login heuristic lives in `record_auth_login_session` (new device
 * or IP /16 drift while other sessions are active). Client helpers present the
 * alert and one-tap remediation.
 */

export function hasSuspiciousSessions(sessions: AuthLoginSession[]): boolean {
  return sessions.some((session) => session.is_suspicious && !session.revoked_at)
}

export function getSuspiciousSessions(sessions: AuthLoginSession[]): AuthLoginSession[] {
  return sessions.filter((session) => session.is_suspicious && !session.revoked_at)
}

/** Sign out every other device after a suspicious-login alert. */
export async function signOutOtherDevicesAfterAlert(): Promise<{ error: string | null }> {
  const revoke = await revokeOtherLoginSessions()
  if (revoke.error) return revoke
  const { error } = await supabaseSignOut({ scope: 'others' })
  return { error: error?.message ?? null }
}
