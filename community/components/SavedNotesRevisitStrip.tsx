import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useSavedNotesRevisit } from '~/community/hooks/useSavedNotesRevisit'
import type { SavedNotesRevisitCard } from '~/community/lib/saved-posts'
import { useCommunityUi } from '~/community/lib/community-theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'

export function SavedNotesRevisitStrip() {
  const communityUi = useCommunityUi()
  const { cards, hasCards } = useSavedNotesRevisit()

  if (!hasCards) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            Saved with notes
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Posts you bookmarked with a reminder or personal note.
          </Text>
        </YStack>
        <AppLink href={communityRoutes.saved} asChild>
          <Button tone="ghost" size="$2" borderRadius={999}>
            View saved
          </Button>
        </AppLink>
      </XStack>

      <HorizontalScrollRow gap={10}>
        {cards.map((card) => (
          <SavedNotesRevisitCardItem key={card.postId} card={card} />
        ))}
      </HorizontalScrollRow>
    </CommunityCard>
  )
}

function SavedNotesRevisitCardItem({ card }: { card: SavedNotesRevisitCard }) {
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
        <YStack
          width="100%"
          height={88}
          borderRadius={10}
          overflow="hidden"
          backgroundColor={communityUi.surfaceMuted}
          alignItems="center"
          justifyContent="center"
        >
          {card.imageUrl ? (
            <Image src={card.imageUrl} width="100%" height={88} objectFit="cover" />
          ) : (
            <Icons.StickyNote size={22} color={communityUi.textMuted} />
          )}
        </YStack>
        <YStack gap={6}>
          <Text fontSize={10} fontWeight="700" color={communityUi.brand}>
            {card.collectionName}
          </Text>
          <Text fontSize={14} fontWeight="700" color={communityUi.text} numberOfLines={2}>
            {card.title}
          </Text>
          <Text fontSize={12} color={communityUi.textMuted} numberOfLines={3}>
            “{card.note}”
          </Text>
        </YStack>
      </YStack>
    </AppLink>
  )
}
