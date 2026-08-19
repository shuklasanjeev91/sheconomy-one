import { AppLink } from '~/components/navigation/AppLink'

import { CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { useRecentMeetingRevisit } from '~/co-work/hooks/useRecentMeetingRevisit'
import type { RecentMeetingRevisitCard } from '~/co-work/lib/recent-meeting-revisit'
import { recentMeetingsSeeAllHref } from '~/co-work/lib/recent-meeting-revisit'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { coworkBoxShadow } from '~/lib/platform/crossStyles'

export function RecentMeetingRevisitStrip() {
  const { ui: coworkUi, shadows: coworkShadows } = useCoWorkTheme()
  const { cards, hasCards } = useRecentMeetingRevisit()

  if (!hasCards) return null

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={coworkUi.radius.card}
      borderWidth={1}
      borderColor={coworkUi.glassBorder}
      style={{
        ...coworkGlassStyle(coworkUi, true),
        ...coworkBoxShadow(coworkShadows, 'card'),
      }}
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontWeight="800" fontSize={17} color={coworkUi.text}>
            Rejoin recent rooms
          </Text>
          <Text fontSize={13} color={coworkUi.textSecondary}>
            Meetings you joined recently — jump back in with one tap.
          </Text>
        </YStack>
        <AppLink href={recentMeetingsSeeAllHref()} asChild>
          <Button tone="ghost" size="$2" borderRadius={999}>
            All meetings
          </Button>
        </AppLink>
      </XStack>

      <HorizontalScrollRow gap={10}>
        {cards.map((card) => (
          <RecentMeetingRevisitCardItem key={card.code} card={card} />
        ))}
      </HorizontalScrollRow>
    </YStack>
  )
}

function RecentMeetingRevisitCardItem({ card }: { card: RecentMeetingRevisitCard }) {
  const { ui: coworkUi } = useCoWorkTheme()

  return (
    <AppLink href={card.href} asChild>
      <YStack
        width={196}
        padding={14}
        gap={10}
        borderRadius={16}
        borderWidth={1}
        borderColor={coworkUi.borderSoft}
        backgroundColor={coworkUi.surfaceMuted}
        cursor="pointer"
        hoverStyle={{ borderColor: coworkUi.brand, opacity: 0.96 }}
        pressStyle={{ opacity: 0.9, scale: 0.98 }}
      >
        <XStack alignItems="center" justifyContent="space-between" gap={8}>
          <CoWorkStatusPill label={card.badge} />
          <Icons.Video size={16} color={coworkUi.brandLight} />
        </XStack>
        <YStack gap={4}>
          <Text fontSize={14} fontWeight="800" color={coworkUi.text} numberOfLines={2}>
            {card.title}
          </Text>
          <Text fontSize={12} fontWeight="700" color={coworkUi.textSecondary} letterSpacing={1}>
            {card.codeLabel}
          </Text>
        </YStack>
      </YStack>
    </AppLink>
  )
}
