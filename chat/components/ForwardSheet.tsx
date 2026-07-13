import { useUserChats } from '~/chat/hooks/useUserChats'
import { useChatTheme } from '~/chat/lib/chat-theme'
import type { ChatSummary } from '~/chat/lib/types'
import { AppBottomSheet, Avatar, Icons, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'

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
  const targets = chats.filter((c) => c.id !== fromConversationId)

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title="Forward to" scrollable={false}>
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
      ) : (
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          {targets.map((chat) => (
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
