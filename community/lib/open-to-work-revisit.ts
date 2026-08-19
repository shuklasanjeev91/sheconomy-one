import { parseOpenToWork } from '~/community/lib/open-to-work'
import { appRoutes, communityRoutes } from '~/lib/routes'
import { supabase } from '~/lib/supabase/client'

export type OpenToWorkRevisitCard = {
  headline: string
  detail: string
  href: string
}

export function buildOpenToWorkRevisitCard(input: {
  enabled: boolean
  hasHeadline: boolean
  hasOccupation: boolean
  profileCompletion: number | null
}): OpenToWorkRevisitCard | null {
  if (input.enabled) return null
  const ready =
    input.hasHeadline ||
    input.hasOccupation ||
    (input.profileCompletion != null && input.profileCompletion >= 40)
  if (!ready) return null

  return {
    headline: 'Signal you are open to work',
    detail:
      'Turn on Open to work so recruiters and your network know you are exploring roles.',
    href: String(appRoutes.profile),
  }
}

export async function fetchOpenToWorkRevisitCard(
  userId: string,
  profile: {
    headline?: string | null
    occupation?: string | null
    profile_completion_percentage?: number | null
  },
): Promise<{ card: OpenToWorkRevisitCard | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('job_preferences')
    .eq('id', userId)
    .maybeSingle()

  if (error) return { card: null, error: error.message }

  const prefs = parseOpenToWork(data?.job_preferences)
  return {
    card: buildOpenToWorkRevisitCard({
      enabled: prefs.enabled,
      hasHeadline: Boolean(profile.headline?.trim()),
      hasOccupation: Boolean(profile.occupation?.trim()),
      profileCompletion: profile.profile_completion_percentage ?? null,
    }),
    error: null,
  }
}

export function openToWorkJobsHref() {
  return communityRoutes.jobs
}
