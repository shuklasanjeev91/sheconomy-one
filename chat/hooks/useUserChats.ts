import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { fetchUserChats } from '~/chat/lib/chats'
import type { ChatSummary } from '~/chat/lib/types'
import { CACHE_KEYS } from '~/lib/bootstrap/app-prefetch'
import { peekAppCache, readAppCache, writeAppCache } from '~/lib/cache/app-cache'
import { supabase } from '~/lib/supabase/client'

type ChatListCache = {
  items: ChatSummary[]
  error: string | null
}

/**
 * Loads the signed-in user's conversation list and keeps it fresh via realtime.
 * New messages, read receipts, and conversation updates trigger a debounced reload.
 */
export function useUserChats(userId: string | null | undefined) {
  const cacheKey = userId ? CACHE_KEYS.chatList(userId) : null
  const initial = cacheKey ? peekAppCache<ChatListCache>(cacheKey) : null
  const [chats, setChats] = useState<ChatSummary[]>(initial?.items ?? [])
  const [isLoading, setIsLoading] = useState(!!userId && !initial)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(initial?.error ?? null)
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasChatsRef = useRef((initial?.items?.length ?? 0) > 0)
  hasChatsRef.current = chats.length > 0

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId || !cacheKey) {
        setChats([])
        setError(null)
        setIsLoading(false)
        setIsRefreshing(false)
        hasChatsRef.current = false
        return
      }

      if (mode === 'initial' && !hasChatsRef.current) setIsLoading(true)
      else setIsRefreshing(true)

      const { items, error: loadError } = await fetchUserChats(userId)
      setChats(items)
      setError(loadError)
      hasChatsRef.current = items.length > 0
      setIsLoading(false)
      setIsRefreshing(false)
      await writeAppCache(cacheKey, { items, error: loadError })
    },
    [cacheKey, userId],
  )

  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(() => {
      void load('refresh')
    }, 350)
  }, [load])

  useEffect(() => {
    if (!userId || !cacheKey) {
      setChats([])
      setError(null)
      setIsLoading(false)
      setIsRefreshing(false)
      return
    }

    let cancelled = false
    void (async () => {
      const cached =
        peekAppCache<ChatListCache>(cacheKey) ?? (await readAppCache<ChatListCache>(cacheKey))
      if (cancelled) return
      if (cached) {
        setChats(cached.items)
        setError(cached.error)
        hasChatsRef.current = cached.items.length > 0
        setIsLoading(false)
      }
      await load(cached ? 'refresh' : 'initial')
    })()

    return () => {
      cancelled = true
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
    }
  }, [cacheKey, load, userId])

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

  return {
    chats,
    isLoading,
    isRefreshing,
    error,
    totalUnread,
    reload: () => load('refresh'),
  }
}
