import { Platform } from 'react-native'
import { AppLink } from '~/components/navigation/AppLink'

import { AvailableOffersCard } from '~/commerce/components/AvailableOffersCard'
import { CategoryChip } from '~/commerce/components/CategoryChip'
import { CommerceSection } from '~/commerce/components/CommerceSection'
import { FollowedShopDigestEntryCard } from '~/commerce/components/FollowedShopDigestEntryCard'
import { FollowedShopsRail } from '~/commerce/components/FollowedShopsRail'
import { HomeHeroSlider, buildHomeHeroSlides } from '~/commerce/components/HomeHeroSlider'
import { InfiniteHorizontalSection } from '~/commerce/components/InfiniteHorizontalSection'
import { InfiniteListingSection } from '~/commerce/components/InfiniteListingSection'
import { BuyerListingInquiryHomeStrip } from '~/commerce/components/BuyerListingInquiryHomeStrip'
import { BuyerOrderAttentionStrip } from '~/commerce/components/BuyerOrderAttentionStrip'
import { PendingReviewsHomeStrip } from '~/commerce/components/PendingReviewsHomeStrip'
import { PostPurchaseHomeStrip } from '~/commerce/components/PostPurchaseHomeStrip'
import { SavedForLaterHomeStrip } from '~/commerce/components/SavedForLaterHomeStrip'
import { VendorSaleEventsHomeStrip } from '~/commerce/components/VendorSaleEventsHomeStrip'
import { WishlistPriceDropHomeStrip } from '~/commerce/components/WishlistPriceDropHomeStrip'
import { RecentlyViewedRail } from '~/commerce/components/RecentlyViewedRail'
import { SaleEventBanner } from '~/commerce/components/SaleEventBanner'
import { ShopSpotlightCard } from '~/commerce/components/ShopSpotlightCard'
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
import { FullWidthLayout, PageSection } from '~/components/layout'
import { NearbyShopsSection, NearYouLocationChip } from '~/components/location'
import { BRAND_THEME, radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useCategoriesFeed } from '~/commerce/hooks/useCategoriesFeed'
import { useShopsFeed } from '~/commerce/hooks/useShopsFeed'
import {
  type CommerceStats,
  type HomeBootstrapData,
  type HomeHeroImageSet,
} from '~/commerce/lib/commerce'
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

const EMPTY_STATS: CommerceStats = {
  total_active_listings: 0,
  shops_with_listings: 0,
  total_featured_listings: 0,
  new_listings_this_week: 0,
  physical_listings: 0,
  digital_listings: 0,
}

const EMPTY_HERO_IMAGES: HomeHeroImageSet = {
  shops: [],
  physical: [],
  digital: [],
  trending: [],
  sell: [],
}

/**
 * Marketplace home — one UI for web, iOS, and Android.
 * Route files only differ on how loader data is fetched (SSR vs native).
 *
 * Never swaps the home return for `public/splash.png` / a brand splash.
 * Paint the home shell immediately; sections fill in as feeds resolve.
 */
export function HomeScreen({ data, error, loading = false }: HomeScreenProps) {
  const ui = useAppUi()
  const { canManageShops } = useAccess()
  // Start category/shop rails even before bootstrap stats arrive.
  const feedsEnabled = !error || !!data
  const categoriesFeed = useCategoriesFeed(feedsEnabled)
  const shopsFeed = useShopsFeed(feedsEnabled)

  // Only hard-fail after the loader finished with nothing usable.
  if (!loading && (error || !data)) {
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

  const stats = data?.stats ?? EMPTY_STATS
  const heroImages = data?.heroImages ?? EMPTY_HERO_IMAGES
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
        paddingBottom="$2"
        width="100%"
        backgroundColor={ui.background}
        testID="tab-home-commerce"
      >
        <PageSection bleed paddingTop={0}>
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
          <WishlistPriceDropHomeStrip inset />
          <SavedForLaterHomeStrip inset />
          <PendingReviewsHomeStrip inset />
          <VendorSaleEventsHomeStrip inset />
          <BuyerListingInquiryHomeStrip inset />
          <PostPurchaseHomeStrip inset />
          <BuyerOrderAttentionStrip inset />
          <FollowedShopDigestEntryCard inset />
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

        <IdleMount>
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
        </IdleMount>
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
