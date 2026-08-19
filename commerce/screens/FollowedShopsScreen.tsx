import { ShopSpotlightCard } from '~/commerce/components/ShopSpotlightCard'
import { FollowedShopDigestSection } from '~/commerce/components/FollowedShopDigestSection'
import { useCart } from '~/commerce/hooks/useCart'
import { useFollowedShopDigest } from '~/commerce/hooks/useFollowedShopDigest'
import type { FollowedShopSummary } from '~/commerce/lib/shop-follows'
import type { FollowedShopDigestItem, FollowedShopDigestSection as FollowedShopDigestSectionType } from '~/commerce/lib/followed-shop-digest'
import type { ShopSummary } from '~/commerce/lib/commerce'
import { Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { AppLink } from '~/components/navigation/AppLink'
import { commerceRoutes } from '~/lib/routes'
import { navigateApp } from '~/lib/platform/navigate'
import { useAppUi } from '~/lib/theme/useAppUi'

function toShopSummary(shop: FollowedShopSummary): ShopSummary {
  return {
    id: shop.id,
    shop_name: shop.shop_name,
    slug: shop.slug,
    logo_url: shop.logo_url,
    shop_description: shop.shop_description,
    verified: shop.verified,
    average_rating: shop.average_rating,
    total_reviews: shop.total_reviews,
    shop_currency: shop.shop_currency ?? 'INR',
  } as ShopSummary
}

export function FollowedShopsScreen() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { addToCart } = useCart()
  const { followedShops, sections, counts, isLoading, refresh } = useFollowedShopDigest()

  async function handleMoveToCart(item: FollowedShopDigestItem) {
    const result = await addToCart(item.id)
    if (result.error) {
      toast.show('Choose options first', {
        tone: 'info',
        message: 'Open the product page to pick options before adding it to cart.',
      })
      navigateApp(commerceRoutes.listing(item.slug ?? item.id))
      return
    }
    toast.show('Moved to cart', { tone: 'success' })
  }

  async function handleBuyNow(item: FollowedShopDigestItem) {
    const result = await addToCart(item.id)
    if (result.error) {
      toast.show('Choose options first', {
        tone: 'info',
        message: 'Open the product page to pick options before buying now.',
      })
      navigateApp(commerceRoutes.listing(item.slug ?? item.id))
      return
    }
    navigateApp(commerceRoutes.checkout)
  }

  async function handleBulkPrimary(section: FollowedShopDigestSectionType) {
    if (!section.items.length) return
    let moved = 0
    let blocked = 0
    for (const item of section.items) {
      const result = await addToCart(item.id)
      if (result.error) blocked += 1
      else moved += 1
    }
    toast.show(blocked > 0 ? 'Moved what we could' : 'Moved to cart', {
      tone: blocked > 0 ? 'info' : 'success',
      message:
        blocked > 0
          ? `${moved} item${moved === 1 ? '' : 's'} moved. ${blocked} need product-page option selection.`
          : `${moved} item${moved === 1 ? '' : 's'} moved to cart.`,
    })
  }

  if (!isLoading && !followedShops.length) {
    return (
      <FullWidthLayout>
        <PageSection title="Shops you follow">
          <Text color={ui.textSecondary}>Follow shops to unlock a personalized activity digest here.</Text>
          <AppLink href={commerceRoutes.shops}>
            <Text color={ui.brand} marginTop="$3">
              Discover shops
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
        description="Track new arrivals, price moves, and saved-item opportunities from the sellers you follow."
      >
        {isLoading ? (
          <Spinner />
        ) : (
          <YStack gap="$4">
            {sections.length ? (
              <XStack gap="$3" flexWrap="wrap">
                <SummaryCard label="Followed shops" value={counts.followedShops} />
                <SummaryCard label="New arrivals" value={counts.newArrivals} />
                <SummaryCard label="Price drops" value={counts.priceDrops} />
                <SummaryCard label="Saved overlap" value={counts.savedOverlap} />
              </XStack>
            ) : (
              <YStack gap="$3">
                <Text color={ui.textSecondary}>
                  We are tracking your followed shops. As new listings and price moves come in, this digest
                  will highlight them here.
                </Text>
              </YStack>
            )}

            {sections.map((section) => (
              <FollowedShopDigestSection
                key={section.key}
                section={section}
                onMoveToCart={(item) => void handleMoveToCart(item)}
                onBuyNow={(item) => void handleBuyNow(item)}
                onBulkPrimary={(current) => void handleBulkPrimary(current)}
              />
            ))}

            <YStack gap="$3">
              <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
                <YStack gap="$1">
                  <Text fontSize={16} fontWeight="800" color={ui.text}>
                    Your followed shops
                  </Text>
                  <Text fontSize={13} color={ui.textSecondary}>
                    Browse every shop that currently contributes to your digest.
                  </Text>
                </YStack>
                <Text
                  color={ui.brand}
                  fontWeight="600"
                  onPress={() => {
                    void refresh()
                  }}
                >
                  Refresh digest
                </Text>
              </XStack>

              <YStack gap="$3" flexDirection="row" flexWrap="wrap">
                {followedShops.map((shop) => (
                  <ShopSpotlightCard key={shop.id} shop={toShopSummary(shop)} />
                ))}
              </YStack>
            </YStack>
          </YStack>
        )}
      </PageSection>
    </FullWidthLayout>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  const ui = useAppUi()
  return (
    <YStack
      minWidth={140}
      flex={1}
      gap="$1"
      padding="$3"
      borderRadius={14}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <Text fontSize={22} fontWeight="800" color={ui.text}>
        {value}
      </Text>
      <Text fontSize={12} color={ui.textSecondary}>
        {label}
      </Text>
    </YStack>
  )
}
