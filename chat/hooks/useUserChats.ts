import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { fetchUserChats } from '~/chat/lib/chats'
import type { ChatSummary } from '~/chat/lib/types'
import { supabase } from '~/lib/supabase/client'

/**
 * Loads the signed-in user's conversation list and keeps it fresh via realtime.
 * New messages, read receipts, and conversation updates trigger a debounced reload.
 */
export function useUserChats(userId: string | null | undefined) {
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    if (!userId) {
      setChats([])
      setError(null)
      setIsLoading(false)
      return
    }
    const { items, error: loadError } = await fetchUserChats(userId)
    setChats(items)
    setError(loadError)
    setIsLoading(false)
  }, [userId])

  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(() => {
      void load()
    }, 350)
  }, [load])

  useEffect(() => {
    // Clear previous account's conversations immediately on user switch.
    setChats([])
    setError(null)
    setIsLoading(true)
    void load()
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
    }
  }, [load])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`chat-list:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () =>
        scheduleReload(),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () =>
        scheduleReload(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reads', filter: `user_id=eq.${userId}` },
        () => scheduleReload(),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${userId}`,
        },
        () => scheduleReload(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, scheduleReload])

  const totalUnread = useMemo(
    () => chats.reduce((sum, chat) => sum + chat.unreadCount, 0),
    [chats],
  )

  return { chats, isLoading, error, totalUnread, reload: load }
}
