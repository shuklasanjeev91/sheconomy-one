import { useMemo } from 'react'

import { buildProfileCompletionRevisitCard } from '~/community/lib/profile-completion-revisit'
import { useProfile } from '~/hooks/useProfile'

export function useProfileCompletionRevisit() {
  const { profile, isLoading } = useProfile()

  const card = useMemo(
    () => buildProfileCompletionRevisitCard(profile?.profile_completion_percentage),
    [profile?.profile_completion_percentage],
  )

  return useMemo(
    () => ({
      card,
      loading: isLoading,
      hasCard: card != null,
    }),
    [card, isLoading],
  )
}
