import { supabase } from '~/lib/supabase/client'

export type OpenToWorkPrefs = {
  enabled: boolean
  title?: string
  locations?: string[]
  visibility?: 'public' | 'connections'
}

const DEFAULT_TITLE = 'Open to work'

/** Parse professional open-to-work prefs from profiles.job_preferences. */
export function parseOpenToWork(jobPreferences: unknown): OpenToWorkPrefs {
  if (!jobPreferences || typeof jobPreferences !== 'object' || Array.isArray(jobPreferences)) {
    return { enabled: false }
  }
  const record = jobPreferences as Record<string, unknown>
  const open =
    record.open_to_work && typeof record.open_to_work === 'object' && !Array.isArray(record.open_to_work)
      ? (record.open_to_work as Record<string, unknown>)
      : record

  const enabled = open.enabled === true || open.open_to_work === true
  const title =
    typeof open.title === 'string' && open.title.trim()
      ? open.title.trim()
      : typeof open.headline === 'string' && open.headline.trim()
        ? open.headline.trim()
        : DEFAULT_TITLE
  const locations = Array.isArray(open.locations)
    ? open.locations.filter((v): v is string => typeof v === 'string' && !!v.trim())
    : []
  const visibility =
    open.visibility === 'connections' || open.visibility === 'public'
      ? open.visibility
      : 'public'

  return { enabled, title, locations, visibility }
}

export async function saveOpenToWork(
  userId: string,
  prefs: OpenToWorkPrefs,
  currentJobPreferences: unknown,
): Promise<{ error: string | null }> {
  const base =
    currentJobPreferences &&
    typeof currentJobPreferences === 'object' &&
    !Array.isArray(currentJobPreferences)
      ? { ...(currentJobPreferences as Record<string, unknown>) }
      : {}

  base.open_to_work = {
    enabled: prefs.enabled,
    title: prefs.title?.trim() || DEFAULT_TITLE,
    locations: prefs.locations ?? [],
    visibility: prefs.visibility ?? 'public',
  }

  const { error } = await supabase
    .from('profiles')
    .update({ job_preferences: base, updated_at: new Date().toISOString() })
    .eq('id', userId)

  return { error: error?.message ?? null }
}
