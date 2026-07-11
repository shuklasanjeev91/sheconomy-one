import type { PeerPresence } from '~/chat/hooks/usePeerPresence'
import { formatLastSeen } from '~/chat/lib/time'
import type { ChatSummary } from '~/chat/lib/types'
import { useChatTheme } from '~/chat/lib/chat-theme'
import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'

type ChatThreadHeaderProps = {
  chat: ChatSummary
  presence: PeerPresence
  peerTyping: boolean
  showBack: boolean
  onBack: () => void
  onOpenMenu?: () => void
  onOpenInfo?: () => void
  onSearch?: () => void
  onAudioCall?: () => void
  onVideoCall?: () => void
}

export function ChatThreadHeader({
  chat,
  presence,
  peerTyping,
  showBack,
  onBack,
  onOpenMenu,
  onOpenInfo,
  onSearch,
  onAudioCall,
  onVideoCall,
}: ChatThreadHeaderProps) {
  const theme = useChatTheme()

  function HeaderIconButton({
    onPress,
    label,
    children,
  }: {
    onPress: () => void
    label: string
    children: React.ReactNode
  }) {
    return (
      <XStack
        onPress={onPress}
        cursor="pointer"
        width={38}
        height={38}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        hoverStyle={{ backgroundColor: theme.listItemHover }}
        pressStyle={{ scale: 0.92 }}
        animation="quick"
        aria-label={label}
      >
        {children}
      </XStack>
    )
  }

  const subtitle = peerTyping
    ? 'typing…'
    : chat.type === 'group'
      ? 'Group chat'
      : formatLastSeen(presence.isOnline, presence.lastSeen)

  return (
    <XStack
      alignItems="center"
      gap={10}
      paddingHorizontal={12}
      paddingVertical={9}
      backgroundColor={theme.headerBg}
      borderBottomWidth={1}
      borderBottomColor={theme.border}
    >
      {showBack ? (
        <XStack
          onPress={onBack}
          cursor="pointer"
          width={38}
          height={38}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          hoverStyle={{ backgroundColor: theme.listItemHover }}
          pressStyle={{ scale: 0.92 }}
          animation="quick"
          aria-label="Back"
        >
          <Icons.ChevronLeft size={24} color={theme.text} />
        </XStack>
      ) : null}

      <XStack
        flex={1}
        minWidth={0}
        alignItems="center"
        gap={10}
        onPress={onOpenInfo}
        cursor={onOpenInfo ? 'pointer' : 'default'}
        hoverStyle={onOpenInfo ? { opacity: 0.85 } : undefined}
        pressStyle={onOpenInfo ? { opacity: 0.7 } : undefined}
        aria-label="Conversation info"
      >
        <YStack>
          <Avatar size="$4" name={chat.name} src={chat.avatarUrl ?? undefined} />
          {chat.type === 'direct' && presence.isOnline ? (
            <YStack
              position="absolute"
              bottom={0}
              right={0}
              width={11}
              height={11}
              borderRadius={999}
              backgroundColor={theme.onlineDot}
              borderWidth={2}
              borderColor={theme.headerBg}
            />
          ) : null}
        </YStack>

        <YStack flex={1} minWidth={0}>
          <XStack alignItems="center" gap={6}>
            <Text fontSize={16} fontWeight="700" color={theme.text} numberOfLines={1}>
              {chat.name}
            </Text>
            {chat.isMuted ? <Icons.BellOff size={14} color={theme.textMuted} /> : null}
          </XStack>
          {subtitle ? (
            <Text
              fontSize={12.5}
              color={peerTyping ? theme.brand : theme.textMuted}
              fontWeight={peerTyping ? '700' : '500'}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </YStack>
      </XStack>

      {onVideoCall ? (
        <HeaderIconButton onPress={onVideoCall} label="Video call">
          <Icons.Video size={21} color={theme.text} />
        </HeaderIconButton>
      ) : null}

      {onAudioCall ? (
        <HeaderIconButton onPress={onAudioCall} label="Voice call">
          <Icons.Phone size={19} color={theme.text} />
        </HeaderIconButton>
      ) : null}

      {onSearch ? (
        <HeaderIconButton onPress={onSearch} label="Search messages">
          <Icons.Search size={20} color={theme.text} />
        </HeaderIconButton>
      ) : null}

      {onOpenMenu ? (
        <HeaderIconButton onPress={onOpenMenu} label="Chat options">
          <Icons.MoreVertical size={22} color={theme.text} />
        </HeaderIconButton>
      ) : null}
    </XStack>
  )
}
