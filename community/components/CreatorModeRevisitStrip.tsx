import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useCreatorModeRevisit } from '~/community/hooks/useCreatorModeRevisit'
import { creatorModeComposeHref } from '~/community/lib/creator-mode-revisit'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Button, Text, XStack, YStack } from '~/components/ui'

export function CreatorModeRevisitStrip() {
  const communityUi = useCommunityUi()
  const { card, hasCard } = useCreatorModeRevisit()

  if (!hasCard || !card) return null

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
              Enable creator mode
            </Button>
          </AppLink>
          <AppLink href={creatorModeComposeHref()} asChild>
            <Button tone="outline" size="$2.5" borderRadius={999}>
              Start a post
            </Button>
          </AppLink>
        </XStack>
      </YStack>
    </CommunityCard>
  )
}
