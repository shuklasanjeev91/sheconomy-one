import { useState } from 'react'
import { useParams } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { Button, Icons, Paragraph, Separator, Spinner, Text, XStack, YStack, useAppToast, useMedia } from '~/components/ui'
import {
  AvailableOffersCard,
  ListingGrid,
  LoadMoreEnd,
  LoadMoreSentinel,
  ReviewsSection,
  SectionTitle,
  ShopAnnouncementBanner,
  shopAnnouncementFromMetadata,
  ShopHero,
  ShopManagePanel,
  ShopOwnerPanel,
} from '~/commerce/components'
import { useCanonicalShopSlug } from '~/commerce/hooks/useCanonicalSlug'
import { useListingFeed } from '~/commerce/hooks/useListingFeed'
import { useShop } from '~/commerce/hooks/useShop'
import { useShopReviews } from '~/commerce/hooks/useShopReviews'
import { hasVisibleReviews } from '~/commerce/lib/reviews'
import { formatShopCountry } from '~/commerce/lib/shop-location'
import { FullWidthLayout, PageCenter, PageSection } from '~/components/layout'
import { getShadowStyle, radius } from '~/config/tokens'
import { useVendorShops } from '~/hooks/useVendorShops'
import { useProfile } from '~/hooks/useProfile'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function ShopScreen() {
  const ui = useAppUi()
  const { slug } = useParams<{ slug: string }>()
  const media = useMedia()
  const isDesktop = media.gtMd
  const { shop, isLoading, error, refresh } = useShop(slug)
  useCanonicalShopSlug(slug, shop)
  const {
    reviews: shopReviews,
    summary: shopReviewSummary,
    isLoading: shopReviewsLoading,
    error: shopReviewsError,
  } = useShopReviews(shop?.id, {
    averageRating: shop?.average_rating,
    totalReviews: shop?.total_reviews,
  })
  const listingsFeed = useListingFeed({ kind: 'shop', shopId: shop?.id, enabled: !!shop?.id })
  const { user } = useProfile()
  const { updateShop } = useVendorShops()
  const toast = useAppToast()
  const gridColumns = media.gtLg ? 4 : media.gtMd ? 3 : media.gtSm ? 3 : 2

  const [shopName, setShopName] = useState('')
  const [shopDescription, setShopDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  if (isLoading) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (error || !shop) {
    return (
      <FullWidthLayout scroll>
        <PageSection paddingVertical="$10">
          <YStack
            gap="$4"
            padding="$6"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
            maxWidth={480}
            style={getShadowStyle('sm')}
          >
            <Text fontWeight="600" fontSize={22} color={ui.text}>
              Shop not found
            </Text>
            <Paragraph color={ui.textSecondary}>{error ?? 'This shop could not be loaded.'}</Paragraph>
            <AppLink href={commerceRoutes.home} asChild>
              <Button tone="primary" size="$4" borderRadius={999} alignSelf="flex-start">
                Browse marketplace
              </Button>
            </AppLink>
          </YStack>
        </PageSection>
      </FullWidthLayout>
    )
  }

  const isOwner = !!user && shop.user_id === user.id
  const shopCountry = formatShopCountry(shop.address)
  const hasReviews = hasVisibleReviews(shopReviewSummary) || shopReviews.length > 0
  const listingsCount = listingsFeed.items.length

  async function handleSave() {
    setIsSaving(true)
    const { error: saveError } = await updateShop(shop.id, {
      shop_name: shopName || shop.shop_name,
      shop_description: shopDescription,
    })
    setIsSaving(false)

    if (saveError) {
      toast.show('Update failed', { tone: 'danger', message: saveError.message })
      return
    }

    toast.show('Shop updated', { tone: 'success' })
    setIsEditing(false)
    await refresh()
  }

  function handleToggleEdit() {
    if (!isEditing) {
      setShopName(shop.shop_name)
      setShopDescription(shop.shop_description ?? '')
    }
    setIsEditing((value) => !value)
  }

  const sidebar = (
    <YStack gap="$4" width="100%">
      <ShopOwnerPanel
        owner={shop.owner}
        address={shop.address}
        shopCreatedAt={shop.created_at}
        shopCurrency={shop.shop_currency}
      />
      {isOwner ? (
        <ShopManagePanel
          isEditing={isEditing}
          isSaving={isSaving}
          shopName={shopName}
          shopDescription={shopDescription}
          onShopNameChange={setShopName}
          onShopDescriptionChange={setShopDescription}
          onToggleEdit={handleToggleEdit}
          onSave={handleSave}
        />
      ) : null}
    </YStack>
  )

  const offersSection = (
    <AvailableOffersCard
      currency={shop.shop_currency ?? 'INR'}
      shopId={shop.id}
      title="Offers from this shop"
    />
  )

  const listingsSection = (
    <YStack gap="$4" width="100%" minWidth={0}>
      <XStack alignItems="flex-end" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <SectionTitle title="Shop items" subtitle="Browse everything from this seller" />
        {listingsCount > 0 ? (
          <Text fontSize={13} color={ui.textSecondary} fontWeight="600" paddingBottom="$1">
            {listingsCount}
            {listingsFeed.hasMore ? '+' : ''} listings
          </Text>
        ) : null}
      </XStack>

      {listingsFeed.isLoading ? (
        <YStack paddingVertical="$8" alignItems="center">
          <Spinner size="large" />
        </YStack>
      ) : listingsCount === 0 ? (
        <YStack
          alignItems="center"
          justifyContent="center"
          paddingVertical="$10"
          gap="$3"
          borderRadius={radius.card}
          backgroundColor={ui.surfaceMuted}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          style={getShadowStyle('sm')}
        >
          <Icons.Store size={32} color={ui.brand} opacity={0.8} />
          <Text fontWeight="700" fontSize={16} color={ui.text} letterSpacing={-0.2}>
            No listings yet
          </Text>
          <Text color={ui.textMuted} fontSize={14} textAlign="center" maxWidth={320}>
            This shop hasn&apos;t published any active items. Check back soon.
          </Text>
        </YStack>
      ) : (
        <YStack gap="$4" width="100%">
          <ListingGrid listings={listingsFeed.items} columns={gridColumns} />
          <LoadMoreSentinel
            hasMore={listingsFeed.hasMore}
            isLoadingMore={listingsFeed.isLoadingMore}
            onLoadMore={listingsFeed.loadMore}
          />
          {!listingsFeed.hasMore ? <LoadMoreEnd /> : null}
        </YStack>
      )}
    </YStack>
  )

  const reviewsSection =
    hasReviews ? (
      <YStack gap="$4" width="100%">
        <Separator borderColor={ui.panelBorder} />
        <ReviewsSection
          title="Shop reviews"
          summary={shopReviewSummary}
          reviews={shopReviews}
          isLoading={shopReviewsLoading}
          error={shopReviewsError}
        />
      </YStack>
    ) : null

  return (
    <FullWidthLayout scroll>
      <YStack width="100%" paddingBottom="$10" backgroundColor={ui.background}>
        <ShopHero
          shopId={shop.id}
          shopName={shop.shop_name}
          logoUrl={shop.logo_url}
          description={shop.shop_description}
          verified={shop.verified}
          reviewSummary={shopReviewSummary}
          hasReviews={hasVisibleReviews(shopReviewSummary)}
          listingsCount={listingsCount}
          country={shopCountry}
          websiteUrl={shop.website_url}
          ownerUserId={shop.owner?.id}
          shopSlug={slug ?? shop.slug}
        />

        {shopAnnouncementFromMetadata(shop.shop_metadata) ? (
          <PageSection paddingTop="$4">
            <ShopAnnouncementBanner
              message={shopAnnouncementFromMetadata(shop.shop_metadata) ?? ''}
            />
          </PageSection>
        ) : null}

        <PageSection paddingTop="$6" gap="$6">
          {isDesktop ? (
            <XStack gap="$6" alignItems="flex-start" width="100%">
              <YStack flex={1} minWidth={0} gap="$8">
                {offersSection}
                {listingsSection}
                {reviewsSection}
              </YStack>
              <YStack width={320} flexShrink={0} gap="$4">
                {sidebar}
              </YStack>
            </XStack>
          ) : (
            <YStack gap="$6" width="100%">
              {offersSection}
              {listingsSection}
              {sidebar}
              {reviewsSection}
            </YStack>
          )}
        </PageSection>
      </YStack>
    </FullWidthLayout>
  )
}