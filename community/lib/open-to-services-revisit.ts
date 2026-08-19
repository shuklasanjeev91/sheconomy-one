import { parseOpenToServices } from '~/community/lib/open-to-services'
import { appRoutes, communityRoutes } from '~/lib/routes'
import { supabase } from '~/lib/supabase/client'

export type OpenToServicesRevisitCard = {
  headline: string
  detail: string
  href: string
}

export function buildOpenToServicesRevisitCard(input: {
  enabled: boolean
  hasHeadline: boolean
  hasOccupation: boolean
  profileCompletion: number | null
}): OpenToServicesRevisitCard | null {
  if (input.enabled) return null
  const ready =
    input.hasHeadline ||
    input.hasOccupation ||
    (input.profileCompletion != null && input.profileCompletion >= 40)
  if (!ready) return null

  return {
    headline: 'Signal you are open to services',
    detail:
      'Let your network know you are available for consulting, freelance, or professional services.',
    href: String(appRoutes.profile),
  }
}

export async function fetchOpenToServicesRevisitCard(
  userId: string,
  profile: {
    headline?: string | null
    occupation?: string | null
    profile_completion_percentage?: number | null
  },
): Promise<{ card: OpenToServicesRevisitCard | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('job_preferences')
    .eq('id', userId)
    .maybeSingle()

  if (error) return { card: null, error: error.message }

  const prefs = parseOpenToServices(data?.job_preferences)
  return {
    card: buildOpenToServicesRevisitCard({
      enabled: prefs.enabled,
      hasHeadline: Boolean(profile.headline?.trim()),
      hasOccupation: Boolean(profile.occupation?.trim()),
      profileCompletion: profile.profile_completion_percentage ?? null,
    }),
    error: null,
  }
}

export function openToServicesPeopleHref() {
  return communityRoutes.peopleTab('services')
}
