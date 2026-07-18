import { Platform } from 'react-native'
import { AppLink } from '~/components/navigation/AppLink'

import {
  AvailableOffersCard,
  CategoryChip,
  CommerceSection,
  HomeHeroSlider,
  buildHomeHeroSlides,
  InfiniteHorizontalSection,
  InfiniteListingSection,
  RecentlyViewedRail,
  SaleEventBanner,
  ShopSpotlightCard,
} from '~/commerce/components'
import { FollowedShopsRail } from '~/commerce/components/FollowedShopsRail'
import {
  Button,
  Card,
  Icons,
  Paragraph,
  Spinner,
  Text,
  Theme,
  XStack,
  YStack,
} from '~/components/ui'
import { IdleMount } from '~/components/IdleMount'
import { FullWidthLayout, PageCenter, PageSection } from '~/components/layout'
import { NearbyShopsSection, NearYouLocationChip } from '~/components/location'
import { BRAND_THEME, radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useCategoriesFeed } from '~/commerce/hooks/useCategoriesFeed'
import { useShopsFeed } from '~/commerce/hooks/useShopsFeed'
import { type HomeBootstrapData } from '~/commerce/lib/commerce'
import { commerceRoutes, routes } from '~/lib/routes'
import { useAccess } from '~/hooks/useAccess'

import { BRAND_NAME } from '~/config/brand'

export { homeLoader } from '~/commerce/lib/home-loader'
export type { HomeBootstrapData }

type HomeScreenProps = {
  data: HomeBootstrapData | null
  error: string | null
  loading?: boolean
}

/**
 * Marketplace home — one UI for web, iOS, and Android.
 * Route files only differ on how loader data is fetched (SSR vs native).
 */
export function HomeScreen({ data, error, loading = false }: HomeScreenProps) {
  const ui = useAppUi()
  const { canManageShops } = useAccess()
  const categoriesFeed = useCategoriesFeed(!!data)
  const shopsFeed = useShopsFeed(!!data)
  const isLoading = loading || (!data && !error)

  if (isLoading) {
    return (
      <FullWidthLayout>
        <PageCenter>
          <Spinner size="large" />
          <Text color={ui.textMuted} marginTop="$3" fontSize={14}>
            Loading shops…
          </Text>
        </PageCenter>
      </FullWidthLayout>
    )
  }

  if (error || !data) {
    return (
      <FullWidthLayout>
        <PageSection paddingVertical="$10">
          <Card>
            <YStack gap="$3">
              <XStack gap="$2" alignItems="center">
                <Icons.AlertCircle size={20} color="$red10" />
                <Text fontWeight="500" fontSize={18} color={ui.text}>
                  Could not load shops
                </Text>
              </XStack>
              <Paragraph color={ui.textSecondary}>{error ?? 'Please try again shortly.'}</Paragraph>
              <AppLink href={routes.home} asChild>
                <Button tone="primary" size="$4" alignSelf="flex-start" borderRadius={999}>
                  Browse shops
                </Button>
              </AppLink>
            </YStack>
          </Card>
        </PageSection>
      </FullWidthLayout>
    )
  }

  const { stats, heroImages } = data
  const heroSlides = buildHomeHeroSlides(stats, {
    includeSellerSlide: canManageShops,
    images: heroImages,
  })

  return (
    <FullWidthLayout
      scroll
      onRefresh={async () => {
        categoriesFeed.refresh()
        shopsFeed.refresh()
      }}
      refreshing={categoriesFeed.isRefreshing || shopsFeed.isRefreshing}
    >
      <YStack
        gap="$5"
        paddingBottom="$10"
        width="100%"
        backgroundColor={ui.background}
        testID="tab-home-commerce"
      >
        <PageSection bleed paddingTop="$4">
          <HomeHeroSlider slides={heroSlides} />
        </PageSection>

        {categoriesFeed.items.length > 0 ? (
          <PageSection paddingTop="$2" gap="$3">
            <InfiniteHorizontalSection
              hasMore={categoriesFeed.hasMore}
              isLoadingMore={categoriesFeed.isLoadingMore}
              onLoadMore={categoriesFeed.loadMore}
            >
              {categoriesFeed.items.map((category) => (
                <CategoryChip key={category.category_id} category={category} />
              ))}
            </InfiniteHorizontalSection>
          </PageSection>
        ) : categoriesFeed.isLoading && categoriesFeed.items.length === 0 ? (
          <PageSection paddingTop="$2">
            <Spinner size="small" />
          </PageSection>
        ) : null}

        {/* These return null when empty — do not wrap in PageSection or empty gaps stack. */}
        <IdleMount>
          <SaleEventBanner inset />
          <AvailableOffersCard
            title="Offers for you"
            maxItems={8}
            layout="row"
            bordered={false}
            inset
          />
          <RecentlyViewedRail inset />
          <FollowedShopsRail inset />
          <NearYouLocationChip />
          <NearbyShopsSection />
        </IdleMount>

        <InfiniteListingSection
          kind="physical"
          title="Ships to you"
          subtitle={`${formatCount(stats.physical_listings)} active listings`}
          actionLabel="See more"
          actionHref={commerceRoutes.browse('physical')}
          inset
        />

        <InfiniteListingSection
          kind="digital"
          title="Instant delivery"
          subtitle={`${formatCount(stats.digital_listings)} active listings`}
          actionLabel="See more"
          actionHref={commerceRoutes.browse('digital')}
          inset
        />

        <InfiniteListingSection
          kind="featured"
          title="Recommended for you"
          subtitle="Ranked by your activity, location, and demand"
          actionLabel="See more"
          actionHref={commerceRoutes.browse('featured')}
          inset
        />

        <InfiniteListingSection
          kind="trending"
          title="Popular right now"
          actionLabel="See more"
          actionHref={commerceRoutes.browse('trending')}
          inset
        />

        {shopsFeed.items.length > 0 ? (
          <PageSection>
            <CommerceSection title="Shops you'll love" actionLabel="See more" actionHref={commerceRoutes.shops}>
              <InfiniteHorizontalSection
                hasMore={shopsFeed.hasMore}
                isLoadingMore={shopsFeed.isLoadingMore}
                onLoadMore={shopsFeed.loadMore}
              >
                {shopsFeed.items.map((shop) => (
                  <ShopSpotlightCard key={shop.id} shop={shop} />
                ))}
              </InfiniteHorizontalSection>
            </CommerceSection>
          </PageSection>
        ) : shopsFeed.isLoading && shopsFeed.items.length === 0 ? (
          <PageSection>
            <Spinner size="small" />
          </PageSection>
        ) : null}

        <InfiniteListingSection
          kind="latest"
          title="New arrivals"
          actionLabel="See more"
          actionHref={commerceRoutes.browse('latest')}
          inset
        />

        {canManageShops ? (
          <PageSection>
            <YStack
              width="100%"
              borderRadius={radius.surface}
              padding="$6"
              gap="$4"
              borderWidth={1}
              borderColor={ui.borderSubtle}
              overflow="hidden"
              position="relative"
              style={{
                backgroundColor: ui.roseSurface,
                ...(Platform.OS === 'web'
                  ? { background: `linear-gradient(135deg, ${ui.roseSurface} 0%, ${ui.surface} 100%)` }
                  : {}),
              }}
            >
              <YStack gap="$2" width="100%">
                <Text fontWeight="800" fontSize={20} color={ui.text} letterSpacing={-0.4}>
                  Ready to start selling?
                </Text>
                <Paragraph color={ui.textSecondary} fontSize={15} lineHeight={22}>
                  Join {formatCount(stats.shops_with_listings)} sellers on {BRAND_NAME}. List your
                  products and reach shoppers across India.
                </Paragraph>
              </YStack>
              <XStack gap="$3" flexWrap="wrap">
                <AppLink href={commerceRoutes.createShop} asChild>
                  <Theme name={BRAND_THEME}>
                    <Button tone="primary" size="$4" borderRadius={999}>
                      Start selling
                    </Button>
                  </Theme>
                </AppLink>
                <AppLink href={commerceRoutes.shops} asChild>
                  <Button tone="outline" size="$4" borderRadius={999} backgroundColor={ui.surface}>
                    Browse shops
                  </Button>
                </AppLink>
              </XStack>
            </YStack>
          </PageSection>
        ) : null}
      </YStack>
    </FullWidthLayout>
  )
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-IN').format(value)
}
