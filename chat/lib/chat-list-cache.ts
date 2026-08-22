import { fetchUserChats, markConversationDelivered } from '~/chat/lib/chats'
import type { ChatSummary } from '~/chat/lib/types'
import { CACHE_KEYS } from '~/lib/bootstrap/cache-keys'
import { peekAppCache, readAppCache, writeAppCache } from '~/lib/cache/app-cache'
import { isFeedFresh } from '~/lib/cache/feed-freshness'
import { supabase } from '~/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type ChatListCache = {
  items: ChatSummary[]
  error: string | null
}

export const CHAT_LIST_FRESH_MS = 60_000

const inflight = new Map<string, Promise<ChatListCache>>()
let realtimeUserId: string | null = null
let realtimeRefCount = 0
let realtimeChannel: RealtimeChannel | null = null
let reloadTimer: ReturnType<typeof setTimeout> | null = null
const reloadListeners = new Set<() => void>()

function scheduleReloadListeners() {
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    reloadListeners.forEach((listener) => listener())
  }, 350)
}

function releaseChatListRealtime() {
  if (realtimeChannel) {
    void supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }
  realtimeUserId = null
  realtimeRefCount = 0
}

function ensureChatListRealtime(userId: string) {
  if (realtimeUserId === userId && realtimeChannel) return

  if (realtimeChannel) {
    void supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }

  realtimeUserId = userId
  realtimeChannel = supabase
    .channel(`chat-list:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        const row = payload.new as { conversation_id?: string; sender_id?: string } | undefined
        if (row?.conversation_id && row.sender_id && row.sender_id !== userId) {
          void markConversationDelivered(row.conversation_id, userId)
        }
        scheduleReloadListeners()
      },
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () =>
      scheduleReloadListeners(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'message_reads', filter: `user_id=eq.${userId}` },
      () => scheduleReloadListeners(),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_participants',
        filter: `user_id=eq.${userId}`,
      },
      () => scheduleReloadListeners(),
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () =>
      scheduleReloadListeners(),
    )
    .subscribe()
}

export function retainChatListRealtime(userId: string, onReload: () => void): () => void {
  ensureChatListRealtime(userId)
  realtimeRefCount += 1
  reloadListeners.add(onReload)
  return () => {
    reloadListeners.delete(onReload)
    realtimeRefCount -= 1
    if (realtimeRefCount <= 0) {
      releaseChatListRealtime()
      reloadListeners.clear()
    }
  }
}

export async function loadChatListCached(
  userId: string,
  options: { force?: boolean } = {},
): Promise<ChatListCache> {
  const cacheKey = CACHE_KEYS.chatList(userId)

  if (!options.force && isFeedFresh(cacheKey, CHAT_LIST_FRESH_MS)) {
    const cached =
      peekAppCache<ChatListCache>(cacheKey) ?? (await readAppCache<ChatListCache>(cacheKey))
    if (cached) return cached
  }

  const pending = inflight.get(userId)
  if (pending) return pending

  const task = fetchUserChats(userId)
    .then(async ({ items, error }) => {
      const result = { items, error }
      await writeAppCache(cacheKey, result)
      return result
    })
    .finally(() => {
      inflight.delete(userId)
    })

  inflight.set(userId, task)
  return task
}
