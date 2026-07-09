import { Icons, Text, XStack } from '~/components/ui'
import { useCommunityUi } from '~/community/lib/community-theme'
import { CommunityCard } from '~/community/components/CommunityCard'

export type FeedSort = 'top' | 'recent'

type FeedSortBarProps = {
  value: FeedSort
  onChange: (sort: FeedSort) => void
}

export function FeedSortBar({ value, onChange }: FeedSortBarProps) {
  const communityUi = useCommunityUi()
  return (
    <CommunityCard padding={12}>
      <XStack alignItems="center" justifyContent="space-between">
        <Text fontSize={14} fontWeight="600" color={communityUi.text}>
          Sort by:
        </Text>
        <XStack
          gap={4}
          alignItems="center"
          paddingHorizontal={12}
          paddingVertical={6}
          borderRadius={999}
          borderWidth={1}
          borderColor={communityUi.border}
          cursor="pointer"
          hoverStyle={{ backgroundColor: communityUi.divider }}
          onPress={() => onChange(value === 'top' ? 'recent' : 'top')}
        >
          <Text fontSize={14} fontWeight="600" color={communityUi.textMuted}>
            {value === 'top' ? 'Top' : 'Recent'}
          </Text>
          <Icons.ChevronDown size={16} color={communityUi.textMuted} />
        </XStack>
      </XStack>
    </CommunityCard>
  )
}