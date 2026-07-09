import { Link } from 'one'

import { CommunitySuggestionRow } from '~/community/components/CommunitySuggestionRow'
import { CommunityWidget } from '~/community/components/CommunityWidget'
import type { SuggestionSection } from '~/community/hooks/useCommunitySuggestions'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Text, YStack } from '~/components/ui'

type CommunitySuggestionSectionCardProps = {
  section: SuggestionSection
  limit?: number
}

export function CommunitySuggestionSectionCard({
  section,
  limit = 3,
}: CommunitySuggestionSectionCardProps) {
  const communityUi = useCommunityUi()
  const items = section.items.slice(0, limit)

  if (!items.length) return null

  return (
    <CommunityWidget
      title={section.title}
      footer={
        <Link href={section.seeAllHref as never}>
          <Text fontSize={14} fontWeight="600" color={communityUi.brand}>
            See all
          </Text>
        </Link>
      }
    >
      <YStack gap={0}>
        {items.map((item) => (
          <CommunitySuggestionRow key={`${item.kind}-${item.id}`} item={item} showKindLabel={false} />
        ))}
      </YStack>
    </CommunityWidget>
  )
}