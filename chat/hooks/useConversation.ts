import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  MESSAGES_PAGE_SIZE,
  deleteMessageForEveryone as deleteMessageApi,
  editMessage as editMessageApi,
  fetchMessages,
  fetchReactionsForMessages,
  fetchReplyPreview,
  mapMessage,
  markConversationDelivered,
  markConversationRead,
  mediaCategory,
  sendEventMessage,
  sendMessage,
  sendPollMessage,
  setTypingIndicator,
  toggleReaction as toggleReactionApi,
  uploadChatMedia,
} from '~/chat/lib/chats'
import {
  buildPollResult,
  castMessagePollVote,
  fetchMessagePollVotes,
} from '~/chat/lib/polls'
import type {
  ChatComposerAttachment,
  ChatEventPayload,
  ChatMessage,
  ChatPollPayload,
  MessagePollVote,
  MessageReaction,
  PollResult,
  ReactionGroup,
  ReplyPreview,
} from '~/chat/lib/types'
import { pickedImageToBlob } from '~/lib/media/pick-image'
import { supabase } from '~/lib/supabase/client'
import { useAppToast } from '~/components/ui'

const TYPING_IDLE_MS = 2500
const PEER_TYPING_TIMEOUT_MS = 5000

let tempCounter = 0
function nextTempId() {
  tempCounter += 1
  return `temp-${Date.now()}-${tempCounter}`
}

function isOptimisticMessageId(messageId: string) {
  return messageId.startsWith('temp-')
}

function toReplyPreview(message: ChatMessage): ReplyPreview {
  return {
    id: message.id,
    senderId: message.senderId,
    content: message.deletedAt ? '' : message.content,
    type: message.type,
    mediaUrl: message.deletedAt ? null : message.mediaUrl,
  }
}

type UseConversationOptions = {
  conversationId: string | null
  currentUserId: string | null
}

export function useConversation({ conversationId, currentUserId }: UseConversationOptions) {
  const toast = useAppToast()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [peerTyping, setPeerTyping] = useState(false)
  const [peerReadAt, setPeerReadAt] = useState<string | null>(null)
  const [reactionRows, setReactionRows] = useState<MessageReaction[]>([])
  const [pollVotes, setPollVotes] = useState<MessagePollVote[]>([])

  const messagesRef = useRef<ChatMessage[]>([])
  const isTypingRef = useRef(false)
  const typingIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peerTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setMessagesTracked = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev)
      messagesRef.current = next
      return next
    })
  }, [])

  const markRead = useCallback(() => {
    if (!conversationId || !currentUserId) return
    // Delivered first (gray ✓✓), then read (blue ✓✓) while this thread is open.
    void markConversationDelivered(conversationId, currentUserId).then(() =>
      markConversationRead(conversationId, currentUserId),
    )
  }, [conversationId, currentUserId])

  const loadReactions = useCallback(async (ids: string[]) => {
    const rows = await fetchReactionsForMessages(ids)
    setReactionRows((prev) => {
      const kept = prev.filter((r) => !ids.includes(r.messageId))
      return [...kept, ...rows]
    })
  }, [])

  const loadPollVotes = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    const rows = await fetchMessagePollVotes(ids)
    setPollVotes((prev) => {
      const kept = prev.filter((v) => !ids.includes(v.messageId))
      return [...kept, ...rows]
    })
  }, [])

  const pollMessageIds = useCallback(
    (items: ChatMessage[]) => items.filter((m) => m.type === 'poll').map((m) => m.id),
    [],
  )

  // Initial + reset load.
  useEffect(() => {
    let cancelled = false
    if (!conversationId) {
      setMessages([])
      messagesRef.current = []
      setReactionRows([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    setPeerTyping(false)
    setPeerReadAt(null)
    setReactionRows([])
    setPollVotes([])

    fetchMessages(conversationId).then((result) => {
      if (cancelled) return
      messagesRef.current = result.items
      setMessages(result.items)
      setHasMore(result.hasMore)
      setError(result.error)
      setIsLoading(false)
      markRead()
      void loadReactions(result.items.map((m) => m.id))
      void loadPollVotes(pollMessageIds(result.items))
    })

    // Seed the peer's latest read timestamp for read receipts.
    if (currentUserId) {
      supabase
        .from('message_reads')
        .select('read_at')
        .eq('conversation_id', conversationId)
        .neq('user_id', currentUserId)
        .order('read_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled && data?.read_at) setPeerReadAt(data.read_at)
        })
    }

    return () => {
      cancelled = true
    }
  }, [conversationId, currentUserId, markRead, loadReactions, loadPollVotes, pollMessageIds])

  // Realtime: messages, typing, read receipts, reactions.
  useEffect(() => {
    if (!conversationId || !currentUserId) return

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = mapMessage(payload.new as never)
          const existing = messagesRef.current

          if (existing.some((m) => m.id === incoming.id)) return

          // Resolve a quoted-reply snapshot for the new message, if any.
          if (incoming.replyToId) {
            const local = existing.find((m) => m.id === incoming.replyToId)
            if (local) {
              incoming.replyPreview = toReplyPreview(local)
            } else {
              void fetchReplyPreview(incoming.replyToId).then((preview) => {
                if (!preview) return
                setMessagesTracked((prev) =>
                  prev.map((m) => (m.id === incoming.id ? { ...m, replyPreview: preview } : m)),
                )
              })
            }
          }

          if (incoming.senderId === currentUserId) {
            const optimisticIndex = existing.findIndex(
              (m) => m.optimistic && m.senderId === currentUserId && m.content === incoming.content,
            )
            if (optimisticIndex !== -1) {
              setMessagesTracked((prev) => {
                const next = [...prev]
                next[optimisticIndex] = { ...incoming, replyPreview: prev[optimisticIndex].replyPreview }
                return next
              })
              if (incoming.type === 'poll') void loadPollVotes([incoming.id])
              return
            }
          }

          setMessagesTracked((prev) => [...prev, incoming])

          if (incoming.type === 'poll') {
            void loadPollVotes([incoming.id])
          }

          if (incoming.senderId !== currentUserId) {
            markRead()
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = mapMessage(payload.new as never)
          setMessagesTracked((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? {
                    ...m,
                    content: updated.content,
                    status: updated.status,
                    mediaUrl: updated.mediaUrl,
                    deletedAt: updated.deletedAt,
                    editedAt: updated.editedAt,
                  }
                : m,
            ),
          )
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as
            | { user_id?: string; is_typing?: boolean }
            | undefined
          const uid = row?.user_id
          if (!uid || uid === currentUserId) return

          if (payload.eventType === 'DELETE' || !row?.is_typing) {
            setPeerTyping(false)
            return
          }

          setPeerTyping(true)
          if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current)
          peerTypingTimer.current = setTimeout(() => setPeerTyping(false), PEER_TYPING_TIMEOUT_MS)
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reads',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as { user_id?: string; read_at?: string | null } | undefined
          if (!row?.user_id || row.user_id === currentUserId || !row.read_at) return
          const nextReadAt = row.read_at
          setPeerReadAt((prev) => (!prev || nextReadAt > prev ? nextReadAt : prev))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const row = (payload.new ?? payload.old) as { message_id?: string } | undefined
          const messageId = row?.message_id
          if (!messageId) return
          // Only refresh reactions for messages we actually have loaded.
          if (!messagesRef.current.some((m) => m.id === messageId)) return
          void loadReactions([messageId])
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_poll_votes' },
        (payload) => {
          const row = (payload.new ?? payload.old) as { message_id?: string } | undefined
          const messageId = row?.message_id
          if (!messageId) return
          // Only refresh votes for poll messages we have loaded.
          if (!messagesRef.current.some((m) => m.id === messageId)) return
          void loadPollVotes([messageId])
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
      if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current)
    }
  }, [conversationId, currentUserId, markRead, setMessagesTracked, loadReactions, loadPollVotes])

  // Stop broadcasting typing when leaving the conversation.
  useEffect(() => {
    return () => {
      if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current)
      if (isTypingRef.current && conversationId && currentUserId) {
        isTypingRef.current = false
        void setTypingIndicator(conversationId, currentUserId, false)
      }
    }
  }, [conversationId, currentUserId])

  const loadOlder = useCallback(async () => {
    if (!conversationId || loadingOlder || !hasMore) return
    const oldest = messagesRef.current[0]
    if (!oldest) return

    setLoadingOlder(true)
    const result = await fetchMessages(conversationId, {
      before: oldest.createdAt,
      limit: MESSAGES_PAGE_SIZE,
    })
    setMessagesTracked((prev) => [...result.items, ...prev])
    setHasMore(result.hasMore)
    setLoadingOlder(false)
    void loadReactions(result.items.map((m) => m.id))
    void loadPollVotes(pollMessageIds(result.items))
  }, [conversationId, hasMore, loadingOlder, setMessagesTracked, loadReactions, loadPollVotes, pollMessageIds])

  const stopTyping = useCallback(() => {
    if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current)
    if (isTypingRef.current && conversationId && currentUserId) {
      isTypingRef.current = false
      void setTypingIndicator(conversationId, currentUserId, false)
    }
  }, [conversationId, currentUserId])

  const handleTyping = useCallback(
    (text: string) => {
      if (!conversationId || !currentUserId) return
      const hasText = text.trim().length > 0

      if (hasText && !isTypingRef.current) {
        isTypingRef.current = true
        void setTypingIndicator(conversationId, currentUserId, true)
      }

      if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current)
      if (hasText) {
        typingIdleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS)
      } else {
        stopTyping()
      }
    },
    [conversationId, currentUserId, stopTyping],
  )

  const send = useCallback(
    async (text: string, replyTo?: ChatMessage | null) => {
      const content = text.trim()
      if (!content || !conversationId || !currentUserId) return

      stopTyping()

      const optimistic: ChatMessage = {
        id: nextTempId(),
        conversationId,
        senderId: currentUserId,
        content,
        type: 'text',
        mediaUrl: null,
        mediaType: null,
        fileName: null,
        fileSize: null,
        status: 'sending',
        createdAt: new Date().toISOString(),
        replyToId: replyTo?.id ?? null,
        replyPreview: replyTo ? toReplyPreview(replyTo) : null,
        deletedAt: null,
        editedAt: null,
        poll: null,
        event: null,
        storyReply: null,
        optimistic: true,
      }
      setMessagesTracked((prev) => [...prev, optimistic])
      setSending(true)

      const { messageId, error: sendError } = await sendMessage({
        conversationId,
        senderId: currentUserId,
        content,
        replyToId: replyTo?.id ?? null,
      })
      setSending(false)

      setMessagesTracked((prev) =>
        prev.map((m) => {
          if (m.id !== optimistic.id) return m
          if (sendError || !messageId) return { ...m, status: 'failed' }
          return { ...m, id: messageId, status: 'sent', optimistic: false }
        }),
      )
    },
    [conversationId, currentUserId, setMessagesTracked, stopTyping],
  )

  const resend = useCallback(
    async (message: ChatMessage) => {
      if (!conversationId || !currentUserId) return
      if (message.status !== 'failed') return
      // In-place retry for messages whose payload we still hold. Media retries
      // need the original file, which optimistic failures don't retain.
      if (message.type !== 'text' && message.type !== 'poll' && message.type !== 'event') return

      setMessagesTracked((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, status: 'sending' } : m)),
      )

      let messageId: string | null = null
      let sendError: string | null = null

      if (message.type === 'poll' && message.poll) {
        const res = await sendPollMessage(conversationId, currentUserId, message.poll)
        messageId = res.messageId
        sendError = res.error
      } else if (message.type === 'event' && message.event) {
        const res = await sendEventMessage(conversationId, currentUserId, message.event)
        messageId = res.messageId
        sendError = res.error
      } else {
        const res = await sendMessage({
          conversationId,
          senderId: currentUserId,
          content: message.content,
          replyToId: message.replyToId ?? null,
        })
        messageId = res.messageId
        sendError = res.error
      }

      setMessagesTracked((prev) =>
        prev.map((m) => {
          if (m.id !== message.id) return m
          if (sendError || !messageId) return { ...m, status: 'failed' }
          return { ...m, id: messageId, status: 'sent', optimistic: false }
        }),
      )
    },
    [conversationId, currentUserId, setMessagesTracked],
  )

  const sendImage = useCallback(
    async (attachment: ChatComposerAttachment, replyTo?: ChatMessage | null) => {
      if (!conversationId || !currentUserId) return

      const optimistic: ChatMessage = {
        id: nextTempId(),
        conversationId,
        senderId: currentUserId,
        content: '',
        type: 'image',
        mediaUrl: attachment.uri,
        mediaType: attachment.mimeType,
        fileName: attachment.fileName ?? null,
        fileSize: null,
        status: 'sending',
        createdAt: new Date().toISOString(),
        replyToId: replyTo?.id ?? null,
        replyPreview: replyTo ? toReplyPreview(replyTo) : null,
        deletedAt: null,
        editedAt: null,
        poll: null,
        event: null,
        storyReply: null,
        optimistic: true,
      }
      setMessagesTracked((prev) => [...prev, optimistic])
      setSending(true)
      setUploadProgress(0)

      try {
        const blob = await pickedImageToBlob(attachment)
        const { data: uploaded, error: uploadError } = await uploadChatMedia(
          conversationId,
          currentUserId,
          { blob, mimeType: attachment.mimeType, fileName: attachment.fileName },
          { onProgress: setUploadProgress },
        )

        if (uploadError || !uploaded) {
          throw new Error(uploadError ?? 'Upload failed')
        }

        const { messageId, error: sendError } = await sendMessage({
          conversationId,
          senderId: currentUserId,
          content: '',
          type: 'image',
          mediaPath: uploaded.path,
          mediaType: mediaCategory(uploaded.mimeType),
          fileName: uploaded.fileName,
          fileSize: uploaded.size,
          replyToId: replyTo?.id ?? null,
        })

        if (sendError || !messageId) throw new Error(sendError ?? 'Send failed')

        setMessagesTracked((prev) =>
          prev.map((m) =>
            m.id === optimistic.id
              ? { ...m, id: messageId, mediaUrl: uploaded.path, status: 'sent', optimistic: false }
              : m,
          ),
        )
      } catch {
        setMessagesTracked((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...m, status: 'failed' } : m)),
        )
      } finally {
        setSending(false)
        setUploadProgress(null)
      }
    },
    [conversationId, currentUserId, setMessagesTracked],
  )

  const sendFile = useCallback(
    async (attachment: ChatComposerAttachment, replyTo?: ChatMessage | null) => {
      if (!conversationId || !currentUserId) return

      const optimistic: ChatMessage = {
        id: nextTempId(),
        conversationId,
        senderId: currentUserId,
        content: '',
        type: 'file',
        mediaUrl: attachment.uri,
        mediaType: mediaCategory(attachment.mimeType),
        fileName: attachment.fileName ?? 'file',
        fileSize: attachment.fileSize ?? null,
        status: 'sending',
        createdAt: new Date().toISOString(),
        replyToId: replyTo?.id ?? null,
        replyPreview: replyTo ? toReplyPreview(replyTo) : null,
        deletedAt: null,
        editedAt: null,
        poll: null,
        event: null,
        storyReply: null,
        optimistic: true,
      }
      setMessagesTracked((prev) => [...prev, optimistic])
      setSending(true)
      setUploadProgress(0)

      try {
        const blob = await pickedImageToBlob(attachment)
        const { data: uploaded, error: uploadError } = await uploadChatMedia(
          conversationId,
          currentUserId,
          {
            blob,
            mimeType: attachment.mimeType,
            fileName: attachment.fileName,
          },
          { onProgress: setUploadProgress },
        )

        if (uploadError || !uploaded) throw new Error(uploadError ?? 'Upload failed')

        const { messageId, error: sendError } = await sendMessage({
          conversationId,
          senderId: currentUserId,
          content: '',
          type: 'file',
          mediaPath: uploaded.path,
          mediaType: mediaCategory(uploaded.mimeType),
          fileName: uploaded.fileName,
          fileSize: uploaded.size,
          replyToId: replyTo?.id ?? null,
        })

        if (sendError || !messageId) throw new Error(sendError ?? 'Send failed')

        setMessagesTracked((prev) =>
          prev.map((m) =>
            m.id === optimistic.id
              ? { ...m, id: messageId, mediaUrl: uploaded.path, status: 'sent', optimistic: false }
              : m,
          ),
        )
      } catch {
        setMessagesTracked((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...m, status: 'failed' } : m)),
        )
      } finally {
        setSending(false)
        setUploadProgress(null)
      }
    },
    [conversationId, currentUserId, setMessagesTracked],
  )

  const edit = useCallback(
    async (messageId: string, nextContent: string) => {
      const content = nextContent.trim()
      if (!content) return
      const editedAt = new Date().toISOString()
      setMessagesTracked((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content, editedAt } : m)),
      )
      await editMessageApi(messageId, content)
    },
    [setMessagesTracked],
  )

  const remove = useCallback(
    async (messageId: string) => {
      const deletedAt = new Date().toISOString()
      setMessagesTracked((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, deletedAt, content: '', mediaUrl: null } : m,
        ),
      )
      await deleteMessageApi(messageId)
    },
    [setMessagesTracked],
  )

  const react = useCallback(
    async (messageId: string, emoji: string) => {
      if (!currentUserId) return
      // Optimistic: one reaction per user per message.
      setReactionRows((prev) => {
        const mine = prev.filter((r) => r.messageId === messageId && r.userId === currentUserId)
        const others = prev.filter((r) => !(r.messageId === messageId && r.userId === currentUserId))
        const hadSame = mine.some((r) => r.emoji === emoji)
        if (hadSame) return others
        return [...others, { messageId, userId: currentUserId, emoji }]
      })
      const { error: reactError } = await toggleReactionApi(messageId, currentUserId, emoji)
      if (reactError) void loadReactions([messageId])
    },
    [currentUserId, loadReactions],
  )

  const sendPoll = useCallback(
    async (poll: ChatPollPayload) => {
      if (!conversationId || !currentUserId) return
      const optimistic: ChatMessage = {
        id: nextTempId(),
        conversationId,
        senderId: currentUserId,
        content: `[Poll] ${poll.question}`,
        type: 'poll',
        mediaUrl: null,
        mediaType: null,
        fileName: null,
        fileSize: null,
        status: 'sending',
        createdAt: new Date().toISOString(),
        replyToId: null,
        replyPreview: null,
        deletedAt: null,
        editedAt: null,
        poll,
        event: null,
        storyReply: null,
        optimistic: true,
      }
      setMessagesTracked((prev) => [...prev, optimistic])
      setSending(true)
      const { messageId, error: sendError } = await sendPollMessage(
        conversationId,
        currentUserId,
        poll,
      )
      setSending(false)
      if (sendError || !messageId) {
        toast.show('Could not send poll', { tone: 'danger', message: sendError ?? undefined })
        setMessagesTracked((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...m, status: 'failed' } : m)),
        )
        return
      }
      setMessagesTracked((prev) =>
        prev.map((m) =>
          m.id === optimistic.id ? { ...m, id: messageId, status: 'sent', optimistic: false } : m,
        ),
      )
      void loadPollVotes([messageId])
    },
    [conversationId, currentUserId, setMessagesTracked, toast, loadPollVotes],
  )

  const sendEvent = useCallback(
    async (event: ChatEventPayload) => {
      if (!conversationId || !currentUserId) return
      const optimistic: ChatMessage = {
        id: nextTempId(),
        conversationId,
        senderId: currentUserId,
        content: event.title,
        type: 'event',
        mediaUrl: null,
        mediaType: null,
        fileName: null,
        fileSize: null,
        status: 'sending',
        createdAt: new Date().toISOString(),
        replyToId: null,
        replyPreview: null,
        deletedAt: null,
        editedAt: null,
        poll: null,
        event,
        storyReply: null,
        optimistic: true,
      }
      setMessagesTracked((prev) => [...prev, optimistic])
      setSending(true)
      const { messageId, error: sendError } = await sendEventMessage(
        conversationId,
        currentUserId,
        event,
      )
      setSending(false)
      setMessagesTracked((prev) =>
        prev.map((m) => {
          if (m.id !== optimistic.id) return m
          if (sendError || !messageId) return { ...m, status: 'failed' }
          return { ...m, id: messageId, status: 'sent', optimistic: false }
        }),
      )
    },
    [conversationId, currentUserId, setMessagesTracked],
  )

  const votePoll = useCallback(
    async (messageId: string, optionIndex: number) => {
      if (!currentUserId) return
      if (isOptimisticMessageId(messageId)) {
        toast.show('Poll is still sending', { tone: 'info', message: 'Try again in a moment.' })
        return
      }
      setPollVotes((prev) => {
        const mine = prev.find((v) => v.messageId === messageId && v.userId === currentUserId)
        const others = prev.filter(
          (v) => !(v.messageId === messageId && v.userId === currentUserId),
        )
        if (mine && mine.optionIndex === optionIndex) return others
        return [...others, { messageId, userId: currentUserId, optionIndex }]
      })
      const { error: voteError } = await castMessagePollVote(messageId, currentUserId, optionIndex)
      if (voteError) {
        toast.show('Could not vote', { tone: 'danger', message: voteError })
        void loadPollVotes([messageId])
      }
    },
    [currentUserId, loadPollVotes, toast],
  )

  const pollResultsByMessage = useMemo(() => {
    const byMessage: Record<string, MessagePollVote[]> = {}
    for (const vote of pollVotes) {
      ;(byMessage[vote.messageId] ??= []).push(vote)
    }
    const map: Record<string, PollResult> = {}
    for (const message of messages) {
      if (message.type === 'poll' && message.poll) {
        map[message.id] = buildPollResult(
          byMessage[message.id] ?? [],
          message.poll.options.length,
          currentUserId,
        )
      }
    }
    return map
  }, [pollVotes, messages, currentUserId])

  const reactionsByMessage = useMemo(() => {
    const map: Record<string, ReactionGroup[]> = {}
    const counts: Record<string, Record<string, { count: number; mine: boolean }>> = {}
    for (const row of reactionRows) {
      const byEmoji = (counts[row.messageId] ??= {})
      const entry = (byEmoji[row.emoji] ??= { count: 0, mine: false })
      entry.count += 1
      if (row.userId === currentUserId) entry.mine = true
    }
    for (const [messageId, byEmoji] of Object.entries(counts)) {
      map[messageId] = Object.entries(byEmoji).map(([emoji, v]) => ({
        emoji,
        count: v.count,
        mine: v.mine,
      }))
    }
    return map
  }, [reactionRows, currentUserId])

  return {
    messages,
    isLoading,
    error,
    hasMore,
    loadingOlder,
    loadOlder,
    sending,
    uploadProgress,
    peerTyping,
    peerReadAt,
    reactionsByMessage,
    pollResultsByMessage,
    send,
    resend,
    sendImage,
    sendFile,
    sendPoll,
    sendEvent,
    votePoll,
    edit,
    remove,
    react,
    handleTyping,
    markRead,
  }
}
