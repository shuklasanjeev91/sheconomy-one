import { supabase } from '~/lib/supabase/client'

export type PasskeyInfo = {
  id: string
  friendly_name?: string | null
  created_at?: string | null
  last_used_at?: string | null
}

const PASSKEY_NOT_ENABLED_MESSAGE =
  'Passkey login is not enabled yet. Use email or phone to continue.'

export function isPasskeyLoginEnabled(): boolean {
  return process.env.EXPO_PUBLIC_ENABLE_PASSKEY_LOGIN === 'true'
}

export function isPasskeyDisabledError(message: string | null | undefined): boolean {
  if (!message) return false
  return /passkeys?\s+(are\s+)?disabled/i.test(message) || /passkeys?.*not enabled/i.test(message)
}

/**
 * Feature-detect WebAuthn / platform authenticators.
 * Only enable when the runtime actually exposes PublicKeyCredential.
 */
export function isPasskeySignInSupported(): boolean {
  if (!isPasskeyLoginEnabled()) return false
  if (typeof globalThis === 'undefined') return false
  const win = (globalThis as { window?: Window }).window
  const nav = (globalThis as { navigator?: Navigator }).navigator
  if (!win || !nav) return false
  return Boolean(
    'PublicKeyCredential' in win &&
      win.PublicKeyCredential &&
      'credentials' in nav &&
      typeof nav.credentials?.create === 'function' &&
      typeof nav.credentials?.get === 'function',
  )
}

export async function signInWithPasskey(): Promise<{ error: string | null; disabled?: boolean }> {
  if (!isPasskeyLoginEnabled()) {
    return { error: PASSKEY_NOT_ENABLED_MESSAGE, disabled: true }
  }
  if (!isPasskeySignInSupported()) {
    return { error: 'Passkeys are not available on this device yet.' }
  }

  try {
    const { error } = await supabase.auth.signInWithPasskey()
    if (error) {
      if (isPasskeyDisabledError(error.message)) {
        return { error: PASSKEY_NOT_ENABLED_MESSAGE, disabled: true }
      }
      return { error: error.message }
    }
    return { error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : null
    if (isPasskeyDisabledError(message)) {
      return { error: PASSKEY_NOT_ENABLED_MESSAGE, disabled: true }
    }
    return {
      error:
        message ?? 'Passkey sign-in failed. Enable Passkeys in Supabase Auth if needed.',
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
