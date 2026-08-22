import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useReportForYouContent } from '~/community/components/ForYouSlot'
import { useOpenToWorkRevisit } from '~/community/hooks/useOpenToWorkRevisit'
import { openToWorkJobsHref } from '~/community/lib/open-to-work-revisit'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Button, Text, XStack, YStack } from '~/components/ui'

export function OpenToWorkRevisitStrip() {
  const communityUi = useCommunityUi()
  const { card, hasCard } = useOpenToWorkRevisit()

  const hasContent = Boolean(hasCard && card)
  useReportForYouContent(hasContent)
  if (!hasContent) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <YStack gap={10}>
        <YStack gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            {card.headline}
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            {card.detail}
          </Text>
        </YStack>
        <XStack gap={8} flexWrap="wrap">
          <AppLink href={card.href} asChild>
            <Button tone="primary" size="$2.5" borderRadius={999}>
              Update profile
            </Button>
          </AppLink>
          <AppLink href={openToWorkJobsHref()} asChild>
            <Button tone="outline" size="$2.5" borderRadius={999}>
              Browse jobs
            </Button>
          </AppLink>
        </XStack>
      </YStack>
    </CommunityCard>
  )
}
