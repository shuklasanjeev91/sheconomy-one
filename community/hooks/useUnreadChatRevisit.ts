import { useMemo } from 'react'

import { useUserChats } from '~/chat/hooks/useUserChats'
import {
  buildUnreadChatRevisitCards,
  type UnreadChatRevisitCard,
} from '~/chat/lib/unread-chats-revisit'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useUnreadChatRevisit(limit = 5) {
  const { user, isLoading: authLoading } = useSupabase()
  const { chats, isLoading } = useUserChats(user?.id)

  const cards = useMemo(
    () => buildUnreadChatRevisitCards(chats, limit),
    [chats, limit],
  )

  return useMemo(
    () => ({
      cards,
      loading: authLoading || isLoading,
      hasCards: cards.length > 0,
    }),
    [authLoading, cards, isLoading],
  )
}

export type { UnreadChatRevisitCard }
