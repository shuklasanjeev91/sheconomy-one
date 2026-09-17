import { useEffect } from 'react'

import { bindRecentMeetingCodesUser } from '~/co-work/lib/recent-meeting-codes'
import { useSupabase } from '~/providers/SupabaseProvider'

/**
 * Keep recent meeting codes scoped to the signed-in user.
 * Mounted under SupabaseProvider (do not import co-work into the provider module —
 * that created a circular graph and `useSupabase must be used within a SupabaseProvider`).
 */
export function BindRecentMeetingCodes() {
  const { user } = useSupabase()

  useEffect(() => {
    void bindRecentMeetingCodesUser(user?.id ?? null)
  }, [user?.id])

  return null
}
