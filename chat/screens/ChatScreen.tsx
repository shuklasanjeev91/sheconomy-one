import { useEffect, useMemo, useRef } from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { ChatListPane } from '~/chat/components/ChatListPane'
import { ChatSectionTabs } from '~/chat/components/ChatSectionTabs'
import { ChatThreadPane } from '~/chat/components/ChatThreadPane'
import { openNewChat } from '~/chat/lib/chat-actions-store'
import { usePresence } from '~/chat/hooks/usePresence'
import { useUserChats } from '~/chat/hooks/useUserChats'
import type { ChatSummary } from '~/chat/lib/types'
import { useChatTheme } from '~/chat/lib/chat-theme'
import { Button, Icons, ListSkeleton, Text, XStack, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { chatRoutes, routes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'

const LIST_PANE_WIDTH = 380

type ChatScreenProps = {
  chatId?: string | null
  /** When 'groups', only group conversations are listed (WhatsApp-style view). */
  filter?: 'all' | 'groups'
}

export function ChatScreen({ chatId = null, filter = 'all' }: ChatScreenProps) {
  const theme = useChatTheme()
  const router = useRouter()
  const { isDesktop, mobileTabBarOffset } = useAppLayout()
  const { user, isLoading: authLoading } = useSupabase()
  const currentUserId = user?.id ?? null

  usePresence(currentUserId)

  const { chats, isLoading, reload } = useUserChats(currentUserId)
  const reloadedFor = useRef<string | null>(null)

  const visibleChats = useMemo<ChatSummary[]>(
    () => (filter === 'groups' ? chats.filter((c) => c.type === 'group') : chats),
    [chats, filter],
  )

  const activeChat = useMemo<ChatSummary | null>(
    () => (chatId ? chats.find((c) => c.id === chatId) ?? null : null),
    [chats, chatId],
  )

  // A freshly created conversation may not be in the cached list yet.
  useEffect(() => {
    if (!chatId || isLoading || activeChat) return
    if (reloadedFor.current === chatId) return
    reloadedFor.current = chatId
    void reload()
  }, [chatId, isLoading, activeChat, reload])

  // Reset reload marker when the signed-in user changes so a prior account's
  // conversation id can be re-checked against the new inbox.
  useEffect(() => {
    reloadedFor.current = null
  }, [currentUserId])

  // Fill the AppShell content column (flex parent). Avoid calc(100dvh - header):
  // that fights the profile nudge / footer and often collapses to a blank pane on web.
  const fillStyle =
    Platform.OS === 'web' ? ({ flex: 1, minHeight: 0, width: '100%' } as const) : undefined

  // ---- Auth states ---------------------------------------------------------
  if (authLoading && chats.length === 0) {
    return (
      <YStack flex={1} minHeight={0} backgroundColor={theme.pageBg} style={fillStyle}>
        <ListSkeleton rows={8} />
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
          <Icons.MessageCircle size={34} color={theme.brandContrast} />
        </YStack>
        <Text fontSize={20} fontWeight="800" color={theme.text} textAlign="center">
          Your messages
        </Text>
        <Text fontSize={14} color={theme.textMuted} textAlign="center" lineHeight={20} maxWidth={340}>
          Sign in to chat with your network in real time — send messages, share photos, and see when
          contacts are online.
        </Text>
        <AppLink href={routes.signIn} asChild>
          <Button tone="primary">Sign in to continue</Button>
        </AppLink>
      </YStack>
    )
  }

  // ---- Desktop: two-pane workspace ----------------------------------------
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
        >
          <ChatSectionTabs />
          <ChatListPane
            chats={visibleChats}
            isLoading={isLoading}
            activeChatId={chatId}
            currentUserId={currentUserId}
            onSelect={(chat) => router.push(chatRoutes.conversation(chat.id))}
            onNewChat={openNewChat}
            onChanged={reload}
          />
        </YStack>

        <YStack flex={1} minWidth={0} minHeight={0}>
          {activeChat ? (
            <ChatThreadPane
              chat={activeChat}
              currentUserId={currentUserId}
              onBack={() => router.push(chatRoutes.home)}
              onConversationChanged={reload}
            />
          ) : (
            <EmptyThreadPlaceholder loading={!!chatId && isLoading} />
          )}
        </YStack>
      </XStack>
    )
  }

  // ---- Mobile: single pane, route-driven ----------------------------------
  return (
    <YStack flex={1} minHeight={0} backgroundColor={theme.pageBg} style={fillStyle}>
      {activeChat ? (
        <ChatThreadPane
          chat={activeChat}
          currentUserId={currentUserId}
          onBack={() => router.push(chatRoutes.home)}
          onConversationChanged={reload}
        />
      ) : chatId && isLoading && visibleChats.length === 0 ? (
        <YStack flex={1} minHeight={0}>
          <ListSkeleton rows={8} />
        </YStack>
      ) : (
        <YStack flex={1} minHeight={0}>
          <ChatListPane
            chats={visibleChats}
            isLoading={isLoading}
            activeChatId={null}
            currentUserId={currentUserId}
            onSelect={(chat) => router.push(chatRoutes.conversation(chat.id))}
            onNewChat={openNewChat}
            onChanged={reload}
            tabClearance={mobileTabBarOffset}
          />
        </YStack>
      )}
    </YStack>
  )
}

function EmptyThreadPlaceholder({ loading }: { loading: boolean }) {
  const theme = useChatTheme()

  if (loading) {
    return (
      <YStack flex={1} backgroundColor={theme.threadBg}>
        <ListSkeleton rows={8} />
      </YStack>
    )
  }

  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap={14}
      paddingHorizontal={40}
      backgroundColor={theme.threadBg}
    >
      <YStack
        width={96}
        height={96}
        borderRadius={999}
        backgroundColor={theme.listBg}
        alignItems="center"
        justifyContent="center"
        shadowColor="#000"
        shadowOpacity={0.06}
        shadowRadius={12}
        shadowOffset={{ width: 0, height: 4 }}
      >
        <Icons.MessagesSquare size={44} color={theme.brand} />
      </YStack>
      <Text fontSize={20} fontWeight="800" color={theme.text} textAlign="center">
        Select a chat
      </Text>
      <Text fontSize={14} color={theme.textMuted} textAlign="center" lineHeight={20} maxWidth={360}>
        Choose a conversation from the list, or start a new one to send private, real-time messages
        across web, iOS, and Android.
      </Text>
    </YStack>
  )
}
