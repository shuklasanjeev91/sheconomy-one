import { Spinner, Text, YStack } from '~/components/ui'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

import { CommerceSection } from './CommerceSection'
import { ListingCarouselRow } from './ListingCarouselRow'
import { useListingRecommendations } from '~/commerce/hooks/useListingRecommendations'

type ListingRecommendationsSectionsProps = {
  listingId: string
  enabled?: boolean
  limit?: number
}

export function ListingRecommendationsSections({
  listingId,
  enabled = true,
  limit = 12,
}: ListingRecommendationsSectionsProps) {
  const ui = useAppUi()
  const { related, personalized, isLoading, error } = useListingRecommendations(listingId, {
    enabled,
    limit,
  })

  if (isLoading) {
    return (
      <YStack width="100%" alignItems="center" paddingVertical="$6">
        <Spinner size="small" />
      </YStack>
    )
  }

  if (!related.length && !personalized.length) {
    return error ? (
      <Text color={ui.textSecondary} fontSize={13}>
        {error}
      </Text>
    ) : null
  }

  return (
    <YStack gap="$8" width="100%">
      {related.length > 0 ? (
        <CommerceSection title="You may also like" subtitle="Similar items in this category">
          <ListingCarouselRow listings={related} />
        </CommerceSection>
      ) : null}

      {personalized.length > 0 ? (
        <CommerceSection
          title="Recommended for you"
          subtitle="Picked from your activity, favorites, and trends"
          actionLabel="See more"
          actionHref={commerceRoutes.browse('featured')}
        >
          <ListingCarouselRow listings={personalized} />
        </CommerceSection>
      ) : null}
    </YStack>
  )
}
