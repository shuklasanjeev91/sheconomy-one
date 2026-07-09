import { useCallback, useEffect, useState } from 'react'

import {
  fetchConnectionState,
  respondToConnection,
  sendConnectionRequest,
  type ProfileConnectionState,
} from '~/community/lib/network'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useProfileConnection(targetUserId?: string | null) {
  const { user, isLoading: authLoading } = useSupabase()
  const [state, setState] = useState<ProfileConnectionState>({
    status: 'none',
    connectionId: null,
    isSender: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isActing, setIsActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!targetUserId) {
      setState({ status: 'none', connectionId: null, isSender: false })
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    const next = await fetchConnectionState(user?.id, targetUserId)
    setState(next)
    setIsLoading(false)
  }, [targetUserId, user?.id])

  useEffect(() => {
    if (authLoading) return
    reload()
  }, [authLoading, reload])

  const connect = useCallback(async () => {
    if (!user || !targetUserId) {
      return { error: 'Sign in to connect' }
    }

    setIsActing(true)
    setError(null)
    const result = await sendConnectionRequest(user.id, targetUserId)
    setIsActing(false)

    if (result.error) {
      setError(result.error)
      return result
    }

    setState({
      status: 'pending_sent',
      connectionId: result.connectionId,
      isSender: true,
    })

    return result
  }, [targetUserId, user])

  const accept = useCallback(async () => {
    if (!state.connectionId) return { error: 'Missing connection' }

    setIsActing(true)
    setError(null)
    const result = await respondToConnection(state.connectionId, 'accepted')
    setIsActing(false)

    if (result.error) {
      setError(result.error)
      return result
    }

    setState((current) => ({ ...current, status: 'connected' }))
    return result
  }, [state.connectionId])

  const ignore = useCallback(async () => {
    if (!state.connectionId) return { error: 'Missing connection' }

    setIsActing(true)
    setError(null)
    const result = await respondToConnection(state.connectionId, 'rejected')
    setIsActing(false)

    if (result.error) {
      setError(result.error)
      return result
    }

    setState({ status: 'none', connectionId: null, isSender: false })
    return result
  }, [state.connectionId])

  return {
    user,
    isAuthenticated: !!user,
    isLoading: authLoading || isLoading,
    isActing,
    error,
    state,
    connect,
    accept,
    ignore,
    reload,
  }
}
