import { useEffect, useMemo, useState } from 'react'

import { useUserChats } from '~/chat/hooks/useUserChats'
import { useChatTheme } from '~/chat/lib/chat-theme'
import type { ChatSummary } from '~/chat/lib/types'
import { ScreenSearchField } from '~/components/search'
import { AppBottomSheet, Avatar, Icons, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { SHEET_SEARCH_MIN_ITEMS, filterBySearchQuery } from '~/lib/search'

type ForwardSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  /** Conversation the message is coming from (excluded from the list). */
  fromConversationId: string
  onPick: (chat: ChatSummary) => void
}

export function ForwardSheet({
  open,
  onOpenChange,
  currentUserId,
  fromConversationId,
  onPick,
}: ForwardSheetProps) {
  const theme = useChatTheme()
  const { chats, isLoading } = useUserChats(open ? currentUserId : null)
  const [query, setQuery] = useState('')
  const targets = useMemo(
    () => chats.filter((chat) => chat.id !== fromConversationId),
    [chats, fromConversationId],
  )
  const filteredTargets = useMemo(
    () => filterBySearchQuery(targets, query, (chat) => [chat.name]),
    [targets, query],
  )

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const showSearch = targets.length >= SHEET_SEARCH_MIN_ITEMS || query.length > 0

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title="Forward to" scrollable={false}>
      {showSearch ? (
        <ScreenSearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search chats"
          clearable
        />
      ) : null}
      {isLoading ? (
        <YStack paddingVertical={24} alignItems="center">
          <Spinner size="small" color={theme.brand} />
        </YStack>
      ) : targets.length === 0 ? (
        <YStack paddingVertical={24} alignItems="center" gap={6}>
          <Icons.Forward size={26} color={theme.textMuted} />
          <Text fontSize={14} color={theme.textMuted}>
            No other chats to forward to.
          </Text>
        </YStack>
      ) : filteredTargets.length === 0 ? (
        <YStack paddingVertical={24} alignItems="center" gap={6}>
          <Icons.Search size={26} color={theme.textMuted} />
          <Text fontSize={14} color={theme.textMuted}>
            No chats match your search.
          </Text>
        </YStack>
      ) : (
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          {filteredTargets.map((chat) => (
            <XStack
              key={chat.id}
              onPress={() => onPick(chat)}
              cursor="pointer"
              alignItems="center"
              gap={12}
              paddingVertical={9}
              paddingHorizontal={6}
              borderRadius={10}
              hoverStyle={{ backgroundColor: theme.listItemHover }}
              pressStyle={{ backgroundColor: theme.listItemActive }}
              animation="quick"
            >
              <Avatar size="$4" name={chat.name} src={chat.avatarUrl ?? undefined} />
              <Text flex={1} numberOfLines={1} fontSize={15.5} fontWeight="600" color={theme.text}>
                {chat.name}
              </Text>
              <Icons.Send size={17} color={theme.brand} />
            </XStack>
          ))}
        </ScrollView>
      )}
    </AppBottomSheet>
  )
}
