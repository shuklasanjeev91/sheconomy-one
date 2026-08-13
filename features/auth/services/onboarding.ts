import type { OnboardingProfile } from '~/features/auth/services/profile-enrichment'
import { isSafeReturnPath } from '~/lib/auth/redirect'
import { classRoutes, commerceRoutes, communityRoutes } from '~/lib/routes'
import { supabase } from '~/lib/supabase/client'

export const MEMBER_INTENTS = [
  { id: 'shopping', label: 'Shopping', description: 'Discover products and deals' },
  { id: 'selling', label: 'Selling', description: 'Open a shop and list products' },
  { id: 'learning', label: 'Learning', description: 'Take classes and skill up' },
  { id: 'networking', label: 'Networking', description: 'Grow your professional circle' },
  { id: 'hiring', label: 'Hiring', description: 'Find talent and opportunities' },
] as const

export type MemberIntentId = (typeof MEMBER_INTENTS)[number]['id']

const INTENT_ROUTE_PRIORITY: Array<{ id: MemberIntentId; href: string }> = [
  { id: 'selling', href: String(commerceRoutes.createShop) },
  { id: 'hiring', href: String(communityRoutes.jobs) },
  { id: 'networking', href: String(communityRoutes.home) },
  { id: 'learning', href: String(classRoutes.home) },
]

/**
 * Where to land after complete-profile Finish.
 * Explicit safe `returnTo` wins; otherwise first matching intent by priority.
 */
export function resolvePostOnboardingHref(
  intents: readonly string[],
  returnTo?: string | null,
): string {
  const trimmed = typeof returnTo === 'string' ? returnTo.trim() : ''
  if (trimmed && isSafeReturnPath(trimmed) && trimmed !== '/') {
    return trimmed
  }

  const selected = new Set(intents)
  for (const entry of INTENT_ROUTE_PRIORITY) {
    if (selected.has(entry.id)) return entry.href
  }

  return String(commerceRoutes.home)
}

/** Contact import only when the intent destination is shopping/commerce home. */
export function shouldOfferContactsAfterOnboarding(
  intents: readonly string[],
  returnTo?: string | null,
): boolean {
  return resolvePostOnboardingHref(intents, returnTo) === String(commerceRoutes.home)
}

export const ONBOARDING_INTEREST_OPTIONS = [
  'Entrepreneurship',
  'Fashion',
  'Beauty',
  'Wellness',
  'Technology',
  'Finance',
  'Marketing',
  'Education',
  'Leadership',
  'Sustainability',
  'Art & Design',
  'Food & Cooking',
  'Parenting',
  'Travel',
  'Community',
  'Mental health',
] as const

const COMPLETION_THRESHOLD = 40

export function needsProfileOnboarding(profile: OnboardingProfile | null | undefined): boolean {
  if (!profile) return true
  if (profile.onboarding_completed_at) return false

  const pct = profile.profile_completion_percentage ?? 0
  const missingName = !profile.full_name?.trim()
  const missingAvatar = !profile.avatar_url?.trim()
  const missingInterests = !profile.interests?.length

  return pct < COMPLETION_THRESHOLD || missingName || missingAvatar || missingInterests
}

export async function updateOnboardingBasics(input: {
  userId: string
  fullName: string
}): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: input.fullName.trim() } as never)
    .eq('id', input.userId)
  return { error: error?.message ?? null }
}

export async function updateOnboardingPreferences(input: {
  userId: string
  countryCode: string
  timezone: string
  preferredLanguage: string
  location?: string | null
  dateOfBirth?: string | null
}): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = {
    country_code: input.countryCode.trim().toUpperCase(),
    timezone: input.timezone.trim(),
    preferred_language: input.preferredLanguage.trim().toLowerCase(),
  }
  if (input.location?.trim()) patch.location = input.location.trim()
  if (input.dateOfBirth !== undefined) {
    patch.date_of_birth = input.dateOfBirth?.trim() || null
  }

  const { error } = await supabase.from('profiles').update(patch as never).eq('id', input.userId)
  return { error: error?.message ?? null }
}

/** Which wizard steps still need user input (smart skip). */
export function resolveOnboardingSteps(profile: OnboardingProfile | null): Array<
  'basics' | 'phone' | 'prefs' | 'interests' | 'intents'
> {
  const steps: Array<'basics' | 'phone' | 'prefs' | 'interests' | 'intents'> = []

  // Always show basics so users can review imported name/photo.
  steps.push('basics')

  if (!profile?.phone_verified) steps.push('phone')

  const prefsComplete = Boolean(
    profile?.preferred_language?.trim() &&
      profile?.timezone?.trim() &&
      profile?.country_code?.trim(),
  )
  if (!prefsComplete) steps.push('prefs')

  if (!profile?.interests?.length) steps.push('interests')
  if (!profile?.member_intents?.length) steps.push('intents')

  // Ensure at least intents finish step exists so markOnboardingCompleted can run.
  if (!steps.includes('intents')) steps.push('intents')

  return steps
}

export async function updateOnboardingInterests(
  userId: string,
  interests: string[],
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ interests } as never)
    .eq('id', userId)
  return { error: error?.message ?? null }
}

export async function updateOnboardingIntents(
  userId: string,
  intents: string[],
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ member_intents: intents } as never)
    .eq('id', userId)
  return { error: error?.message ?? null }
}

export async function markOnboardingCompleted(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() } as never)
    .eq('id', userId)

  try {
    await supabase.rpc('calculate_profile_completion', { profile_id: userId })
  } catch {
    // ignore
  }

  return { error: error?.message ?? null }
}

export async function refreshCompletionPercentage(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('calculate_profile_completion', {
    profile_id: userId,
  })
  const score = !error && typeof data === 'number' ? data : null
  if (score != null) {
    await supabase
      .from('profiles')
      .update({ profile_completion_percentage: score } as never)
      .eq('id', userId)
    return score
  }
  const { data: row } = await supabase
    .from('profiles')
    .select('profile_completion_percentage')
    .eq('id', userId)
    .maybeSingle()
  return (
    (row as { profile_completion_percentage?: number | null } | null)
      ?.profile_completion_percentage ?? 0
  )
}
