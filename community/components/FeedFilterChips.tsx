import type { FeedContentFilter } from '~/community/lib/community'
import { trackCommunityCommerceShare } from '~/community/lib/community-commerce-analytics'
import { useCommunityUi } from '~/community/lib/community-theme'
import { ShareButton } from '~/components/share/ShareButton'
import { BRAND_NAME } from '~/config/brand'
import { getShoppableFeedShareUrl } from '~/lib/share/urls'
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
  { id: 'articles', label: 'Articles' },
  { id: 'events', label: 'Events' },
  { id: 'celebrations', label: 'Celebrations' },
  { id: 'polls', label: 'Polls' },
  { id: 'shoppable', label: 'Shoppable' },
]

/** Content-type filters for the community feed — same UI on web and native. */
export function FeedFilterChips({ value, onChange }: FeedFilterChipsProps) {
  const communityUi = useCommunityUi()

  return (
    <XStack alignItems="center" gap={8}>
      <HorizontalScrollRow gap={8} flex={1}>
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
      {value === 'shoppable' ? (
        <ShareButton
          variant="icon"
          size="$2"
          label="Share shoppable feed"
          sheetTitle="Share shoppable feed"
          copyLabel="Copy shoppable feed link"
          copyToastMessage="Shoppable feed link copied."
          onOpen={() => trackCommunityCommerceShare({ surface: 'shoppable_feed' })}
          payload={{
            url: getShoppableFeedShareUrl(),
            title: `Shoppable posts on ${BRAND_NAME}`,
            text: 'Browse community posts with products attached.',
          }}
        />
      ) : null}
    </XStack>
  )
}
