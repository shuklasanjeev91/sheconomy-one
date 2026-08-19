import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useJobApplicationsRevisit } from '~/community/hooks/useJobApplicationsRevisit'
import type { JobApplicationRevisitCard } from '~/community/lib/job-applications-revisit'
import { useCommunityUi } from '~/community/lib/community-theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'

export function JobApplicationsRevisitStrip() {
  const communityUi = useCommunityUi()
  const { cards, hasCards } = useJobApplicationsRevisit()

  if (!hasCards) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            Your applications
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Track roles you applied for and revisit the listing while it is still open.
          </Text>
        </YStack>
        <AppLink href={communityRoutes.jobs} asChild>
          <Button tone="ghost" size="$2" borderRadius={999}>
            View jobs
          </Button>
        </AppLink>
      </XStack>

      <HorizontalScrollRow gap={10}>
        {cards.map((card) => (
          <JobApplicationCardItem key={card.applicationId} card={card} />
        ))}
      </HorizontalScrollRow>
    </CommunityCard>
  )
}

function JobApplicationCardItem({ card }: { card: JobApplicationRevisitCard }) {
  const communityUi = useCommunityUi()

  return (
    <AppLink href={card.href} asChild>
      <YStack
        width={196}
        padding={12}
        gap={8}
        borderRadius={14}
        borderWidth={1}
        borderColor={communityUi.border}
        backgroundColor={communityUi.pageBg}
      >
        <XStack gap={6} alignItems="center">
          <Icons.Briefcase size={14} color={communityUi.brand} />
          <Text fontSize={11} fontWeight="700" color={communityUi.brand}>
            {card.statusLabel}
          </Text>
        </XStack>
        <Text fontSize={14} fontWeight="700" color={communityUi.text} numberOfLines={2}>
          {card.title}
        </Text>
        {card.subtitle ? (
          <Text fontSize={12} color={communityUi.textMuted} numberOfLines={2}>
            {card.subtitle}
          </Text>
        ) : null}
      </YStack>
    </AppLink>
  )
}
