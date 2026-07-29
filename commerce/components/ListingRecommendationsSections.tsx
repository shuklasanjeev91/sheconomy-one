import { Text, YStack } from '~/components/ui'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { hasListingImages } from '~/lib/listing-images'

import { CommerceSection } from '~/commerce/components/CommerceSection'
import { ListingCarouselRow } from '~/commerce/components/ListingCarouselRow'
import { useListingRecommendations } from '~/commerce/hooks/useListingRecommendations'

type ListingRecommendationsSectionsProps = {
  listingId: string
  shopId?: string | null
  shopName?: string | null
  shopSlug?: string | null
  category?: string | null
  listingType?: string | null
  enabled?: boolean
  limit?: number
}

function withPhotos<T extends { image_url?: string | null; image_urls?: string[] | null }>(
  items: T[],
): T[] {
  return items.filter((item) => hasListingImages(item.image_urls, item.image_url))
}

export function ListingRecommendationsSections({
  listingId,
  shopId,
  shopName,
  shopSlug,
  category,
  listingType,
  enabled = true,
  limit,
}: ListingRecommendationsSectionsProps) {
  const ui = useAppUi()
  const { related, personalized, fromShop, error } = useListingRecommendations(
    listingId,
    { enabled, limit, shopId, category, listingType },
  )

  const relatedVisible = withPhotos(related)
  const personalizedVisible = withPhotos(personalized)
  const fromShopVisible = withPhotos(fromShop)
  const hasAny =
    fromShopVisible.length > 0 || relatedVisible.length > 0 || personalizedVisible.length > 0

  // Never block the PDP bottom with spinners — sections appear as data is ready.
  if (!hasAny) {
    return error ? (
      <Text color={ui.textSecondary} fontSize={13}>
        {error}
      </Text>
    ) : null
  }

  return (
    <YStack gap="$8" width="100%">
      {fromShopVisible.length > 0 ? (
        <CommerceSection
          title={shopName ? `More from ${shopName}` : 'More from this shop'}
          subtitle="Other finds from this seller"
          actionLabel={shopSlug ? 'Visit shop' : undefined}
          actionHref={shopSlug ? commerceRoutes.shop(shopSlug) : undefined}
        >
          <ListingCarouselRow listings={fromShopVisible} />
        </CommerceSection>
      ) : null}

      {relatedVisible.length > 0 ? (
        <CommerceSection title="You may also like" subtitle="Similar items in this category">
          <ListingCarouselRow listings={relatedVisible} />
        </CommerceSection>
      ) : null}

      {personalizedVisible.length > 0 ? (
        <CommerceSection
          title="Recommended for you"
          subtitle="Picked from your activity, favorites, and trends"
          actionLabel="See more"
          actionHref={commerceRoutes.browse('featured')}
        >
          <ListingCarouselRow listings={personalizedVisible} />
        </CommerceSection>
      ) : null}
    </YStack>
  )
}
