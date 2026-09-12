import { useCallback, useEffect, useState } from 'react'

import {
  fetchCompanyFollowState,
  followCompany,
  unfollowCompany,
  type CompanyPage,
} from '~/community/lib/companies'
import { useSupabase } from '~/providers/SupabaseProvider'

/** Accepts a loaded page or a bare id so suggestion rows can follow without fetching the page. */
export function useCompanyFollow(company?: CompanyPage | string | null) {
  const { user } = useSupabase()
  const companyId = typeof company === 'string' ? company : company?.id ?? null
  const [isFollowing, setIsFollowing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isToggling, setIsToggling] = useState(false)

  const load = useCallback(async () => {
    if (!user || !companyId) {
      setIsFollowing(false)
      setIsLoading(false)
      return
    }
    const state = await fetchCompanyFollowState(companyId, user.id)
    setIsFollowing(state.isFollowing)
    setIsLoading(false)
  }, [companyId, user])

  useEffect(() => {
    load()
  }, [load])

  const toggle = useCallback(async () => {
    if (!user || !companyId) return { error: 'Sign in to follow' }
    setIsToggling(true)
    const wasFollowing = isFollowing
    // Flip first so compact rows do not swap the button for a spinner mid-press.
    setIsFollowing(!wasFollowing)
    const result = wasFollowing
      ? await unfollowCompany(companyId, user.id)
      : await followCompany(companyId, user.id)
    setIsToggling(false)
    if (result.error) setIsFollowing(wasFollowing)
    return result
  }, [companyId, isFollowing, user])

  return { isFollowing, isLoading, isToggling, isAuthenticated: !!user, toggle }
}
