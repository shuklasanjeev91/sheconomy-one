import { useCallback, useEffect, useState } from 'react'

import {
  fetchCompanyFollowState,
  followCompany,
  unfollowCompany,
  type CompanyPage,
} from '~/community/lib/companies'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useCompanyFollow(company?: CompanyPage | null) {
  const { user } = useSupabase()
  const [isFollowing, setIsFollowing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isToggling, setIsToggling] = useState(false)

  const load = useCallback(async () => {
    if (!user || !company) {
      setIsFollowing(false)
      setIsLoading(false)
      return
    }
    const state = await fetchCompanyFollowState(company.id, user.id)
    setIsFollowing(state.isFollowing)
    setIsLoading(false)
  }, [company, user])

  useEffect(() => {
    load()
  }, [load])

  const toggle = useCallback(async () => {
    if (!user || !company) return { error: 'Sign in to follow' }
    setIsToggling(true)
    const result = isFollowing
      ? await unfollowCompany(company.id, user.id)
      : await followCompany(company.id, user.id)
    setIsToggling(false)
    if (!result.error) setIsFollowing(!isFollowing)
    return result
  }, [company, isFollowing, user])

  return { isFollowing, isLoading, isToggling, isAuthenticated: !!user, toggle }
}
