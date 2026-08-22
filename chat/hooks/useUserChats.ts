import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  loadChatListCached,
  retainChatListRealtime,
  type ChatListCache,
} from '~/chat/lib/chat-list-cache'
import type { ChatSummary } from '~/chat/lib/types'
import { CACHE_KEYS } from '~/lib/bootstrap/app-prefetch'
import { peekAppCache } from '~/lib/cache/app-cache'
import { isFeedFresh, FEED_FRESH_MS } from '~/lib/cache/feed-freshness'

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
  const hasChatsRef = useRef((initial?.items?.length ?? 0) > 0)
  hasChatsRef.current = chats.length > 0

  const applyCache = useCallback((cached: ChatListCache) => {
    setChats(cached.items)
    setError(cached.error)
    hasChatsRef.current = cached.items.length > 0
  }, [])

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial', force = false) => {
      if (!userId || !cacheKey) {
        setChats([])
        setError(null)
        setIsLoading(false)
        setIsRefreshing(false)
        hasChatsRef.current = false
        return
      }

      if (mode === 'refresh' && !force && isFeedFresh(cacheKey, FEED_FRESH_MS)) return

      if (mode === 'initial' && !hasChatsRef.current) setIsLoading(true)
      else if (mode === 'refresh') setIsRefreshing(true)

      const result = await loadChatListCached(userId, { force: force || mode === 'initial' })
      applyCache(result)
      setIsLoading(false)
      setIsRefreshing(false)
    },
    [applyCache, cacheKey, userId],
  )

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
      const cached = peekAppCache<ChatListCache>(cacheKey)
      if (cancelled) return
      if (cached) {
        applyCache(cached)
        setIsLoading(false)
        if (isFeedFresh(cacheKey, FEED_FRESH_MS)) return
      }
      await load(cached ? 'refresh' : 'initial')
    })()

    return () => {
      cancelled = true
    }
  }, [applyCache, cacheKey, load, userId])

  useEffect(() => {
    if (!userId) return
    return retainChatListRealtime(userId, () => {
      void load('refresh', true)
    })
  }, [load, userId])

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
