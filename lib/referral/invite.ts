import AsyncStorage from '@react-native-async-storage/async-storage'

import { supabase } from '~/lib/supabase/client'
import { buildAbsoluteUrl } from '~/lib/platform/url'

const PENDING_INVITE_KEY = 'sheconomy:pending-invite-code'

export function getInviteShareUrl(code: string): string {
  return buildAbsoluteUrl(`/invite/${encodeURIComponent(code.trim())}`)
}

export async function storePendingInviteCode(code: string): Promise<void> {
  const trimmed = code.trim().toUpperCase()
  if (!trimmed) return
  try {
    await AsyncStorage.setItem(PENDING_INVITE_KEY, trimmed)
  } catch {
    // ignore storage failures
  }
}

export async function peekPendingInviteCode(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_INVITE_KEY)
    const trimmed = raw?.trim().toUpperCase()
    return trimmed || null
  } catch {
    return null
  }
}

export async function clearPendingInviteCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_INVITE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Attach a pending invite to the signed-in profile once (sets referred_by).
 * Soft success — never blocks auth if referral attach fails.
 */
export async function applyPendingReferralForUser(userId: string): Promise<{
  applied: boolean
  error: string | null
}> {
  const code = await peekPendingInviteCode()
  if (!code) return { applied: false, error: null }

  const { data: me, error: meError } = await supabase
    .from('profiles')
    .select('id, referral_code, referred_by')
    .eq('id', userId)
    .maybeSingle()

  if (meError) return { applied: false, error: meError.message }
  if (!me) return { applied: false, error: 'Profile not ready' }
  if (me.referred_by) {
    await clearPendingInviteCode()
    return { applied: false, error: null }
  }
  if (me.referral_code && me.referral_code.toUpperCase() === code) {
    await clearPendingInviteCode()
    return { applied: false, error: null }
  }

  const { data: referrer, error: referrerError } = await supabase
    .from('profiles')
    .select('id')
    .ilike('referral_code', code)
    .maybeSingle()

  if (referrerError) return { applied: false, error: referrerError.message }
  if (!referrer?.id || referrer.id === userId) {
    await clearPendingInviteCode()
    return { applied: false, error: 'Invite code not found' }
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ referred_by: referrer.id } as never)
    .eq('id', userId)
    .is('referred_by', null)

  if (updateError) return { applied: false, error: updateError.message }

  await clearPendingInviteCode()
  return { applied: true, error: null }
}

/** Ensure the member has a referral_code (generate via RPC if missing). */
export async function ensureReferralCode(userId: string): Promise<{
  code: string | null
  error: string | null
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', userId)
    .maybeSingle()

  if (error) return { code: null, error: error.message }
  if (data?.referral_code) return { code: data.referral_code, error: null }

  const { data: generated, error: rpcError } = await supabase.rpc(
    'generate_referral_code' as never,
  )
  if (rpcError || typeof generated !== 'string' || !generated.trim()) {
    return { code: null, error: rpcError?.message ?? 'Could not generate invite code' }
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ referral_code: generated.trim() } as never)
    .eq('id', userId)

  if (updateError) return { code: null, error: updateError.message }
  return { code: generated.trim(), error: null }
}
