import { useAppLayout } from '~/hooks/useAppLayout'
import { useSupabase } from '~/providers/SupabaseProvider'

/** Shared layout/auth rules for Community feed header strips. */
export function useCommunityFeedHeader() {
  const { hasDualSideRails } = useAppLayout()
  const { user, isLoading: authLoading } = useSupabase()

  return {
    /** Hide network-style strips when the desktop sidebar already shows them. */
    hideSidebarRedundantStrips: hasDualSideRails,
    isAuthenticated: Boolean(user),
    authLoading,
  }
}
