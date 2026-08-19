import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useUnreadChatRevisit } from '~/community/hooks/useUnreadChatRevisit'
import type { UnreadChatRevisitCard } from '~/chat/lib/unread-chats-revisit'
import { useCommunityUi } from '~/community/lib/community-theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Avatar, Button, Text, XStack, YStack } from '~/components/ui'
import { chatRoutes } from '~/lib/routes'

export function UnreadChatRevisitStrip() {
  const communityUi = useCommunityUi()
  const { cards, hasCards } = useUnreadChatRevisit()

  if (!hasCards) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            Unread messages
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Conversations waiting for your reply.
          </Text>
        </YStack>
        <AppLink href={chatRoutes.home} asChild>
          <Button tone="ghost" size="$2" borderRadius={999}>
            Open chat
          </Button>
        </AppLink>
      </XStack>

      <HorizontalScrollRow gap={10}>
        {cards.map((card) => (
          <UnreadChatRevisitCardItem key={card.chatId} card={card} />
        ))}
      </HorizontalScrollRow>
    </CommunityCard>
  )
}

function UnreadChatRevisitCardItem({ card }: { card: UnreadChatRevisitCard }) {
  const communityUi = useCommunityUi()

  return (
    <AppLink href={card.href} asChild>
      <YStack
        width={196}
        padding={12}
        gap={10}
        borderRadius={14}
        borderWidth={1}
        borderColor={communityUi.border}
        backgroundColor={communityUi.pageBg}
        cursor="pointer"
        hoverStyle={{ borderColor: communityUi.brand, opacity: 0.96 }}
        pressStyle={{ opacity: 0.9, scale: 0.98 }}
      >
        <XStack alignItems="center" gap={10}>
          <Avatar name={card.title} src={card.avatarUrl} size={44} />
          <YStack flex={1} minWidth={0} gap={4}>
            <XStack
              alignSelf="flex-start"
              paddingHorizontal={8}
              paddingVertical={4}
              borderRadius={999}
              backgroundColor={`${communityUi.brand}14`}
            >
              <Text fontSize={10} fontWeight="700" color={communityUi.brand}>
                {card.unreadCount > 99 ? '99+ new' : `${card.unreadCount} new`}
              </Text>
            </XStack>
            <Text fontSize={14} fontWeight="700" color={communityUi.text} numberOfLines={1}>
              {card.title}
            </Text>
          </YStack>
        </XStack>
        <Text fontSize={12} color={communityUi.textMuted} numberOfLines={2}>
          {card.preview}
        </Text>
      </YStack>
    </AppLink>
  )
}
