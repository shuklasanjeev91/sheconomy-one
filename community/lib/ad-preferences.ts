import {
  readPersistentValue,
  writePersistentValue,
} from '~/lib/platform/storage'
import { supabase } from '~/lib/supabase'

export type AdPreferences = {
  personalizedAds: boolean
  retargetingNotifications: boolean
  externalAnalytics: boolean
}

export type AdPreferenceKey = keyof AdPreferences

export const DEFAULT_AD_PREFERENCES: Readonly<AdPreferences> = Object.freeze({
  personalizedAds: false,
  retargetingNotifications: false,
  externalAnalytics: false,
})

export const AD_PREFERENCES_STORAGE_KEY = 'sheconomy.ad-preferences.v1'

type StoredGuestPreferences = {
  preferences: AdPreferences
  pendingSync: boolean
}

type PreferenceListener = () => void

let currentPreferences: AdPreferences = { ...DEFAULT_AD_PREFERENCES }
const listeners = new Set<PreferenceListener>()

function explicitBoolean(value: unknown): boolean {
  return value === true
}

/**
 * Converts local or database-shaped input into privacy-safe preferences.
 * Missing, malformed, and truthy non-boolean values always normalize to false.
 */
export function normalizeAdPreferences(value: unknown): AdPreferences {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_AD_PREFERENCES }
  }

  const input = value as Record<string, unknown>
  return {
    personalizedAds: explicitBoolean(input.personalizedAds ?? input.personalized_ads),
    retargetingNotifications: explicitBoolean(
      input.retargetingNotifications ??
        input.retargeting_notifications ??
        input.audience_membership_allowed,
    ),
    externalAnalytics: explicitBoolean(input.externalAnalytics ?? input.external_analytics),
  }
}

function notifyPreferenceListeners() {
  for (const listener of listeners) listener()
}

export function getAdPreferencesSnapshot(): AdPreferences {
  return currentPreferences
}

export function setAdPreferencesSnapshot(value: unknown): AdPreferences {
  const next = normalizeAdPreferences(value)
  if (
    next.personalizedAds === currentPreferences.personalizedAds &&
    next.retargetingNotifications === currentPreferences.retargetingNotifications &&
    next.externalAnalytics === currentPreferences.externalAnalytics
  ) {
    return currentPreferences
  }

  currentPreferences = next
  notifyPreferenceListeners()
  return currentPreferences
}

export function subscribeToAdPreferences(listener: PreferenceListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function hasExternalAnalyticsConsent(): boolean {
  return currentPreferences.externalAnalytics === true
}

function parseStoredGuestPreferences(raw: string | null): StoredGuestPreferences {
  if (!raw) {
    return {
      preferences: { ...DEFAULT_AD_PREFERENCES },
      pendingSync: false,
    }
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && 'preferences' in parsed) {
      const envelope = parsed as Record<string, unknown>
      return {
        preferences: normalizeAdPreferences(envelope.preferences),
        pendingSync: envelope.pendingSync === true,
      }
    }

    // Accept the original unwrapped shape if a pre-release build stored it.
    return {
      preferences: normalizeAdPreferences(parsed),
      pendingSync: false,
    }
  } catch {
    return {
      preferences: { ...DEFAULT_AD_PREFERENCES },
      pendingSync: false,
    }
  }
}

async function readGuestPreferences(): Promise<StoredGuestPreferences> {
  return parseStoredGuestPreferences(await readPersistentValue(AD_PREFERENCES_STORAGE_KEY))
}

async function writeGuestPreferences(value: StoredGuestPreferences): Promise<boolean> {
  const serialized = JSON.stringify(value)
  await writePersistentValue(AD_PREFERENCES_STORAGE_KEY, serialized)
  return (await readPersistentValue(AD_PREFERENCES_STORAGE_KEY)) === serialized
}

function isMissingPreferenceTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /could not find the table|does not exist/i.test(error.message ?? '')
  )
}

async function fetchAuthenticatedPreferences(
  userId: string,
): Promise<{ preferences: AdPreferences; error: string | null }> {
  const { data, error } = await supabase
    .from('ad_privacy_preferences' as never)
    .select(
      'personalized_ads, retargeting_notifications, external_analytics, audience_membership_allowed',
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error && !isMissingPreferenceTable(error)) {
    return {
      preferences: { ...DEFAULT_AD_PREFERENCES },
      error: error.message,
    }
  }

  return {
    preferences: normalizeAdPreferences({
      ...(data as Record<string, unknown> | null),
      retargeting_notifications:
        (data as { retargeting_notifications?: unknown; audience_membership_allowed?: unknown } | null)
          ?.retargeting_notifications ??
        (data as { audience_membership_allowed?: unknown } | null)?.audience_membership_allowed,
    }),
    error: null,
  }
}

async function persistAuthenticatedPreferences(
  userId: string,
  preferences: AdPreferences,
): Promise<string | null> {
  const { error } = await supabase.from('ad_privacy_preferences' as never).upsert(
    {
      user_id: userId,
      personalized_ads: preferences.personalizedAds,
      audience_membership_allowed: preferences.retargetingNotifications,
      retargeting_notifications: preferences.retargetingNotifications,
      external_analytics: preferences.externalAnalytics,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: 'user_id' },
  )

  if (error && !isMissingPreferenceTable(error)) return error.message
  return null
}

export async function loadAdPreferences(
  userId?: string | null,
): Promise<{ preferences: AdPreferences; error: string | null }> {
  const guest = await readGuestPreferences()

  if (!userId) {
    return {
      preferences: setAdPreferencesSnapshot(guest.preferences),
      error: null,
    }
  }

  if (guest.pendingSync) {
    const syncError = await persistAuthenticatedPreferences(userId, guest.preferences)
    if (!syncError) {
      await writeGuestPreferences({ preferences: guest.preferences, pendingSync: false })
      return {
        preferences: setAdPreferencesSnapshot(guest.preferences),
        error: null,
      }
    }
  }

  const remote = await fetchAuthenticatedPreferences(userId)
  return {
    preferences: setAdPreferencesSnapshot(remote.preferences),
    error: remote.error,
  }
}

export async function saveAdPreferences(
  preferences: AdPreferences,
  userId?: string | null,
): Promise<{ preferences: AdPreferences; error: string | null }> {
  const normalized = normalizeAdPreferences(preferences)

  if (!userId) {
    const persisted = await writeGuestPreferences({ preferences: normalized, pendingSync: true })
    if (!persisted) {
      return {
        preferences: currentPreferences,
        error: 'Could not save advertising preferences on this device.',
      }
    }
    return {
      preferences: setAdPreferencesSnapshot(normalized),
      error: null,
    }
  }

  const error = await persistAuthenticatedPreferences(userId, normalized)
  if (error) return { preferences: currentPreferences, error }

  return {
    preferences: setAdPreferencesSnapshot(normalized),
    error: null,
  }
}
