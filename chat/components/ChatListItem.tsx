import { Platform } from 'react-native'

import { useChatTheme } from '~/chat/lib/chat-theme'
import { formatListTimestamp } from '~/chat/lib/time'
import type { ChatSummary } from '~/chat/lib/types'
import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'

type ChatListItemProps = {
  chat: ChatSummary
  active?: boolean
  onPress: () => void
  onRequestActions?: () => void
}

type PreviewKind = 'camera' | 'file' | 'call' | 'poll' | 'event' | null

/**
 * Legacy messages from the old app are stored as `text` with a bracketed label
 * (e.g. "[Poll] …"). Detect those so the list shows a clean label + icon.
 */
function legacyPreview(content: string | null): { kind: PreviewKind; text: string } | null {
  const value = (content ?? '').trim()
  if (value.startsWith('[Photo]')) return { kind: 'camera', text: 'Photo' }
  if (value.startsWith('[Poll]')) {
    const q = value.slice('[Poll]'.length).trim()
    return { kind: 'poll', text: q ? `Poll: ${q}` : 'Poll' }
  }
  if (value.startsWith('[Event]')) {
    const t = value.slice('[Event]'.length).trim()
    return { kind: 'event', text: t ? `Event: ${t}` : 'Event' }
  }
  if (value.startsWith('[Document]')) {
    const name = value.slice('[Document]'.length).trim()
    return { kind: 'file', text: name || 'Document' }
  }
  return null
}

function previewText(chat: ChatSummary): string {
  const legacy = chat.lastMessageType === 'text' ? legacyPreview(chat.lastMessage) : null
  if (legacy) return legacy.text
  if (chat.lastMessageType === 'image') return 'Photo'
  if (chat.lastMessageType === 'poll') {
    return chat.lastMessage && chat.lastMessage.trim().length > 0
      ? `Poll: ${chat.lastMessage}`
      : 'Poll'
  }
  if (chat.lastMessageType === 'event') {
    return chat.lastMessage && chat.lastMessage.trim().length > 0
      ? `Event: ${chat.lastMessage}`
      : 'Event'
  }
  if (chat.lastMessageType === 'file') {
    return chat.lastMessage && chat.lastMessage.trim().length > 0 ? chat.lastMessage : 'Document'
  }
  if (chat.lastMessageType === 'call') {
    const [kind, outcome] = (chat.lastMessage ?? '').split('|')
    const label = kind === 'video' ? 'Video call' : 'Voice call'
    return outcome === 'missed' ? `Missed ${label.toLowerCase()}` : label
  }
  if (chat.lastMessage && chat.lastMessage.trim().length > 0) return chat.lastMessage
  return 'Photo'
}

export function ChatListItem({ chat, active, onPress, onRequestActions }: ChatListItemProps) {
  const theme = useChatTheme()
  const hasUnread = chat.unreadCount > 0
  const legacy = chat.lastMessageType === 'text' ? legacyPreview(chat.lastMessage) : null
  const previewIcon: PreviewKind = legacy
    ? legacy.kind
    : chat.lastMessageType === 'image' || (!chat.lastMessage && chat.lastMessageType !== 'call' && chat.lastMessageType !== 'file')
      ? 'camera'
      : chat.lastMessageType === 'file'
        ? 'file'
        : chat.lastMessageType === 'call'
          ? 'call'
          : chat.lastMessageType === 'poll'
            ? 'poll'
            : chat.lastMessageType === 'event'
              ? 'event'
              : null
  const showSenderPrefix = chat.type === 'group' && !!chat.lastMessageSenderName

  const longPressProps =
    onRequestActions && Platform.OS !== 'web'
      ? { onLongPress: onRequestActions, delayLongPress: 300 }
      : {}

  return (
    <XStack
      onPress={onPress}
      {...longPressProps}
      cursor="pointer"
      paddingHorizontal={12}
      paddingVertical={10}
      gap={12}
      alignItems="center"
      backgroundColor={active ? theme.listItemActive : 'transparent'}
      hoverStyle={{ backgroundColor: active ? theme.listItemActive : theme.listItemHover }}
      pressStyle={{ backgroundColor: theme.listItemActive }}
      animation="quick"
    >
      <YStack>
        <Avatar size="$5" name={chat.name} src={chat.avatarUrl ?? undefined} />
        {chat.type === 'direct' && chat.isOnline ? (
          <YStack
            position="absolute"
            bottom={0}
            right={0}
            width={13}
            height={13}
            borderRadius={999}
            backgroundColor={theme.onlineDot}
            borderWidth={2}
            borderColor={theme.listBg}
          />
        ) : null}
      </YStack>

      <YStack flex={1} minWidth={0} gap={2}>
        <XStack alignItems="center" gap={8}>
          <Text
            flex={1}
            numberOfLines={1}
            fontSize={16}
            fontWeight={hasUnread ? '700' : '600'}
            color={theme.text}
          >
            {chat.name}
          </Text>
          <Text fontSize={12} color={hasUnread ? theme.brand : theme.textMuted} fontWeight={hasUnread ? '700' : '500'}>
            {formatListTimestamp(chat.lastMessageTime)}
          </Text>
        </XStack>

        <XStack alignItems="center" gap={6}>
          {previewIcon === 'camera' ? <Icons.Camera size={14} color={theme.textMuted} /> : null}
          {previewIcon === 'file' ? <Icons.FileText size={14} color={theme.textMuted} /> : null}
          {previewIcon === 'call' ? <Icons.Phone size={14} color={theme.textMuted} /> : null}
          {previewIcon === 'poll' ? <Icons.BarChart2 size={14} color={theme.textMuted} /> : null}
          {previewIcon === 'event' ? <Icons.Calendar size={14} color={theme.textMuted} /> : null}
          <Text
            flex={1}
            numberOfLines={1}
            fontSize={14}
            color={hasUnread ? theme.textSecondary : theme.textMuted}
            fontWeight={hasUnread ? '600' : '400'}
          >
            {showSenderPrefix ? `${chat.lastMessageSenderName}: ` : ''}
            {previewText(chat)}
          </Text>

          {chat.isMuted ? <Icons.BellOff size={14} color={theme.textMuted} /> : null}
          {chat.isPinned ? <Icons.Pin size={14} color={theme.textMuted} /> : null}

          {hasUnread ? (
            <XStack
              minWidth={20}
              height={20}
              borderRadius={999}
              paddingHorizontal={6}
              backgroundColor={theme.unreadBadge}
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize={11} fontWeight="800" color={theme.unreadBadgeText}>
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </Text>
            </XStack>
          ) : null}

          {onRequestActions ? (
            <XStack
              onPress={(e) => {
                ;(e as unknown as { stopPropagation?: () => void }).stopPropagation?.()
                onRequestActions()
              }}
              cursor="pointer"
              width={26}
              height={26}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              hoverStyle={{ backgroundColor: theme.listItemActive }}
              pressStyle={{ scale: 0.9 }}
              animation="quick"
              aria-label="Chat options"
            >
              <Icons.MoreVertical size={16} color={theme.textMuted} />
            </XStack>
          ) : null}
        </XStack>
      </YStack>
    </XStack>
  )
}
