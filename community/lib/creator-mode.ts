import { supabase } from '~/lib/supabase/client'

export type CreatorModePrefs = {
  enabled: boolean
  topics?: string[]
}

/** Parse professional creator mode from profiles.job_preferences. */
export function parseCreatorMode(jobPreferences: unknown): CreatorModePrefs {
  if (!jobPreferences || typeof jobPreferences !== 'object' || Array.isArray(jobPreferences)) {
    return { enabled: false }
  }
  const record = jobPreferences as Record<string, unknown>
  const creator =
    record.creator_mode && typeof record.creator_mode === 'object' && !Array.isArray(record.creator_mode)
      ? (record.creator_mode as Record<string, unknown>)
      : null

  if (!creator) return { enabled: false }

  const topics = Array.isArray(creator.topics)
    ? creator.topics.filter((v): v is string => typeof v === 'string' && !!v.trim())
    : []

  return {
    enabled: creator.enabled === true,
    topics,
  }
}

export async function saveCreatorMode(
  userId: string,
  prefs: CreatorModePrefs,
  currentJobPreferences: unknown,
): Promise<{ error: string | null }> {
  const base =
    currentJobPreferences &&
    typeof currentJobPreferences === 'object' &&
    !Array.isArray(currentJobPreferences)
      ? { ...(currentJobPreferences as Record<string, unknown>) }
      : {}

  base.creator_mode = {
    enabled: prefs.enabled,
    topics: prefs.topics ?? [],
  }

  const { error } = await supabase
    .from('profiles')
    .update({ job_preferences: base, updated_at: new Date().toISOString() })
    .eq('id', userId)

  return { error: error?.message ?? null }
}
