import { parseCreatorMode } from '~/community/lib/creator-mode'
import { appRoutes, communityRoutes } from '~/lib/routes'
import { supabase } from '~/lib/supabase/client'

export type CreatorModeRevisitCard = {
  headline: string
  detail: string
  href: string
}

export function buildCreatorModeRevisitCard(input: {
  enabled: boolean
  hasHeadline: boolean
  hasOccupation: boolean
  profileCompletion: number | null
}): CreatorModeRevisitCard | null {
  if (input.enabled) return null
  const ready =
    input.hasHeadline ||
    input.hasOccupation ||
    (input.profileCompletion != null && input.profileCompletion >= 40)
  if (!ready) return null

  return {
    headline: 'Turn on creator mode',
    detail:
      'Share your expertise in the feed and appear in creator spotlights when you publish regularly.',
    href: String(appRoutes.profile),
  }
}

export async function fetchCreatorModeRevisitCard(
  userId: string,
  profile: {
    headline?: string | null
    occupation?: string | null
    profile_completion_percentage?: number | null
  },
): Promise<{ card: CreatorModeRevisitCard | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('job_preferences')
    .eq('id', userId)
    .maybeSingle()

  if (error) return { card: null, error: error.message }

  const prefs = parseCreatorMode(data?.job_preferences)
  return {
    card: buildCreatorModeRevisitCard({
      enabled: prefs.enabled,
      hasHeadline: Boolean(profile.headline?.trim()),
      hasOccupation: Boolean(profile.occupation?.trim()),
      profileCompletion: profile.profile_completion_percentage ?? null,
    }),
    error: null,
  }
}

export function creatorModeComposeHref() {
  return communityRoutes.createPost
}
