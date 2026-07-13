import { useEffect, useState } from 'react'

import { fetchStarredMessages } from '~/chat/lib/chats'
import { mediaPreviewLabel } from '~/chat/lib/emoji'
import { useChatTheme } from '~/chat/lib/chat-theme'
import { formatListTimestamp } from '~/chat/lib/time'
import type { ChatMessage } from '~/chat/lib/types'
import { AppBottomSheet, Icons, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'

type StarredMessagesSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId: string
  currentUserId: string
  resolveSenderName: (senderId: string | null) => string
}

function preview(message: ChatMessage): string {
  if (message.content.trim().length > 0) return message.content
  return mediaPreviewLabel(message.type)
}

export function StarredMessagesSheet({
  open,
  onOpenChange,
  conversationId,
  currentUserId,
  resolveSenderName,
}: StarredMessagesSheetProps) {
  const theme = useChatTheme()
  const [items, setItems] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetchStarredMessages(currentUserId, conversationId).then((rows) => {
      if (cancelled) return
      setItems(rows)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, currentUserId, conversationId])

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title="Starred messages" scrollable={false}>
      {loading ? (
        <YStack paddingVertical={24} alignItems="center">
          <Spinner size="small" color={theme.brand} />
        </YStack>
      ) : items.length === 0 ? (
        <YStack paddingVertical={24} alignItems="center" gap={6}>
          <Icons.Star size={26} color={theme.textMuted} />
          <Text fontSize={14} color={theme.textMuted}>
            No starred messages yet.
          </Text>
        </YStack>
      ) : (
        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
          {items.map((message) => (
            <YStack
              key={message.id}
              paddingVertical={9}
              paddingHorizontal={6}
              gap={3}
              borderBottomWidth={1}
              borderBottomColor={theme.border}
            >
              <XStack alignItems="center" gap={6}>
                <Icons.Star size={13} color={theme.brand} />
                <Text fontSize={13} fontWeight="700" color={theme.text}>
                  {resolveSenderName(message.senderId)}
                </Text>
                <YStack flex={1} />
                <Text fontSize={11.5} color={theme.textMuted}>
                  {formatListTimestamp(message.createdAt)}
                </Text>
              </XStack>
              <Text fontSize={14} color={theme.textSecondary} numberOfLines={2}>
                {preview(message)}
              </Text>
            </YStack>
          ))}
        </ScrollView>
      )}
    </AppBottomSheet>
  )
}
