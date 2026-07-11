import { PROFILE_COMPLETION, type Profile, type ProfileUpdate } from './profile.type'
import { validateProfileData } from './profile.validation'

/** Fields compared when detecting profile changes / diffs. */
const DEFAULT_DIFF_FIELDS = [
  'full_name',
  'bio',
  'role',
  'business_name',
  'avatar_url',
] as const satisfies readonly (keyof Profile)[]

/**
 * Debounce a function so it only runs after `wait` ms of inactivity.
 */
export function debounce<Args extends unknown[]>(
  func: (...args: Args) => void,
  wait: number,
): (...args: Args) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined

  return function executedFunction(...args: Args) {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttle a function so it runs at most once per `limit` ms.
 */
export function throttle<Args extends unknown[]>(
  func: (...args: Args) => void,
  limit: number,
): (...args: Args) => void {
  let inThrottle = false

  return function executedFunction(...args: Args) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

/**
 * Create a debounced save function for profile updates.
 */
export function createDebouncedProfileSave<Args extends unknown[]>(
  saveFunction: (...args: Args) => void,
  delay = 1000,
): (...args: Args) => void {
  return debounce(saveFunction, delay)
}

/**
 * Merge multiple partial profile updates into a single object.
 */
export function batchProfileUpdates(updates: ProfileUpdate[]): ProfileUpdate {
  return updates.reduce<ProfileUpdate>((batched, update) => Object.assign(batched, update), {})
}

/**
 * Whether two profiles differ across the given fields.
 */
export function hasProfileChanged(
  profile1: Partial<Profile> | null | undefined,
  profile2: Partial<Profile> | null | undefined,
  fields: readonly (keyof Profile)[] = DEFAULT_DIFF_FIELDS,
): boolean {
  if (!profile1 || !profile2) return true
  return fields.some((field) => profile1[field] !== profile2[field])
}

/**
 * Return only the fields that changed between two profiles.
 */
export function getChangedFields(
  oldProfile: Partial<Profile> | null | undefined,
  newProfile: Partial<Profile>,
  fields: readonly (keyof Profile)[] = DEFAULT_DIFF_FIELDS,
): ProfileUpdate {
  if (!oldProfile) return newProfile as ProfileUpdate

  const changes: ProfileUpdate = {}
  for (const field of fields) {
    if (oldProfile[field] !== newProfile[field]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(changes as any)[field] = newProfile[field]
    }
  }
  return changes
}

/**
 * Whether the minimum "basic" profile fields are filled in.
 */
export function isBasicProfileComplete(profile: Partial<Profile> | null | undefined): boolean {
  if (!profile) return false
  return Boolean(
    profile.full_name?.trim() &&
      profile.avatar_url?.trim() &&
      profile.bio?.trim() &&
      profile.role,
  )
}

/**
 * Decide whether the basic-profile-info modal should be shown.
 * Pure re-implementation of the old completion store logic (no console noise).
 */
export function shouldShowBasicProfileModal(params: {
  profile: Partial<Profile> | null | undefined
  completionScore: number | null | undefined
  isBasicProfileCompleted: boolean
  isBasicProfileSkipped: boolean
}): { show: boolean; resetStatus: boolean } {
  const { profile, completionScore, isBasicProfileCompleted, isBasicProfileSkipped } = params
  const isActuallyComplete = isBasicProfileComplete(profile)

  // Marked complete/skipped but the profile is actually incomplete -> reset + show.
  if (!isActuallyComplete && (isBasicProfileCompleted || isBasicProfileSkipped)) {
    return { show: true, resetStatus: true }
  }

  // Already handled and genuinely complete -> hide.
  if ((isBasicProfileCompleted || isBasicProfileSkipped) && isActuallyComplete) {
    return { show: false, resetStatus: false }
  }

  // Score already above threshold -> hide.
  if ((completionScore ?? 0) >= PROFILE_COMPLETION.MINIMUM_THRESHOLD) {
    return { show: false, resetStatus: false }
  }

  // No profile yet, or missing required fields -> show.
  return { show: !isActuallyComplete, resetStatus: false }
}

export type OptimizedSaveConfig = {
  saveFunction: (
    userId: string,
    updates: ProfileUpdate,
  ) => Promise<{ data: unknown; error: string | null }>
  onSuccess?: (data: unknown) => void
  onError?: (message: string) => void
  debounceDelay?: number
  validate?: boolean
}

/**
 * Build debounced + manual save handlers for profile forms, with optional
 * client-side validation before each write.
 */
export function createOptimizedSaveHandlers(config: OptimizedSaveConfig) {
  const { saveFunction, onSuccess, onError, debounceDelay = 800, validate = false } = config

  const runSave = async (userId: string, updates: ProfileUpdate) => {
    try {
      if (validate) {
        const validation = validateProfileData(updates)
        if (!validation.isValid) {
          onError?.(validation.errors.join(', '))
          return
        }
      }

      const result = await saveFunction(userId, updates)
      if (result.error) throw new Error(result.error)

      onSuccess?.(result.data)
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Save failed.')
    }
  }

  return {
    debouncedSave: createDebouncedProfileSave(
      (userId: string, updates: ProfileUpdate) => void runSave(userId, updates),
      debounceDelay,
    ),
    manualSave: runSave,
  }
}
