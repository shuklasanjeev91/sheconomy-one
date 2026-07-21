import { ShopSpotlightCard } from '~/commerce/components/ShopSpotlightCard'
import { useFollowedShopsList } from '~/commerce/components/FollowedShopsRail'
import type { ShopSummary } from '~/commerce/lib/commerce'
import type { Shop } from '~/lib/shop/shop.type'
import { Spinner, Text, YStack } from '~/components/ui'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { AppLink } from '~/components/navigation/AppLink'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

function toShopSummary(shop: Shop): ShopSummary {
  return {
    id: shop.id,
    shop_name: shop.shop_name,
    slug: shop.slug,
    logo_url: shop.logo_url,
    verified: shop.verified,
    rating: shop.rating,
    review_count: shop.review_count,
    shop_categories: shop.shop_categories,
    is_active: shop.is_active,
  } as ShopSummary
}

export function FollowedShopsScreen() {
  const ui = useAppUi()
  const { shops, isLoading, user } = useFollowedShopsList()

  if (!user) {
    return (
      <FullWidthLayout>
        <PageSection title="Shops you follow">
          <Text color={ui.textSecondary}>Sign in to see shops you follow.</Text>
          <AppLink href={commerceRoutes.shops}>
            <Text color={ui.brand} marginTop="$3">
              Browse shops
            </Text>
          </AppLink>
        </PageSection>
      </FullWidthLayout>
    )
  }

  return (
    <FullWidthLayout>
      <PageSection
        title="Shops you follow"
        description="New listings from these shops show up in your notifications."
      >
        {isLoading ? (
          <Spinner />
        ) : !shops.length ? (
          <YStack gap="$3">
            <Text color={ui.textSecondary}>You are not following any shops yet.</Text>
            <AppLink href={commerceRoutes.shops}>
              <Text color={ui.brand} fontWeight="600">
                Discover shops
              </Text>
            </AppLink>
          </YStack>
        ) : (
          <YStack gap="$3" flexDirection="row" flexWrap="wrap">
            {shops.map((shop) => (
              <ShopSpotlightCard key={shop.id} shop={toShopSummary(shop)} />
            ))}
          </YStack>
        )}
      </PageSection>
    </FullWidthLayout>
  )
}
