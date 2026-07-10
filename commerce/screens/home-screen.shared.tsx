import { Link } from 'one'
import { Platform } from 'react-native'

import {
  CategoryChip,
  CommerceSection,
  HomeHeroSlider,
  buildHomeHeroSlides,
  InfiniteHorizontalSection,
  InfiniteListingSection,
  ShopSpotlightCard,
} from '~/commerce/components'
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
import { FullWidthLayout, PageCenter, PageSection } from '~/components/layout'
import { BRAND_THEME, radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useCategoriesFeed } from '~/commerce/hooks/useCategoriesFeed'
import { useShopsFeed } from '~/commerce/hooks/useShopsFeed'
import { fetchHomeBootstrap, type HomeBootstrapData } from '~/commerce/lib/commerce'
import { commerceRoutes, routes } from '~/lib/routes'
import { useAccess } from '~/hooks/useAccess'

import { BRAND_NAME } from '~/config/brand'

export async function homeLoader() {
  return fetchHomeBootstrap()
}

type HomeScreenViewProps = {
  data: HomeBootstrapData | null
  error: string | null
  loading?: boolean
}

export function HomeScreenView({ data, error, loading = false }: HomeScreenViewProps) {
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
              <Link href={routes.home} asChild>
                <Button tone="primary" size="$4" alignSelf="flex-start" borderRadius={999}>
                  Browse shops
                </Button>
              </Link>
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
    <FullWidthLayout scroll>
      <YStack gap="$8" paddingBottom="$10" width="100%" backgroundColor={ui.background}>
        <PageSection bleed paddingTop="$4">
          <HomeHeroSlider slides={heroSlides} />
        </PageSection>

        {categoriesFeed.items.length > 0 ? (
          <PageSection paddingTop="$4" gap="$3">
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
        ) : categoriesFeed.isLoading ? (
          <PageSection paddingTop="$4">
            <Spinner size="small" />
          </PageSection>
        ) : null}

        <PageSection>
          <InfiniteListingSection
            kind="physical"
            title="Ships to you"
            subtitle={`${formatCount(stats.physical_listings)} active listings`}
            actionLabel="See more"
            actionHref={commerceRoutes.browse('physical')}
          />
        </PageSection>

        <PageSection>
          <InfiniteListingSection
            kind="digital"
            title="Instant delivery"
            subtitle={`${formatCount(stats.digital_listings)} active listings`}
            actionLabel="See more"
            actionHref={commerceRoutes.browse('digital')}
          />
        </PageSection>

        <PageSection>
          <InfiniteListingSection
            kind="featured"
            title="Recommended for you"
            subtitle="Ranked by your activity, location, and demand"
            actionLabel="See more"
            actionHref={commerceRoutes.browse('featured')}
          />
        </PageSection>

        <PageSection>
          <InfiniteListingSection
            kind="trending"
            title="Popular right now"
            actionLabel="See more"
            actionHref={commerceRoutes.browse('trending')}
          />
        </PageSection>

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
        ) : shopsFeed.isLoading ? (
          <PageSection>
            <Spinner size="small" />
          </PageSection>
        ) : null}

        <PageSection>
          <InfiniteListingSection
            kind="latest"
            title="New arrivals"
            actionLabel="See more"
            actionHref={commerceRoutes.browse('latest')}
          />
        </PageSection>

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
                <Text fontWeight="800" fontSize={22} color={ui.text} letterSpacing={-0.4}>
                  Ready to start selling?
                </Text>
                <Paragraph color={ui.textSecondary} fontSize={15} lineHeight={22}>
                  Join {formatCount(stats.shops_with_listings)} sellers on {BRAND_NAME}. List your
                  products and reach shoppers across India.
                </Paragraph>
              </YStack>
              <XStack gap="$3" flexWrap="wrap">
                <Link href={`${routes.myShops}?create=1` as import('one').Href} asChild>
                  <Theme name={BRAND_THEME}>
                    <Button tone="primary" size="$4" borderRadius={999}>
                      Start selling
                    </Button>
                  </Theme>
                </Link>
                <Link href={commerceRoutes.shops} asChild>
                  <Button tone="outline" size="$4" borderRadius={999} backgroundColor={ui.surface}>
                    Browse shops
                  </Button>
                </Link>
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
