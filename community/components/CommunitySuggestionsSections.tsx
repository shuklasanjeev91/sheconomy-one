import { CommunitySuggestionSectionCard } from '~/community/components/CommunitySuggestionSectionCard'
import { CommunityWidget } from '~/community/components/CommunityWidget'
import { useCommunitySuggestions } from '~/community/hooks/useCommunitySuggestions'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Spinner, Text, XStack, YStack } from '~/components/ui'
import { Link } from 'one'
import { communityRoutes } from '~/lib/routes'

type CommunitySuggestionsSectionsProps = {
  perKindLimit?: number
  itemLimit?: number
}

export function CommunitySuggestionsSections({
  perKindLimit = 4,
  itemLimit = 4,
}: CommunitySuggestionsSectionsProps) {
  const communityUi = useCommunityUi()
  const { sections, isLoading } = useCommunitySuggestions(perKindLimit)

  if (isLoading) {
    return (
      <CommunityWidget title="Suggestions">
        <XStack paddingVertical={16} justifyContent="center">
          <Spinner size="small" color={communityUi.brand} />
        </XStack>
      </CommunityWidget>
    )
  }

  if (!sections.length) {
    return (
      <CommunityWidget title="Suggestions">
        <YStack gap={8}>
          <Text fontSize={14} color={communityUi.textMuted} lineHeight={20}>
            Explore your network, shops, groups, and more tailored to your interests and location.
          </Text>
          <Link href={communityRoutes.network}>
            <Text fontSize={14} fontWeight="600" color={communityUi.brand}>
              Explore network
            </Text>
          </Link>
        </YStack>
      </CommunityWidget>
    )
  }

  return (
    <YStack gap="$2">
      {sections.map((section) => (
        <CommunitySuggestionSectionCard
          key={section.kind}
          section={section}
          limit={itemLimit}
        />
      ))}
    </YStack>
  )
}