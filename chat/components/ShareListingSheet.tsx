import { useEffect, useMemo, useState } from 'react'

import { useUserChats } from '~/chat/hooks/useUserChats'
import { useChatTheme } from '~/chat/lib/chat-theme'
import { sendListingMessage } from '~/chat/lib/chats'
import type { ChatListingPayload, ChatSummary } from '~/chat/lib/types'
import { trackCommunityPostShareListingToChat } from '~/community/lib/community-commerce-analytics'
import type { CommunityCommerceSource } from '~/community/lib/community-commerce-analytics'
import { ScreenSearchField } from '~/components/search'
import {
  AppBottomSheet,
  Avatar,
  Icons,
  ScrollView,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { feedback } from '~/lib/platform/feedback'
import { navigateApp } from '~/lib/platform/navigate'
import { chatRoutes } from '~/lib/routes'
import { SHEET_SEARCH_MIN_ITEMS, filterBySearchQuery } from '~/lib/search'

type ShareListingSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string | null
  listing: ChatListingPayload | null
  postId?: string | null
  source?: CommunityCommerceSource
}

/** Pick a chat and send a compact listing card message. */
export function ShareListingSheet({
  open,
  onOpenChange,
  currentUserId,
  listing,
  postId,
  source = 'feed',
}: ShareListingSheetProps) {
  const theme = useChatTheme()
  const toast = useAppToast()
  const { chats, isLoading } = useUserChats(open && currentUserId ? currentUserId : null)
  const [query, setQuery] = useState('')
  const [sendingTo, setSendingTo] = useState<string | null>(null)
  const filteredChats = useMemo(
    () => filterBySearchQuery(chats, query, (chat) => [chat.name]),
    [chats, query],
  )

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const showSearch = chats.length >= SHEET_SEARCH_MIN_ITEMS || query.length > 0

  async function handlePick(chat: ChatSummary) {
    if (!currentUserId || !listing || sendingTo) return
    setSendingTo(chat.id)
    try {
      const { messageId, error } = await sendListingMessage(chat.id, currentUserId, listing)
      if (error || !messageId) {
        toast.show('Could not share product', { tone: 'danger', message: error ?? undefined })
        return
      }
      trackCommunityPostShareListingToChat({
        postId,
        listingId: listing.listingId,
        source,
        conversationId: chat.id,
      })
      void feedback('success')
      onOpenChange(false)
      toast.show(`Shared with ${chat.name}`, { tone: 'success' })
      navigateApp(chatRoutes.conversation(chat.id))
    } finally {
      setSendingTo(null)
    }
  }

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title="Share to chat" scrollable={false}>
      {showSearch ? (
        <ScreenSearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search chats"
          clearable
        />
      ) : null}
      {!currentUserId ? (
        <YStack paddingVertical={24} alignItems="center" gap={6}>
          <Icons.MessageCircle size={26} color={theme.textMuted} />
          <Text fontSize={14} color={theme.textMuted}>
            Sign in to share products in chat.
          </Text>
        </YStack>
      ) : isLoading ? (
        <YStack paddingVertical={24} alignItems="center">
          <Spinner size="small" color={theme.brand} />
        </YStack>
      ) : chats.length === 0 ? (
        <YStack paddingVertical={24} alignItems="center" gap={6}>
          <Icons.MessageCircle size={26} color={theme.textMuted} />
          <Text fontSize={14} color={theme.textMuted}>
            Start a chat to share this product.
          </Text>
        </YStack>
      ) : filteredChats.length === 0 ? (
        <YStack paddingVertical={24} alignItems="center" gap={6}>
          <Icons.Search size={26} color={theme.textMuted} />
          <Text fontSize={14} color={theme.textMuted}>
            No chats match your search.
          </Text>
        </YStack>
      ) : (
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          {filteredChats.map((chat) => (
            <XStack
              key={chat.id}
              onPress={() => void handlePick(chat)}
              cursor={sendingTo ? 'default' : 'pointer'}
              opacity={sendingTo && sendingTo !== chat.id ? 0.5 : 1}
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
              {sendingTo === chat.id ? (
                <Spinner size="small" color={theme.brand} />
              ) : (
                <Icons.Send size={17} color={theme.brand} />
              )}
            </XStack>
          ))}
        </ScrollView>
      )}
    </AppBottomSheet>
  )
}
