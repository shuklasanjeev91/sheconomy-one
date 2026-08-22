import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useReportForYouContent } from '~/community/components/ForYouSlot'
import { useProfileCompletionRevisit } from '~/community/hooks/useProfileCompletionRevisit'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Button, Text, XStack, YStack } from '~/components/ui'

export function ProfileCompletionRevisitStrip() {
  const communityUi = useCommunityUi()
  const { card, hasCard } = useProfileCompletionRevisit()

  const hasContent = Boolean(hasCard && card)
  useReportForYouContent(hasContent)
  if (!hasContent) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <YStack gap={10}>
        <XStack alignItems="center" justifyContent="space-between" gap={8}>
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={16} fontWeight="700" color={communityUi.text}>
              {card.headline}
            </Text>
            <Text fontSize={13} color={communityUi.textMuted}>
              {card.detail}
            </Text>
          </YStack>
          <Text fontSize={18} fontWeight="800" color={communityUi.brand}>
            {card.percent}%
          </Text>
        </XStack>
        <YStack height={6} borderRadius={999} backgroundColor={communityUi.surfaceMuted} overflow="hidden">
          <YStack
            height="100%"
            width={`${Math.min(100, Math.max(0, card.percent))}%`}
            backgroundColor={communityUi.brand}
            borderRadius={999}
          />
        </YStack>
        <AppLink href={card.href} asChild>
          <Button tone="primary" size="$2.5" borderRadius={999} alignSelf="flex-start">
            Complete profile
          </Button>
        </AppLink>
      </YStack>
    </CommunityCard>
  )
}
