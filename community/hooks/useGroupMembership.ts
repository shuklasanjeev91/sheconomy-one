import { useCallback, useEffect, useState } from 'react'

import { fetchGroupMembership, joinGroup, leaveGroup } from '~/community/lib/groups'
import { useSupabase } from '~/providers/SupabaseProvider'

/** Join / request-to-join state for a group, usable outside the group screen. */
export function useGroupMembership(groupId?: string | null, groupType?: string | null) {
  const { user } = useSupabase()
  const [isMember, setIsMember] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isToggling, setIsToggling] = useState(false)

  const load = useCallback(async () => {
    if (!user || !groupId) {
      setIsMember(false)
      setIsPending(false)
      setRole(null)
      setIsLoading(false)
      return
    }
    const state = await fetchGroupMembership(groupId, user.id)
    setIsMember(state.isMember)
    setIsPending(state.isPending)
    setRole(state.role)
    setIsLoading(false)
  }, [groupId, user])

  useEffect(() => {
    void load()
  }, [load])

  const join = useCallback(async () => {
    if (!user || !groupId) return { error: 'Sign in to join groups' }
    setIsToggling(true)
    const result = await joinGroup(groupId, user.id, groupType ?? 'public')
    if (!result.error) {
      if (result.pending) setIsPending(true)
      else {
        setIsMember(true)
        setRole('member')
      }
    }
    setIsToggling(false)
    return result
  }, [groupId, groupType, user])

  const leave = useCallback(async () => {
    if (!user || !groupId) return { error: 'Sign in to manage groups' }
    setIsToggling(true)
    const result = await leaveGroup(groupId, user.id)
    if (!result.error) {
      setIsMember(false)
      setRole(null)
    }
    setIsToggling(false)
    return result
  }, [groupId, user])

  return {
    isAuthenticated: !!user,
    isMember,
    isPending,
    role,
    isLoading,
    isToggling,
    join,
    leave,
    refresh: load,
  }
}
