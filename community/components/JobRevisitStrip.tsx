import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useReportForYouContent } from '~/community/components/ForYouSlot'
import { useJobRevisit } from '~/community/hooks/useJobRevisit'
import type { JobRevisitCard } from '~/community/lib/job-revisit'
import { useCommunityUi } from '~/community/lib/community-theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'

export function JobRevisitStrip() {
  const communityUi = useCommunityUi()
  const { cards, hasCards } = useJobRevisit()

  const hasContent = hasCards
  useReportForYouContent(hasContent)
  if (!hasContent) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            Saved jobs
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Roles you bookmarked and may still want to apply for.
          </Text>
        </YStack>
        <AppLink href={communityRoutes.jobs} asChild>
          <Button tone="ghost" size="$2" borderRadius={999}>
            View all
          </Button>
        </AppLink>
      </XStack>

      <HorizontalScrollRow gap={10}>
        {cards.map((card) => (
          <JobRevisitCardItem key={card.jobId} card={card} />
        ))}
      </HorizontalScrollRow>
    </CommunityCard>
  )
}

function JobRevisitCardItem({ card }: { card: JobRevisitCard }) {
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
          height={72}
          borderRadius={10}
          backgroundColor={communityUi.surfaceMuted}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.Briefcase size={22} color={communityUi.textMuted} />
        </YStack>
        <YStack gap={6}>
          <XStack
            alignSelf="flex-start"
            paddingHorizontal={8}
            paddingVertical={4}
            borderRadius={999}
            backgroundColor={`${communityUi.brand}14`}
          >
            <Text fontSize={10} fontWeight="700" color={communityUi.brand}>
              {card.badge}
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
      </YStack>
    </AppLink>
  )
}
