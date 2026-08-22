import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useReportForYouContent } from '~/community/components/ForYouSlot'
import { useComposeDraftRevisit } from '~/community/hooks/useComposeDraftRevisit'
import { composeDraftRevisitHref } from '~/community/lib/compose-draft-revisit'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'

export function ComposeDraftRevisitStrip() {
  const communityUi = useCommunityUi()
  const { card, hasCard } = useComposeDraftRevisit()

  const hasContent = Boolean(hasCard && card)
  useReportForYouContent(hasContent)
  if (!hasContent) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack gap={12} alignItems="flex-start">
        <YStack
          width={40}
          height={40}
          borderRadius={10}
          backgroundColor={communityUi.surfaceMuted}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.PenLine size={18} color={communityUi.brand} />
        </YStack>
        <YStack flex={1} minWidth={0} gap={8}>
          <YStack gap={2}>
            <Text fontSize={16} fontWeight="700" color={communityUi.text}>
              {card.headline}
            </Text>
            <Text fontSize={13} color={communityUi.textMuted}>
              {card.detail}
            </Text>
          </YStack>
          <Text fontSize={14} color={communityUi.text} numberOfLines={3}>
            {card.preview}
          </Text>
          <AppLink href={composeDraftRevisitHref()} asChild>
            <Button tone="primary" size="$2.5" alignSelf="flex-start" borderRadius={999}>
              Continue writing
            </Button>
          </AppLink>
        </YStack>
      </XStack>
    </CommunityCard>
  )
}
