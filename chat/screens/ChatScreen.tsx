import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { Link, useRouter } from 'one'

import { ChatListPane } from '~/chat/components/ChatListPane'
import { ChatThreadPane } from '~/chat/components/ChatThreadPane'
import { NewChatSheet } from '~/chat/components/NewChatSheet'
import { usePresence } from '~/chat/hooks/usePresence'
import { useUserChats } from '~/chat/hooks/useUserChats'
import type { ChatSummary } from '~/chat/lib/types'
import { useChatTheme } from '~/chat/lib/chat-theme'
import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { chatRoutes, routes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'

const LIST_PANE_WIDTH = 380

type ChatScreenProps = {
  chatId?: string | null
}

export function ChatScreen({ chatId = null }: ChatScreenProps) {
  const theme = useChatTheme()
  const router = useRouter()
  const { isDesktop, isDesktopWeb, desktopHeaderHeight, mobileTabBarOffset } = useAppLayout()
  const { user, isLoading: authLoading } = useSupabase()
  const currentUserId = user?.id ?? null

  usePresence(currentUserId)

  const { chats, isLoading, reload } = useUserChats(currentUserId)
  const [newChatOpen, setNewChatOpen] = useState(false)
  const reloadedFor = useRef<string | null>(null)

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

  const fillStyle =
    Platform.OS === 'web'
      ? isDesktopWeb
        ? ({ height: `calc(100dvh - ${desktopHeaderHeight}px)` } as const)
        : ({ flex: 1, minHeight: 0 } as const)
      : undefined

  // ---- Auth states ---------------------------------------------------------
  if (authLoading) {
    return (
      <YStack flex={1} minHeight={0} backgroundColor={theme.pageBg} alignItems="center" justifyContent="center" style={fillStyle}>
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
          <Icons.MessageCircle size={34} color={theme.brandContrast} />
        </YStack>
        <Text fontSize={20} fontWeight="800" color={theme.text} textAlign="center">
          Your messages
        </Text>
        <Text fontSize={14} color={theme.textMuted} textAlign="center" lineHeight={20} maxWidth={340}>
          Sign in to chat with your network in real time — send messages, share photos, and see when
          contacts are online.
        </Text>
        <Link href={routes.signIn} asChild>
          <Button tone="primary">Sign in to continue</Button>
        </Link>
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
          <ChatListPane
            chats={chats}
            isLoading={isLoading}
            activeChatId={chatId}
            currentUserId={currentUserId}
            onSelect={(chat) => router.push(chatRoutes.conversation(chat.id))}
            onNewChat={() => setNewChatOpen(true)}
            onChanged={reload}
          />
        </YStack>

        <YStack flex={1} minWidth={0} minHeight={0}>
          {activeChat ? (
            <ChatThreadPane
              chat={activeChat}
              currentUserId={currentUserId}
              showBack={false}
              onBack={() => router.push(chatRoutes.home)}
              onConversationChanged={reload}
            />
          ) : (
            <EmptyThreadPlaceholder loading={!!chatId && isLoading} />
          )}
        </YStack>

        <NewChatSheet
          open={newChatOpen}
          onOpenChange={setNewChatOpen}
          currentUserId={currentUserId}
          onConversationReady={(id) => router.push(chatRoutes.conversation(id))}
        />
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
          showBack
          onBack={() => router.push(chatRoutes.home)}
          onConversationChanged={reload}
        />
      ) : chatId && isLoading ? (
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Spinner size="large" color={theme.brand} />
        </YStack>
      ) : (
        <ChatListPane
          chats={chats}
          isLoading={isLoading}
          activeChatId={null}
          currentUserId={currentUserId}
          onSelect={(chat) => router.push(chatRoutes.conversation(chat.id))}
          onNewChat={() => setNewChatOpen(true)}
          onChanged={reload}
          tabClearance={mobileTabBarOffset}
        />
      )}

      <NewChatSheet
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        currentUserId={currentUserId}
        onConversationReady={(id) => router.push(chatRoutes.conversation(id))}
      />
    </YStack>
  )
}

function EmptyThreadPlaceholder({ loading }: { loading: boolean }) {
  const theme = useChatTheme()

  if (loading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor={theme.threadBg}>
        <Spinner size="large" color={theme.brand} />
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
