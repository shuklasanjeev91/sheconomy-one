import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchCoworkMainChats } from '~/co-work/lib/main-chat'
import type { ChatSummary } from '~/chat/lib/types'
import { supabase } from '~/lib/supabase/client'

/**
 * Co-Work Main Chat list — conversations with type `cowork` only.
 * Never loads meeting_chat_messages.
 */
export function useCoworkMainChats(userId: string | null | undefined) {
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [isLoading, setIsLoading] = useState(!!userId)
  const [error, setError] = useState<string | null>(null)
  const hasChatsRef = useRef(false)

  const reload = useCallback(async () => {
    if (!userId) {
      setChats([])
      setError(null)
      setIsLoading(false)
      hasChatsRef.current = false
      return
    }
    if (!hasChatsRef.current) setIsLoading(true)
    const result = await fetchCoworkMainChats(userId)
    setChats(result.items)
    setError(result.error)
    hasChatsRef.current = result.items.length > 0
    setIsLoading(false)
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`cowork-main-chat:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          void reload()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_participants' },
        () => {
          void reload()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [reload, userId])

  return { chats, isLoading, error, reload }
}
