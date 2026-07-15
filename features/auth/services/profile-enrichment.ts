import type { User } from '@supabase/supabase-js'
import { Platform } from 'react-native'

import { importSocialProfileHints } from '~/features/auth/services/social-profile-hints'
import { getCountryName, getDefaultCountryCode } from '~/lib/geo/data'
import { createInitialProfile } from '~/lib/profile/profile.service'
import { supabase } from '~/lib/supabase/client'

export type OnboardingProfile = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  phone_verified: boolean | null
  email_verified: boolean | null
  preferred_language: string | null
  interests: string[] | null
  timezone: string | null
  country_code: string | null
  member_intents: string[] | null
  onboarding_completed_at: string | null
  profile_completion_percentage: number | null
  location: string | null
  date_of_birth: string | null
}

export function detectDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export async function detectPreferredLanguage(): Promise<string> {
  try {
    if (Platform.OS !== 'web') {
      const Localization = await import('expo-localization')
      const code = Localization.getLocales()?.[0]?.languageCode
      if (code) return code.toLowerCase().slice(0, 8)
    }
  } catch {
    // fall through
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.split('-')[0]?.toLowerCase() || 'en'
  }
  return 'en'
}

export function detectCountryCode(): string {
  return getDefaultCountryCode()
}

const PROFILE_SELECT =
  'id, full_name, email, phone, avatar_url, phone_verified, email_verified, preferred_language, interests, timezone, country_code, member_intents, onboarding_completed_at, profile_completion_percentage, location, date_of_birth'

export async function fetchOnboardingProfile(
  userId: string,
): Promise<OnboardingProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null
  return data as unknown as OnboardingProfile
}

/**
 * Sparse-fill profile fields from auth metadata + device locale.
 * Never overwrites non-empty profile values.
 */
export async function enrichProfileFromAuth(user?: User | null): Promise<{
  profile: OnboardingProfile | null
  error: string | null
}> {
  const {
    data: { user: sessionUser },
  } = user ? { data: { user } } : await supabase.auth.getUser()

  const authUser = user ?? sessionUser
  if (!authUser) return { profile: null, error: 'Not signed in' }

  let profile = await fetchOnboardingProfile(authUser.id)
  if (!profile) {
    await createInitialProfile(authUser)
    profile = await fetchOnboardingProfile(authUser.id)
  }
  if (!profile) return { profile: null, error: 'Profile not found' }

  const hints = importSocialProfileHints(authUser)
  const language = await detectPreferredLanguage()
  const timezone = detectDeviceTimezone()
  const country = detectCountryCode()

  const patch: Record<string, unknown> = {}

  if (!profile.full_name?.trim() && hints.fullName) patch.full_name = hints.fullName
  if (!profile.email?.trim() && (hints.email || authUser.email)) {
    patch.email = hints.email || authUser.email
  }
  if (!profile.phone?.trim() && authUser.phone) patch.phone = authUser.phone
  if (!profile.avatar_url?.trim() && hints.avatarUrl) patch.avatar_url = hints.avatarUrl
  if (!profile.timezone?.trim()) patch.timezone = timezone
  if (!profile.country_code?.trim()) patch.country_code = country
  if (!profile.preferred_language?.trim()) patch.preferred_language = language
  if (!profile.location?.trim()) {
    const countryName = getCountryName(country)
    if (countryName) patch.location = countryName
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from('profiles')
      .update(patch as never)
      .eq('id', authUser.id)
    if (error) return { profile, error: error.message }
  }

  // Refresh completion percentage from RPC when available.
  try {
    await supabase.rpc('calculate_profile_completion', { profile_id: authUser.id })
  } catch {
    // ignore
  }

  const next = await fetchOnboardingProfile(authUser.id)
  return { profile: next ?? profile, error: null }
}
