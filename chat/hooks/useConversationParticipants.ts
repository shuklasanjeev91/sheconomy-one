import { useEffect, useState } from 'react'

import { fetchConversationParticipants, type ConversationParticipant } from '~/chat/lib/chats'

/**
 * Resolves participant names + avatars for a conversation, keyed by user id.
 * Used by group threads to label incoming messages with the sender.
 */
export function useConversationParticipants(
  conversationId: string | null,
  enabled: boolean,
): Record<string, ConversationParticipant> {
  const [participants, setParticipants] = useState<Record<string, ConversationParticipant>>({})

  useEffect(() => {
    if (!conversationId || !enabled) {
      setParticipants({})
      return
    }
    let cancelled = false
    fetchConversationParticipants(conversationId).then((map) => {
      if (!cancelled) setParticipants(map)
    })
    return () => {
      cancelled = true
    }
  }, [conversationId, enabled])

  return participants
}
