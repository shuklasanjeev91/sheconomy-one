import { supabase } from '~/lib/supabase/client'

export type OpenToServicesPrefs = {
  enabled: boolean
  title?: string
  categories?: string[]
}

const DEFAULT_TITLE = 'Open to providing services'

/** Parse professional "providing services" prefs from profiles.job_preferences. */
export function parseOpenToServices(jobPreferences: unknown): OpenToServicesPrefs {
  if (!jobPreferences || typeof jobPreferences !== 'object' || Array.isArray(jobPreferences)) {
    return { enabled: false }
  }
  const record = jobPreferences as Record<string, unknown>
  const open =
    record.open_to_services &&
    typeof record.open_to_services === 'object' &&
    !Array.isArray(record.open_to_services)
      ? (record.open_to_services as Record<string, unknown>)
      : null

  if (!open) return { enabled: false }

  const categories = Array.isArray(open.categories)
    ? open.categories.filter((v): v is string => typeof v === 'string' && !!v.trim())
    : []

  return {
    enabled: open.enabled === true,
    title:
      typeof open.title === 'string' && open.title.trim() ? open.title.trim() : DEFAULT_TITLE,
    categories,
  }
}

export async function saveOpenToServices(
  userId: string,
  prefs: OpenToServicesPrefs,
  currentJobPreferences: unknown,
): Promise<{ error: string | null }> {
  const base =
    currentJobPreferences &&
    typeof currentJobPreferences === 'object' &&
    !Array.isArray(currentJobPreferences)
      ? { ...(currentJobPreferences as Record<string, unknown>) }
      : {}

  base.open_to_services = {
    enabled: prefs.enabled,
    title: prefs.title?.trim() || DEFAULT_TITLE,
    categories: prefs.categories ?? [],
  }

  const { error } = await supabase
    .from('profiles')
    .update({ job_preferences: base, updated_at: new Date().toISOString() })
    .eq('id', userId)

  return { error: error?.message ?? null }
}
