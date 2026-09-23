import type { User } from '@supabase/supabase-js'

import { supabase } from '~/lib/supabase/client'
import {
  loadRememberedMeetingDisplayName,
  normalizeMeetingDisplayName,
  saveRememberedMeetingDisplayName,
} from '~/co-work/lib/meeting-display-name'

const GUEST_METADATA_KEY = 'is_guest'

export function isGuestUser(user?: User | null): boolean {
  if (!user) return false
  if (user.is_anonymous) return true
  const meta = user.user_metadata as Record<string, unknown> | undefined
  if (meta?.[GUEST_METADATA_KEY] === true) return true
  const appMeta = user.app_metadata as Record<string, unknown> | undefined
  return appMeta?.[GUEST_METADATA_KEY] === true
}

/**
 * Ensures the client has an active Supabase user session.
 * If already authenticated (member or existing guest), updates display name if needed and returns the user.
 * If unauthenticated, silently provisions a guest session with the specified display name.
 */
export async function ensureGuestUserSession(preferredDisplayName?: string): Promise<User> {
  const { data: sessionData } = await supabase.auth.getSession()
  const existingUser = sessionData?.session?.user

  const trimmedName = preferredDisplayName?.trim()
  const cleanedName = trimmedName ? normalizeMeetingDisplayName(trimmedName) : null
  const rememberedName = await loadRememberedMeetingDisplayName()
  const resolvedDisplayName = cleanedName || rememberedName || 'Guest'

  if (existingUser) {
    if (trimmedName) {
      await saveRememberedMeetingDisplayName(trimmedName)
    }
    return existingUser
  }

  // Mint a lightweight guest account on Supabase.
  // Email auto-confirmation is enabled in this project so signUp establishes an active session immediately.
  const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const guestEmail = `guest_${uniqueId}@sheconomy.internal`
  const guestPassword = `Guest!${Math.random().toString(36).slice(2)}_${Date.now()}Aa1`

  const { data: authResult, error: signUpError } = await supabase.auth.signUp({
    email: guestEmail,
    password: guestPassword,
    options: {
      data: {
        full_name: resolvedDisplayName,
        username: `guest_${uniqueId.slice(0, 12)}`,
        is_guest: true,
      },
    },
  })

  if (signUpError || !authResult.user) {
    throw new Error(signUpError?.message || 'Could not initialize guest meeting session.')
  }

  if (trimmedName) {
    await saveRememberedMeetingDisplayName(trimmedName)
  }

  return authResult.user
}
