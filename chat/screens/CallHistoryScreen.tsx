import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { ChatSectionTabs } from '~/chat/components/ChatSectionTabs'
import { useOutgoingCall } from '~/chat/hooks/useOutgoingCall'
import { fetchCallHistory, type CallHistoryEntry } from '~/chat/lib/calls'
import { useChatTheme } from '~/chat/lib/chat-theme'
import { formatListTimestamp } from '~/chat/lib/time'
import type { ChatSummary } from '~/chat/lib/types'
import { Avatar, Button, Icons, ScrollView, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { chatRoutes, routes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'

const LIST_PANE_WIDTH = 380

function CallDirectionIcon({ entry, color }: { entry: CallHistoryEntry; color: string }) {
  const missedColor = '#f2385a'
  if (entry.status === 'missed' || entry.status === 'declined') {
    return <Icons.PhoneMissed size={15} color={missedColor} />
  }
  if (entry.direction === 'incoming') {
    return <Icons.PhoneIncoming size={15} color={color} />
  }
  return <Icons.PhoneOutgoing size={15} color={color} />
}

function callSubtitle(entry: CallHistoryEntry): string {
  const missed = entry.status === 'missed' || entry.status === 'declined'
  const directionLabel = missed
    ? entry.direction === 'incoming'
      ? 'Missed'
      : entry.status === 'declined'
        ? 'Declined'
        : 'Cancelled'
    : entry.direction === 'incoming'
      ? 'Incoming'
      : 'Outgoing'
  return `${directionLabel} · ${formatListTimestamp(entry.createdAt)}`
}

function historyEntryToChat(entry: CallHistoryEntry): ChatSummary | null {
  if (!entry.conversationId) return null
  return {
    id: entry.conversationId,
    name: entry.peerName,
    type: 'direct',
    lastMessage: '',
    lastMessageType: 'text',
    lastMessageTime: entry.createdAt,
    lastMessageSenderName: null,
    unreadCount: 0,
    avatarUrl: entry.peerAvatar,
    otherUserId: entry.peerId,
    otherUserName: entry.peerName,
    otherUserAvatar: entry.peerAvatar,
    isOnline: false,
    lastSeen: null,
    currentUserRole: 'member',
    isPinned: false,
    isMuted: false,
    isArchived: false,
  }
}

export function CallHistoryScreen() {
  const theme = useChatTheme()
  const router = useRouter()
  const toast = useAppToast()
  const { isDesktop, mobileTabBarOffset } = useAppLayout()
  const { user, isLoading: authLoading } = useSupabase()
  const currentUserId = user?.id ?? null
  const { start: startOutgoingCall } = useOutgoingCall(currentUserId ?? '')

  const [entries, setEntries] = useState<CallHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!currentUserId) return
    setLoading(true)
    const rows = await fetchCallHistory(currentUserId)
    setEntries(rows)
    setLoading(false)
  }, [currentUserId])

  useEffect(() => {
    void load()
  }, [load])

  async function redial(entry: CallHistoryEntry) {
    const chat = historyEntryToChat(entry)
    if (!chat || !currentUserId) {
      if (entry.conversationId) router.push(chatRoutes.conversation(entry.conversationId))
      else
        toast.show('Cannot redial', {
          tone: 'danger',
          message: 'No conversation linked to this call.',
        })
      return
    }
    await startOutgoingCall(chat, entry.callType)
  }

  const fillStyle =
    Platform.OS === 'web' ? ({ flex: 1, minHeight: 0, width: '100%' } as const) : undefined

  if (authLoading) {
    return (
      <YStack
        flex={1}
        minHeight={0}
        backgroundColor={theme.pageBg}
        alignItems="center"
        justifyContent="center"
        style={fillStyle}
      >
        <Spinner size="large" color={theme.brand} />
      </YStack>
    )
  }

  if (!currentUserId) {
    return (
      <YStack
        flex={1}
        minHeight={0}
        backgroundColor={theme.pageBg}
        alignItems="center"
        justifyContent="center"
        gap={16}
        paddingHorizontal={32}
        style={fillStyle}
      >
        <YStack
          width={72}
          height={72}
          borderRadius={999}
          backgroundColor={theme.brand}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.Phone size={32} color={theme.brandContrast} />
        </YStack>
        <Text fontSize={20} fontWeight="800" color={theme.text} textAlign="center">
          Your calls
        </Text>
        <Text fontSize={14} color={theme.textMuted} textAlign="center" lineHeight={20} maxWidth={340}>
          Sign in to see your recent voice and video calls and call your contacts back.
        </Text>
        <AppLink href={routes.signIn} asChild>
          <Button tone="primary">Sign in to continue</Button>
        </AppLink>
      </YStack>
    )
  }

  const listBody = (
    <>
      {loading ? (
        <YStack flex={1} alignItems="center" justifyContent="center" paddingVertical="$8">
          <Spinner size="large" color={theme.brand} />
        </YStack>
      ) : entries.length === 0 ? (
        <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal={32} gap={10}>
          <Icons.PhoneCall size={40} color={theme.textMuted} />
          <Text fontSize={15} fontWeight="700" color={theme.text} textAlign="center">
            No calls yet
          </Text>
          <Text fontSize={13} color={theme.textMuted} textAlign="center" lineHeight={19}>
            Voice and video calls you make or receive will show up here.
          </Text>
        </YStack>
      ) : (
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator
          contentContainerStyle={{ paddingTop: 6, paddingBottom: mobileTabBarOffset + 88 }}
        >
          {entries.map((entry) => {
            const openThread = () =>
              entry.conversationId
                ? router.push(chatRoutes.conversation(entry.conversationId))
                : undefined
            return (
              <XStack
                key={entry.id}
                onPress={openThread}
                cursor={entry.conversationId ? 'pointer' : 'default'}
                alignItems="center"
                gap={12}
                paddingVertical={10}
                paddingHorizontal={16}
                hoverStyle={{ backgroundColor: theme.listItemHover }}
                pressStyle={{ backgroundColor: theme.listItemActive }}
                animation="quick"
              >
                <Avatar size="$5" name={entry.peerName} src={entry.peerAvatar ?? undefined} />
                <YStack flex={1} minWidth={0}>
                  <Text fontSize={15.5} fontWeight="700" color={theme.text} numberOfLines={1}>
                    {entry.peerName}
                  </Text>
                  <XStack alignItems="center" gap={5}>
                    <CallDirectionIcon entry={entry} color={theme.brand} />
                    <Text fontSize={13} color={theme.textMuted} numberOfLines={1}>
                      {callSubtitle(entry)}
                    </Text>
                  </XStack>
                </YStack>
                <XStack
                  width={38}
                  height={38}
                  borderRadius={999}
                  alignItems="center"
                  justifyContent="center"
                  onPress={(e: { stopPropagation?: () => void }) => {
                    e?.stopPropagation?.()
                    void redial(entry)
                  }}
                  cursor="pointer"
                  hoverStyle={{ backgroundColor: theme.listItemActive }}
                  animation="quick"
                  accessibilityLabel={entry.callType === 'video' ? 'Redial video' : 'Redial call'}
                >
                  {entry.callType === 'video' ? (
                    <Icons.Video size={20} color={theme.brand} />
                  ) : (
                    <Icons.Phone size={20} color={theme.brand} />
                  )}
                </XStack>
              </XStack>
            )
          })}
        </ScrollView>
      )}
    </>
  )

  if (isDesktop) {
    return (
      <XStack
        width="100%"
        flex={1}
        minHeight={0}
        backgroundColor={theme.pageBg}
        overflow="hidden"
        style={fillStyle}
      >
        <YStack
          width={LIST_PANE_WIDTH}
          borderRightWidth={1}
          borderRightColor={theme.border}
          minHeight={0}
          backgroundColor={theme.listBg}
        >
          <ChatSectionTabs />
          {listBody}
        </YStack>

        <YStack
          flex={1}
          minWidth={0}
          minHeight={0}
          alignItems="center"
          justifyContent="center"
          gap={12}
          backgroundColor={theme.threadBg}
          paddingHorizontal={40}
        >
          <YStack
            width={96}
            height={96}
            borderRadius={999}
            backgroundColor={theme.listBg}
            alignItems="center"
            justifyContent="center"
          >
            <Icons.PhoneCall size={44} color={theme.brand} />
          </YStack>
          <Text fontSize={20} fontWeight="800" color={theme.text} textAlign="center">
            Call history
          </Text>
          <Text fontSize={14} color={theme.textMuted} textAlign="center" lineHeight={20} maxWidth={360}>
            Tap the phone or video icon to redial. Select a row to open the conversation.
          </Text>
        </YStack>
      </XStack>
    )
  }

  return (
    <YStack flex={1} minHeight={0} backgroundColor={theme.listBg} style={fillStyle}>
      <XStack
        alignItems="center"
        paddingHorizontal={16}
        paddingVertical={14}
        borderBottomWidth={1}
        borderBottomColor={theme.divider}
      >
        <Text fontSize={19} fontWeight="800" color={theme.text}>
          Calls
        </Text>
      </XStack>
      {listBody}
    </YStack>
  )
}
