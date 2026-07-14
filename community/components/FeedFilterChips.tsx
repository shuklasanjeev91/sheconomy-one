import type { FeedContentFilter } from '~/community/lib/community'
import { useCommunityUi } from '~/community/lib/community-theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Text, XStack } from '~/components/ui'

type FeedFilterChipsProps = {
  value: FeedContentFilter | null
  onChange: (value: FeedContentFilter | null) => void
}

const FILTERS: Array<{ id: FeedContentFilter | null; label: string }> = [
  { id: null, label: 'All' },
  { id: 'text', label: 'Updates' },
  { id: 'photos', label: 'Photos' },
  { id: 'polls', label: 'Polls' },
  { id: 'events', label: 'Events' },
]

/** Content-type filters for the community feed — same UI on web and native. */
export function FeedFilterChips({ value, onChange }: FeedFilterChipsProps) {
  const communityUi = useCommunityUi()

  return (
    <HorizontalScrollRow gap={8}>
      {FILTERS.map((filter) => {
        const active = value === filter.id
        return (
          <XStack
            key={filter.label}
            paddingHorizontal={14}
            paddingVertical={8}
            borderRadius={999}
            borderWidth={1}
            borderColor={active ? communityUi.brand : communityUi.border}
            backgroundColor={active ? communityUi.accentMuted : communityUi.cardBg}
            cursor="pointer"
            hoverStyle={{ backgroundColor: communityUi.hoverBg }}
            pressStyle={{ opacity: 0.88 }}
            onPress={() => onChange(filter.id)}
          >
            <Text
              fontSize={13}
              fontWeight="700"
              color={active ? communityUi.brand : communityUi.textMuted}
            >
              {filter.label}
            </Text>
          </XStack>
        )
      })}
    </HorizontalScrollRow>
  )
}
