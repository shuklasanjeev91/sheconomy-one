import { Link } from 'one'

import { Spinner, Text, Theme, XStack, YStack, useMedia } from '~/components/ui'
import { ShopSpotlightCard } from '~/commerce/components'
import { useShopsFeed } from '~/commerce/hooks/useShopsFeed'
import { BRAND_THEME } from '~/config/tokens'
import { commerceRoutes } from '~/lib/routes'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { LoadMoreEnd, LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BRAND_NAME } from '~/config/brand'

export function ShopsBrowseScreen() {
  const ui = useAppUi()
  const media = useMedia()
  const shopsFeed = useShopsFeed(true)
  const gridColumns = media.gtLg ? 4 : media.gtMd ? 3 : media.gtSm ? 2 : 1

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6" gap="$5">
        <YStack gap="$1">
          <Text fontWeight="500" fontSize={28} color={ui.text} letterSpacing={-0.4}>
            All shops
          </Text>
          <Text color={ui.textMuted} fontSize={14}>
            Discover women-led storefronts on {BRAND_NAME}
          </Text>
        </YStack>

        {shopsFeed.isLoading ? (
          <YStack alignItems="center" paddingVertical="$8">
            <Spinner size="large" />
          </YStack>
        ) : shopsFeed.error ? (
          <Text color={ui.textSecondary}>{shopsFeed.error}</Text>
        ) : shopsFeed.items.length === 0 ? (
          <YStack
            alignItems="center"
            paddingVertical="$10"
            gap="$3"
            borderRadius={8}
            backgroundColor={ui.surfaceMuted}
            borderWidth={1}
            borderColor={ui.panelBorder}
          >
            <Text fontWeight="500" fontSize={16} color={ui.text}>
              No shops yet
            </Text>
            <Link href={commerceRoutes.home}>
              <Theme name={BRAND_THEME}>
                <Text color="$color9" fontWeight="500" textDecorationLine="underline">
                  Back to home
                </Text>
              </Theme>
            </Link>
          </YStack>
        ) : (
          <YStack gap="$4" width="100%">
            <XStack gap="$4" flexWrap="wrap" width="100%">
              {shopsFeed.items.map((shop) => (
                <XStack
                  key={shop.id}
                  flexBasis={gridColumns === 1 ? '100%' : gridColumns === 2 ? '47%' : '30%'}
                  flexGrow={0}
                  minWidth={gridColumns === 1 ? undefined : 220}
                  maxWidth={320}
                >
                  <ShopSpotlightCard shop={shop} />
                </XStack>
              ))}
            </XStack>
            <LoadMoreSentinel
              hasMore={shopsFeed.hasMore}
              isLoadingMore={shopsFeed.isLoadingMore}
              onLoadMore={shopsFeed.loadMore}
            />
            {!shopsFeed.hasMore ? <LoadMoreEnd /> : null}
          </YStack>
        )}
      </PageSection>
    </FullWidthLayout>
  )
}