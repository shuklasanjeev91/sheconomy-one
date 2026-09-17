import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { AppLink } from '~/components/navigation/AppLink'
import { ChatListPane } from '~/chat/components/ChatListPane'
import { ChatThreadPane } from '~/chat/components/ChatThreadPane'
import { NewCoworkChatSheet } from '~/co-work/components/NewCoworkChatSheet'
import { CoWorkBrandChip, CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { useCoworkMainChats } from '~/co-work/hooks/useCoworkMainChats'
import {
  collaborationChatSurfaceDescription,
  collaborationChatSurfaceLabel,
  COWORK_MAIN_CHAT_SURFACE,
  MEETING_CHAT_SURFACE,
} from '~/co-work/lib/main-chat'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { ChatSummary } from '~/chat/lib/types'
import { Button, Icons, ListSkeleton, Text, XStack, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { coWorkRoutes, routes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'
import { navigateApp } from '~/lib/platform/navigate'

const LIST_PANE_WIDTH = 380

type CoWorkMainChatScreenProps = {
  chatId?: string | null
}

/**
 * Persistent Co-Work Main Chat (conversations type=cowork).
 * Meeting chat lives only inside a live meeting and uses meeting_chat_messages.
 */
export function CoWorkMainChatScreen({ chatId = null }: CoWorkMainChatScreenProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const { isDesktop, mobileTabBarOffset } = useAppLayout()
  const { user, isLoading: authLoading } = useSupabase()
  const currentUserId = user?.id ?? null
  const { chats, isLoading, reload } = useCoworkMainChats(currentUserId)
  const [newChatOpen, setNewChatOpen] = useState(false)
  const reloadedFor = useRef<string | null>(null)

  const activeChat = useMemo<ChatSummary | null>(
    () => (chatId ? chats.find((c) => c.id === chatId) ?? null : null),
    [chats, chatId],
  )

  useEffect(() => {
    if (!chatId || isLoading || activeChat) return
    if (reloadedFor.current === chatId) return
    reloadedFor.current = chatId
    void reload()
  }, [chatId, isLoading, activeChat, reload])

  useEffect(() => {
    reloadedFor.current = null
  }, [currentUserId])

  const fillStyle =
    Platform.OS === 'web' ? ({ flex: 1, minHeight: 0, width: '100%' } as const) : undefined

  if (authLoading && chats.length === 0) {
    return (
      <YStack flex={1} minHeight={0} backgroundColor={coworkUi.pageBg} style={fillStyle}>
        <ListSkeleton rows={8} />
      </YStack>
    )
  }

  if (!currentUserId) {
    return (
      <YStack
        flex={1}
        minHeight={0}
        backgroundColor={coworkUi.pageBg}
        alignItems="center"
        justifyContent="center"
        gap={16}
        paddingHorizontal={32}
        style={fillStyle}
      >
        <Text fontSize={20} fontWeight="800" color={coworkUi.text} textAlign="center">
          Sign in for Co-Work Main Chat
        </Text>
        <Text color={coworkUi.textSecondary} textAlign="center">
          Persistent collaboration lives here — separate from in-meeting chat.
        </Text>
        <AppLink href={routes.signIn} asChild>
          <Button tone="primary" borderRadius={999}>
            Sign in
          </Button>
        </AppLink>
      </YStack>
    )
  }

  function openChat(chat: ChatSummary) {
    navigateApp(coWorkRoutes.chatThread(chat.id))
  }

  function clearChat() {
    navigateApp(coWorkRoutes.chat)
  }

  const showList = isDesktop || !chatId
  const showThread = isDesktop || !!chatId

  return (
    <YStack flex={1} minHeight={0} backgroundColor={coworkUi.pageBg} style={fillStyle}>
      <YStack
        paddingHorizontal={isDesktop ? '$5' : '$3'}
        paddingTop="$3"
        paddingBottom="$2"
        gap="$2"
        borderBottomWidth={1}
        borderBottomColor={coworkUi.borderSoft}
        backgroundColor={coworkUi.surface}
      >
        <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
          <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
            <CoWorkBrandChip label="CO-WORK" />
            <Text fontSize={18} fontWeight="800" color={coworkUi.text} numberOfLines={1}>
              {collaborationChatSurfaceLabel(COWORK_MAIN_CHAT_SURFACE)}
            </Text>
          </XStack>
          <AppLink href={coWorkRoutes.home} asChild>
            <Button tone="outline" size="$2" borderRadius={999} borderColor={coworkUi.glassBorder}>
              Co-Work home
            </Button>
          </AppLink>
        </XStack>
        <Text fontSize={13} color={coworkUi.textSecondary} lineHeight={18}>
          {collaborationChatSurfaceDescription(COWORK_MAIN_CHAT_SURFACE)}
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          <CoWorkStatusPill label="Main Chat · Persistent" tone="brand" />
          <CoWorkStatusPill
            label={`${collaborationChatSurfaceLabel(MEETING_CHAT_SURFACE)} · In-meeting only`}
            tone="warning"
          />
        </XStack>
      </YStack>

      <XStack flex={1} minHeight={0} width="100%">
        {showList ? (
          <YStack
            width={isDesktop ? LIST_PANE_WIDTH : '100%'}
            borderRightWidth={isDesktop ? 1 : 0}
            borderRightColor={coworkUi.borderSoft}
            minHeight={0}
            flex={isDesktop ? undefined : 1}
          >
            <ChatListPane
              chats={chats}
              isLoading={isLoading}
              activeChatId={chatId}
              currentUserId={currentUserId}
              onSelect={openChat}
              onNewChat={() => setNewChatOpen(true)}
              onChanged={() => void reload()}
              tabClearance={mobileTabBarOffset}
            />
          </YStack>
        ) : null}

        {showThread ? (
          <YStack flex={1} minHeight={0}>
            {activeChat ? (
              <ChatThreadPane
                chat={activeChat}
                currentUserId={currentUserId}
                onBack={clearChat}
                onConversationChanged={() => void reload()}
              />
            ) : isDesktop ? (
              <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$6">
                <Icons.MessageSquare size={36} color={coworkUi.brandLight} />
                <Text fontSize={18} fontWeight="800" color={coworkUi.text} textAlign="center">
                  Select a Co-Work conversation
                </Text>
                <Text color={coworkUi.textMuted} textAlign="center" maxWidth={360}>
                  Start a persistent thread for collaboration. Live meeting messages stay in Meeting
                  Chat inside the room.
                </Text>
                <Button tone="primary" borderRadius={999} onPress={() => setNewChatOpen(true)}>
                  New Co-Work chat
                </Button>
              </YStack>
            ) : (
              <YStack flex={1} alignItems="center" justifyContent="center" padding="$6">
                <ListSkeleton rows={4} />
              </YStack>
            )}
          </YStack>
        ) : null}
      </XStack>

      <NewCoworkChatSheet
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        currentUserId={currentUserId}
        onConversationReady={(id) => {
          void reload()
          navigateApp(coWorkRoutes.chatThread(id))
        }}
      />
    </YStack>
  )
}
