import { useCallback, useEffect, useState } from 'react'

import {
  removeConnection,
  respondToConnection,
  sendConnectionRequest,
  type NetworkMember,
} from '~/community/lib/network'
import { fetchNetworkSummaryCached, invalidateNetworkSummary } from '~/community/lib/network-summary-cache'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useNetwork() {
  const { user, isLoading: authLoading } = useSupabase()
  const [connections, setConnections] = useState<NetworkMember[]>([])
  const [pendingReceived, setPendingReceived] = useState<NetworkMember[]>([])
  const [pendingSent, setPendingSent] = useState<NetworkMember[]>([])
  const [suggestions, setSuggestions] = useState<NetworkMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionUserId, setActionUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) {
      setConnections([])
      setPendingReceived([])
      setPendingSent([])
      setSuggestions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const summary = await fetchNetworkSummaryCached(user.id)
    setConnections(summary.connections)
    setPendingReceived(summary.pendingReceived)
    setPendingSent(summary.pendingSent)
    setSuggestions(summary.suggestions)
    setError(summary.error)
    setIsLoading(false)
  }, [user])

  useEffect(() => {
    if (authLoading) return
    load()
  }, [authLoading, load])

  const connect = useCallback(
    async (member: NetworkMember) => {
      if (!user) return { error: 'Sign in to connect' }

      setActionUserId(member.user_id)
      const result = await sendConnectionRequest(user.id, member.user_id)
      setActionUserId(null)

      if (!result.error) {
        invalidateNetworkSummary(user.id)
        setSuggestions((items) => items.filter((item) => item.user_id !== member.user_id))
        setPendingSent((items) => [
          ...items,
          {
            ...member,
            connection_id: result.connectionId,
            connection_status: 'pending',
            is_sender: true,
          },
        ])
      }

      return result
    },
    [user],
  )

  const acceptInvitation = useCallback(async (member: NetworkMember) => {
    if (!member.connection_id) return { error: 'Missing connection' }

    setActionUserId(member.user_id)
    const result = await respondToConnection(member.connection_id, 'accepted')
    setActionUserId(null)

    if (!result.error) {
      if (user?.id) invalidateNetworkSummary(user.id)
      setPendingReceived((items) => items.filter((item) => item.user_id !== member.user_id))
      setConnections((items) => [
        ...items,
        { ...member, connection_status: 'accepted', is_sender: false },
      ])
    }

    return result
  }, [user?.id])

  const ignoreInvitation = useCallback(async (member: NetworkMember) => {
    if (!member.connection_id) return { error: 'Missing connection' }

    setActionUserId(member.user_id)
    const result = await respondToConnection(member.connection_id, 'rejected')
    setActionUserId(null)

    if (!result.error) {
      setPendingReceived((items) => items.filter((item) => item.user_id !== member.user_id))
    }

    return result
  }, [])

  // Remove an accepted connection (disconnect).
  const disconnect = useCallback(async (member: NetworkMember) => {
    if (!member.connection_id) return { error: 'Missing connection' }

    setActionUserId(member.user_id)
    const result = await removeConnection(member.connection_id)
    setActionUserId(null)

    if (!result.error) {
      setConnections((items) => items.filter((item) => item.user_id !== member.user_id))
    }

    return result
  }, [])

  // Withdraw a still-pending outgoing request.
  const withdrawInvitation = useCallback(async (member: NetworkMember) => {
    if (!member.connection_id) return { error: 'Missing connection' }

    setActionUserId(member.user_id)
    const result = await removeConnection(member.connection_id)
    setActionUserId(null)

    if (!result.error) {
      setPendingSent((items) => items.filter((item) => item.user_id !== member.user_id))
    }

    return result
  }, [])

  return {
    user,
    isAuthenticated: !!user,
    isLoading: authLoading || isLoading,
    error,
    connections,
    pendingReceived,
    pendingSent,
    suggestions,
    actionUserId,
    connect,
    acceptInvitation,
    ignoreInvitation,
    disconnect,
    withdrawInvitation,
    reload: load,
  }
}
