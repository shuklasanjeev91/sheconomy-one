import { useMemo, useState } from 'react'

import { ChatListItem } from '~/chat/components/ChatListItem'
import {
  clearConversation,
  markAllConversationsRead,
  setConversationArchived,
  setConversationMuted,
  setConversationPinned,
} from '~/chat/lib/chats'
import { useChatTheme } from '~/chat/lib/chat-theme'
import type { ChatSummary } from '~/chat/lib/types'
import {
  AppBottomSheet,
  Icons,
  ScrollView,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'

type ChatListPaneProps = {
  chats: ChatSummary[]
  isLoading: boolean
  activeChatId: string | null
  currentUserId: string
  onSelect: (chat: ChatSummary) => void
  onNewChat: () => void
  onChanged?: () => void
  /** Space occupied by an overlaying bottom tab bar (mobile), so the FAB clears it. */
  tabClearance?: number
}

type ActionRowProps = {
  icon: React.ReactNode
  label: string
  danger?: boolean
  onPress: () => void
}

function ActionRow({ icon, label, danger, onPress }: ActionRowProps) {
  const theme = useChatTheme()
  return (
    <XStack
      onPress={onPress}
      cursor="pointer"
      alignItems="center"
      gap={14}
      paddingVertical={12}
      paddingHorizontal={6}
      borderRadius={10}
      hoverStyle={{ backgroundColor: theme.listItemHover }}
      pressStyle={{ backgroundColor: theme.listItemActive }}
      animation="quick"
    >
      {icon}
      <Text fontSize={15.5} fontWeight="600" color={danger ? theme.dangerText : theme.text}>
        {label}
      </Text>
    </XStack>
  )
}

export function ChatListPane({
  chats,
  isLoading,
  activeChatId,
  currentUserId,
  onSelect,
  onNewChat,
  onChanged,
  tabClearance = 0,
}: ChatListPaneProps) {
  const theme = useChatTheme()
  const toast = useAppToast()
  const fabBottom = tabClearance + 16
  const scrollBottomPadding = tabClearance + 88

  const [actionsChat, setActionsChat] = useState<ChatSummary | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [pinnedOnly, setPinnedOnly] = useState(false)
  const [markingRead, setMarkingRead] = useState(false)
  const unreadTotal = useMemo(
    () => chats.reduce((sum, chat) => sum + chat.unreadCount, 0),
    [chats],
  )
  const pinnedTotal = useMemo(() => chats.filter((chat) => chat.isPinned).length, [chats])

  const filteredChats = useMemo(() => {
    return chats.filter((chat) => {
      if (unreadOnly && chat.unreadCount <= 0) return false
      if (pinnedOnly && !chat.isPinned) return false
      return true
    })
  }, [chats, pinnedOnly, unreadOnly])

  const { activeChats, archivedChats } = useMemo(() => {
    const active: ChatSummary[] = []
    const archived: ChatSummary[] = []
    for (const chat of filteredChats) {
      if (chat.isArchived) archived.push(chat)
      else active.push(chat)
    }
    return { activeChats: active, archivedChats: archived }
  }, [filteredChats])

  function closeActions() {
    setActionsChat(null)
  }

  async function toggleArchive() {
    if (!actionsChat) return
    const chat = actionsChat
    closeActions()
    await setConversationArchived(chat.id, currentUserId, !chat.isArchived)
    onChanged?.()
  }

  async function togglePin() {
    if (!actionsChat) return
    const chat = actionsChat
    closeActions()
    await setConversationPinned(chat.id, currentUserId, !chat.isPinned)
    onChanged?.()
  }

  async function toggleMute() {
    if (!actionsChat) return
    const chat = actionsChat
    closeActions()
    await setConversationMuted(chat.id, currentUserId, !chat.isMuted)
    onChanged?.()
  }

  async function clearChat() {
    if (!actionsChat) return
    const chat = actionsChat
    closeActions()
    await clearConversation(chat.id, currentUserId)
    onChanged?.()
  }

  async function markAllRead() {
    if (markingRead || unreadTotal <= 0) return
    setMarkingRead(true)
    const result = await markAllConversationsRead(chats, currentUserId)
    setMarkingRead(false)
    if (result.error) {
      toast.show('Could not mark all as read', { tone: 'danger', message: result.error })
      return
    }
    toast.show(result.marked ? `Marked ${result.marked} chats read` : 'Inbox already clear', {
      tone: 'success',
    })
    onChanged?.()
  }

  return (
    <YStack flex={1} backgroundColor={theme.listBg} minHeight={0} position="relative">
      {chats.length > 0 ? (
        <YStack paddingHorizontal={12} paddingTop={8} paddingBottom={6} gap={8}>
          <XStack gap={8} flexWrap="wrap">
            <XStack
              paddingHorizontal={12}
              paddingVertical={6}
              borderRadius={999}
              borderWidth={1}
              borderColor={unreadOnly ? theme.brand : theme.border}
              backgroundColor={unreadOnly ? theme.listItemActive : theme.inputBg}
              cursor="pointer"
              onPress={() => setUnreadOnly((value) => !value)}
            >
              <Text fontSize={12} fontWeight="700" color={unreadOnly ? theme.brand : theme.textMuted}>
                Unread only{unreadTotal > 0 ? ` (${unreadTotal})` : ''}
              </Text>
            </XStack>
            {pinnedTotal > 0 ? (
              <XStack
                paddingHorizontal={12}
                paddingVertical={6}
                borderRadius={999}
                borderWidth={1}
                borderColor={pinnedOnly ? theme.brand : theme.border}
                backgroundColor={pinnedOnly ? theme.listItemActive : theme.inputBg}
                cursor="pointer"
                onPress={() => setPinnedOnly((value) => !value)}
              >
                <Text fontSize={12} fontWeight="700" color={pinnedOnly ? theme.brand : theme.textMuted}>
                  Pinned{pinnedTotal ? ` (${pinnedTotal})` : ''}
                </Text>
              </XStack>
            ) : null}
            {unreadTotal > 0 ? (
              <XStack
                paddingHorizontal={12}
                paddingVertical={6}
                borderRadius={999}
                borderWidth={1}
                borderColor={theme.border}
                backgroundColor={theme.inputBg}
                cursor="pointer"
                opacity={markingRead ? 0.7 : 1}
                onPress={() => void markAllRead()}
              >
                <Text fontSize={12} fontWeight="700" color={theme.brand}>
                  {markingRead ? 'Marking…' : 'Mark all read'}
                </Text>
              </XStack>
            ) : null}
          </XStack>
        </YStack>
      ) : null}

      {isLoading ? (
        <YStack flex={1} alignItems="center" justifyContent="center" paddingVertical="$8">
          <Spinner size="large" color={theme.brand} />
        </YStack>
      ) : chats.length === 0 ? (
        <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal={32} gap={12}>
          <Icons.MessagesSquare size={40} color={theme.textMuted} />
          <Text fontSize={15} fontWeight="700" color={theme.text} textAlign="center">
            No conversations yet
          </Text>
          <Text fontSize={13} color={theme.textMuted} textAlign="center" lineHeight={19}>
            Start a chat with someone from your network — works on web, iOS, and Android.
          </Text>
          <XStack
            onPress={onNewChat}
            cursor="pointer"
            alignItems="center"
            gap={8}
            paddingHorizontal={16}
            paddingVertical={10}
            borderRadius={999}
            backgroundColor={theme.brand}
            pressStyle={{ opacity: 0.9, scale: 0.98 }}
          >
            <Icons.PenSquare size={16} color={theme.brandContrast} />
            <Text fontSize={13} fontWeight="700" color={theme.brandContrast}>
              Start a chat
            </Text>
          </XStack>
        </YStack>
      ) : activeChats.length === 0 && archivedChats.length === 0 ? (
        <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal={32} gap={12}>
          <Icons.Search size={36} color={theme.textMuted} />
          <Text fontSize={15} fontWeight="700" color={theme.text} textAlign="center">
            No chats match
          </Text>
          <Text fontSize={13} color={theme.textMuted} textAlign="center" lineHeight={19}>
            Try clearing Unread or Pinned filters.
          </Text>
          <XStack
            onPress={() => {
              setUnreadOnly(false)
              setPinnedOnly(false)
            }}
            cursor="pointer"
            paddingHorizontal={14}
            paddingVertical={8}
            borderRadius={999}
            borderWidth={1}
            borderColor={theme.border}
            backgroundColor={theme.inputBg}
            pressStyle={{ opacity: 0.9 }}
          >
            <Text fontSize={12} fontWeight="700" color={theme.brand}>
              Clear filters
            </Text>
          </XStack>
        </YStack>
      ) : (
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator
          contentContainerStyle={{ paddingTop: 8, paddingBottom: scrollBottomPadding }}
        >
          {archivedChats.length > 0 ? (
            <>
              <XStack
                onPress={() => setShowArchived((v) => !v)}
                cursor="pointer"
                alignItems="center"
                gap={12}
                paddingVertical={12}
                paddingHorizontal={16}
                hoverStyle={{ backgroundColor: theme.listItemHover }}
                pressStyle={{ backgroundColor: theme.listItemActive }}
                animation="quick"
              >
                <Icons.Archive size={20} color={theme.textSecondary} />
                <Text flex={1} fontSize={15} fontWeight="600" color={theme.text}>
                  Archived
                </Text>
                <Text fontSize={13} fontWeight="600" color={theme.textMuted}>
                  {archivedChats.length}
                </Text>
                <Icons.ChevronDown
                  size={18}
                  color={theme.textMuted}
                  rotate={showArchived ? '180deg' : '0deg'}
                />
              </XStack>
              {showArchived
                ? archivedChats.map((chat) => (
                    <ChatListItem
                      key={chat.id}
                      chat={chat}
                      active={chat.id === activeChatId}
                      onPress={() => onSelect(chat)}
                      onRequestActions={() => setActionsChat(chat)}
                    />
                  ))
                : null}
              <YStack height={1} backgroundColor={theme.divider} marginVertical={4} />
            </>
          ) : null}

          {activeChats.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              active={chat.id === activeChatId}
              onPress={() => onSelect(chat)}
              onRequestActions={() => setActionsChat(chat)}
            />
          ))}
        </ScrollView>
      )}

      <XStack
        position="absolute"
        bottom={fabBottom}
        right={20}
        zIndex={50}
        onPress={onNewChat}
        cursor="pointer"
        width={58}
        height={58}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor={theme.brand}
        hoverStyle={{ opacity: 0.92 }}
        pressStyle={{ scale: 0.93 }}
        animation="quick"
        shadowColor="#000"
        shadowOpacity={0.22}
        shadowRadius={10}
        shadowOffset={{ width: 0, height: 4 }}
        aria-label="Start new chat"
      >
        <Icons.PenSquare size={24} color={theme.brandContrast} />
      </XStack>

      <AppBottomSheet
        open={!!actionsChat}
        onOpenChange={(open) => {
          if (!open) closeActions()
        }}
        title={actionsChat?.name}
        scrollable={false}
      >
        <YStack>
          <ActionRow
            icon={<Icons.Pin size={20} color={theme.textSecondary} />}
            label={actionsChat?.isPinned ? 'Unpin chat' : 'Pin chat'}
            onPress={togglePin}
          />
          <ActionRow
            icon={
              actionsChat?.isMuted ? (
                <Icons.Bell size={20} color={theme.textSecondary} />
              ) : (
                <Icons.BellOff size={20} color={theme.textSecondary} />
              )
            }
            label={actionsChat?.isMuted ? 'Unmute notifications' : 'Mute notifications'}
            onPress={toggleMute}
          />
          <ActionRow
            icon={<Icons.Archive size={20} color={theme.textSecondary} />}
            label={actionsChat?.isArchived ? 'Unarchive chat' : 'Archive chat'}
            onPress={toggleArchive}
          />
          <ActionRow
            icon={<Icons.Eraser size={20} color={theme.dangerText} />}
            label="Clear chat"
            danger
            onPress={clearChat}
          />
        </YStack>
      </AppBottomSheet>
    </YStack>
  )
}
