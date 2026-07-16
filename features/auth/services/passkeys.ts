import { Platform } from 'react-native'

import { supabase } from '~/lib/supabase/client'

export type PasskeyInfo = {
  id: string
  friendly_name?: string | null
  created_at?: string | null
  last_used_at?: string | null
}

/**
 * Feature-detect WebAuthn / platform authenticators.
 * Web: PublicKeyCredential. Native: enable when host provides WebAuthn (SDK path).
 */
export function isPasskeySignInSupported(): boolean {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return false
    return typeof window.PublicKeyCredential !== 'undefined'
  }

  // Native: Supabase passkey API can run where the runtime bridges WebAuthn
  // (newer Expo / RN hosts). Prefer showing the CTA; failures toast gracefully.
  return Platform.OS === 'ios' || Platform.OS === 'android'
}

export async function signInWithPasskey(): Promise<{ error: string | null }> {
  if (!isPasskeySignInSupported()) {
    return { error: 'Passkeys are not available on this device yet.' }
  }

  try {
    const { error } = await supabase.auth.signInWithPasskey()
    if (error) return { error: error.message }
    return { error: null }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Passkey sign-in failed. Enable Passkeys in Supabase Auth if needed.',
    }
  }
}

export async function registerPasskey(friendlyName?: string): Promise<{ error: string | null }> {
  if (!isPasskeySignInSupported()) {
    return { error: 'Passkeys are not available on this device yet.' }
  }

  try {
    const { data, error } = await supabase.auth.registerPasskey()
    if (error) return { error: error.message }
    if (friendlyName && data?.id) {
      const rename = await supabase.auth.passkey.update({
        passkeyId: data.id,
        friendlyName,
      })
      if (rename.error) return { error: rename.error.message }
    }
    return { error: null }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Could not register passkey. Check that Passkeys are enabled for this project.',
    }
  }
}

export async function listPasskeys(): Promise<{ passkeys: PasskeyInfo[]; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.passkey.list()
    if (error) return { passkeys: [], error: error.message }
    return { passkeys: (data ?? []) as PasskeyInfo[], error: null }
  } catch (error) {
    return {
      passkeys: [],
      error: error instanceof Error ? error.message : 'Could not load passkeys',
    }
  }
}

export async function deletePasskey(passkeyId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.passkey.delete({ passkeyId })
    return { error: error?.message ?? null }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not delete passkey',
    }
  }
}

export async function renamePasskey(
  passkeyId: string,
  friendlyName: string,
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.passkey.update({
      passkeyId,
      friendlyName,
    })
    return { error: error?.message ?? null }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not rename passkey',
    }
  }
}
