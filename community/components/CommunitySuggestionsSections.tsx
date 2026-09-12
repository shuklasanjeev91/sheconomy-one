import { CommunitySuggestionSectionCard } from '~/community/components/CommunitySuggestionSectionCard'
import { AppLink } from '~/components/navigation/AppLink'
import { CommunityWidget } from '~/community/components/CommunityWidget'
import { useCommunitySuggestions } from '~/community/hooks/useCommunitySuggestions'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Spinner, Text, XStack, YStack } from '~/components/ui'

import { communityRoutes } from '~/lib/routes'

type CommunitySuggestionsSectionsProps = {
  perKindLimit?: number
  itemLimit?: number
  compactProducts?: boolean
}

export function CommunitySuggestionsSections({
  perKindLimit = 4,
  itemLimit = 4,
  compactProducts = false,
}: CommunitySuggestionsSectionsProps) {
  const communityUi = useCommunityUi()
  const { sections, isLoading } = useCommunitySuggestions(perKindLimit)

  // Keep the current cards mounted during background personalization refreshes.
  // Replacing a tall rail with this small placeholder collapses its scroll range
  // and causes the cross-platform jump seen after Follow/Add actions.
  if (isLoading && sections.length === 0) {
    return (
      <CommunityWidget title="Add to your feed">
        <XStack paddingVertical={16} justifyContent="center">
          <Spinner size="small" color={communityUi.brand} />
        </XStack>
      </CommunityWidget>
    )
  }

  if (!sections.length) {
    return (
      <CommunityWidget title="Add to your feed">
        <YStack gap={8}>
          <Text fontSize={14} color={communityUi.textMuted} lineHeight={20}>
            Follow people, groups, and pages to personalise your community feed.
          </Text>
          <AppLink href={communityRoutes.network}>
            <Text fontSize={14} fontWeight="600" color={communityUi.brand}>
              Explore network
            </Text>
          </AppLink>
        </YStack>
      </CommunityWidget>
    )
  }

  return (
    <YStack gap="$2">
      {sections.map((section) => (
        <CommunitySuggestionSectionCard
          key={`${section.kind}-${section.title}`}
          section={section}
          limit={itemLimit}
          compactProducts={compactProducts}
        />
      ))}
    </YStack>
  )
}
