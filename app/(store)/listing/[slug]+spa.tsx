import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useRouter } from 'one'
import {
  Avatar,
  Button,
  Icons,
  ScrollView,
  Separator,
  Spinner,
  Text,
  Theme,
  XStack,
  YStack,
  useAppToast,
  useMedia,
} from '~/components/ui'
import {
  AvailableOffersCard,
  CommercePanel,
  FavoriteButton,
  ListingDetailsPanel,
  ListingFulfillmentPanel,
  ListingImage,
  ListingMobileGallery,
  ListingMobileStickyBuyBar,
  LISTING_MOBILE_STICKY_BAR_HEIGHT,
  ListingRecommendationsSections,
  ListingVariantPicker,
  RatingSummary,
  ReviewsSection,
} from '~/commerce/components'
import { useCart } from '~/commerce/hooks/useCart'
import { recordListingView } from '~/commerce/lib/recently-viewed'
import { useListingReviews } from '~/commerce/hooks/useListingReviews'
import { useCanonicalListingSlug } from '~/commerce/hooks/useCanonicalSlug'
import { PageCenter, PageScroll } from '~/components/layout'
import { MOBILE_TAB_BAR_HEIGHT } from '~/components/navigation/constants'
import { ShareButton } from '~/components/share'
import { BRAND_THEME, getShadowStyle, radius } from '~/config/tokens'
import { useListing } from '~/hooks/useListing'
import {
  buildListingSpecifications,
  getDefaultVariantSelection,
  getSelectedVariations,
  getVariantPrice,
  getVariantStock,
  groupListingVariations,
} from '~/commerce/lib/listing-detail'
import {
  buildListingFulfillmentInfo,
  isDigitalListing,
} from '~/commerce/lib/listing-fulfillment'
import { buildShopShippingSummary } from '~/commerce/lib/shop-shipping'
import { formatCurrency } from '~/lib/format'
import { hasVisibleReviews, mergeReviewSummary } from '~/commerce/lib/reviews'
import { getShopSlug } from '~/lib/supabase/commerce'
import { commerceRoutes } from '~/lib/routes'
import { getListingShareUrl } from '~/lib/share'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BRAND_SHOP_LABEL } from '~/config/brand'

export default function ListingDetailScreen() {
  const ui = useAppUi()
  const { slug } = useParams<{ slug: string }>()
  const { listing, images, variations, attributes, deliveryProfiles, isLoading, error } = useListing(slug)
  useCanonicalListingSlug(slug, listing)
  const {
    reviews,
    summary: reviewSummary,
    isLoading: reviewsLoading,
    error: reviewsError,
  } = useListingReviews(listing?.id, {
    averageRating: listing?.average_rating,
    totalReviews: listing?.total_reviews,
  })
  const { addToCart } = useCart()
  const toast = useAppToast()
  const router = useRouter()
  const media = useMedia()
  const isDesktop = media.gtMd

  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const variationGroups = useMemo(() => groupListingVariations(variations), [variations])
  const [variantSelection, setVariantSelection] = useState<Record<string, string>>({})

  useEffect(() => {
    setVariantSelection(getDefaultVariantSelection(variationGroups))
  }, [listing?.id, variationGroups])

  useEffect(() => {
    if (listing?.id) recordListingView(listing.id)
  }, [listing?.id])

  if (isLoading) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (error || !listing) {
    return (
      <PageScroll>
        <YStack padding="$4" gap="$4" width="100%">
          <Text fontWeight="500" fontSize={20} color={ui.text}>
            Listing not found
          </Text>
          <Text color={ui.textSecondary}>{error ?? 'This listing could not be loaded.'}</Text>
          <Link href={commerceRoutes.home} asChild>
            <Button tone="outline" size="$4" alignSelf="flex-start" borderRadius={999}>
              Back to shops
            </Button>
          </Link>
        </YStack>
      </PageScroll>
    )
  }

  const currency = listing.shops?.shop_currency ?? 'INR'
  const sortedImages = [...images].sort(
    (a, b) => (a.is_primary ? -1 : 0) - (b.is_primary ? -1 : 0) || a.display_order - b.display_order,
  )
  const galleryUrls = sortedImages.map((image) => image.image_url)
  const activeImage = sortedImages[activeImageIndex] ?? sortedImages[0]
  const activeGalleryUrls = activeImage
    ? [activeImage.image_url, ...galleryUrls.filter((url) => url !== activeImage.image_url)]
    : galleryUrls

  const selectedVariations = getSelectedVariations(variations, variantSelection)
  const displayPrice = getVariantPrice(listing.price, selectedVariations)
  const displayStock = getVariantStock(listing.stock, selectedVariations)
  const selectedVariantId = selectedVariations[0]?.id ?? null
  const outOfStock = displayStock === 0

  async function handleAddToCart(goToCheckout = false) {
    setIsAddingToCart(true)
    const { error: cartError } = await addToCart(listing.id, {
      quantity: 1,
      variantId: selectedVariantId,
    })
    setIsAddingToCart(false)

    if (cartError) {
      toast.show('Could not add to cart', { tone: 'danger', message: cartError })
      return
    }

    toast.show('Added to cart', { tone: 'success' })
    if (goToCheckout) {
      router.push(commerceRoutes.cart)
    }
  }

  const specifications = buildListingSpecifications({
    sku: selectedVariations[0]?.sku ?? listing.sku,
    weight: listing.weight,
    dimensions: listing.dimensions,
    category: listing.category,
    listingType: listing.listing_type,
    attributes,
    tags: listing.tags,
  })

  const fulfillmentInfo = buildListingFulfillmentInfo({
    listingType: listing.listing_type,
    shippingRequired: listing.shipping_required,
    price: displayPrice,
    currency,
    digitalFileType: listing.digital_file_type,
    digitalFileSize: listing.digital_file_size,
    digitalFileUrl: listing.digital_file_url,
    downloadLimit: listing.download_limit,
    listingMetadata: listing.listing_metadata,
    deliveryProfiles,
    listingDeliveryProfiles: deliveryProfiles,
    shopDeliveryProfiles: listing.shops?.delivery_profiles ?? undefined,
    shopShipping: listing.shops
      ? buildShopShippingSummary({
          shop_metadata: listing.shops.shop_metadata,
          delivery_profiles: listing.shops.delivery_profiles,
          shipping_providers: listing.shops.shipping_providers,
          shop_shipping_accounts: listing.shops.shop_shipping_accounts,
          shipping_rates: listing.shops.shipping_rates,
        })
      : null,
  })

  const isDigital = isDigitalListing(listing.listing_type)
  const buyNowLabel = isDigital ? 'Buy & download' : 'Buy it now'
  const mobileBottomInset = MOBILE_TAB_BAR_HEIGHT + LISTING_MOBILE_STICKY_BAR_HEIGHT + 16
  const listingShareSlug = slug ?? listing.id
  const listingShareButton = (
    <ShareButton
      variant="icon"
      label="Share listing"
      sheetTitle="Share listing"
      copyLabel="Copy listing link"
      copyToastMessage="Listing link copied to clipboard."
      payload={{
        url: getListingShareUrl(listingShareSlug),
        title: listing.title,
        text: listing.shops?.shop_name ? `From ${listing.shops.shop_name}` : undefined,
      }}
    />
  )

  const shopReviewSummary = listing.shops
    ? mergeReviewSummary(
        {
          averageRating: listing.shops.average_rating,
          totalReviews: listing.shops.total_reviews,
        },
        { averageRating: null, totalReviews: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
      )
    : null

  const shopCard = listing.shops ? (
    <Link href={commerceRoutes.shop(getShopSlug(listing.shops))} asChild>
      <XStack
        gap="$3"
        alignItems="center"
        padding="$3.5"
        borderRadius={isDesktop ? radius.card : radius.chip}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        cursor="pointer"
        hoverStyle={{ backgroundColor: ui.navHover, ...getShadowStyle('md') }}
        pressStyle={{ scale: 0.99 }}
        backgroundColor={ui.surface}
        marginHorizontal={isDesktop ? 0 : -16}
        paddingHorizontal={isDesktop ? '$3.5' : '$4'}
        style={getShadowStyle('sm')}
      >
        <Avatar
          name={listing.shops.shop_name}
          src={listing.shops.logo_url ?? undefined}
          size="$5"
        />
        <YStack flex={1} gap={2}>
          <Text fontWeight="500" fontSize={14} color={ui.text}>
            {listing.shops.shop_name}
          </Text>
          <Text color={ui.textSecondary} fontSize={12}>
            {listing.shops.verified ? 'Verified shop' : 'Visit shop'}
          </Text>
          {shopReviewSummary && hasVisibleReviews(shopReviewSummary) ? (
            <RatingSummary summary={shopReviewSummary} size="sm" />
          ) : null}
        </YStack>
        <Icons.ChevronRight size={18} color={ui.textSecondary} />
      </XStack>
    </Link>
  ) : null

  if (!isDesktop) {
    return (
      <YStack flex={1} width="100%" backgroundColor={ui.surface} position="relative">
        <PageScroll>
          <YStack width="100%" paddingBottom={mobileBottomInset}>
            <ListingMobileGallery
              images={sortedImages}
              title={listing.title}
              listingId={listing.id}
              activeIndex={activeImageIndex}
              onIndexChange={setActiveImageIndex}
            />

            <YStack paddingHorizontal="$4" gap="$5" paddingTop="$5">
              <YStack gap="$2.5">
                <Text fontWeight="800" fontSize={28} color={ui.text} letterSpacing={-0.5} lineHeight={34}>
                  {formatCurrency(displayPrice, currency)}
                </Text>
                <RatingSummary summary={reviewSummary} size="sm" />
              </YStack>

              <XStack alignItems="flex-start" justifyContent="space-between" gap="$2">
                <Text fontSize={17} color={ui.text} lineHeight={24} fontWeight="600" letterSpacing={-0.2} flex={1}>
                  {listing.title}
                </Text>
                {listingShareButton}
              </XStack>

              {listing.shops?.shop_name ? (
                <Text fontSize={13} color={ui.textMuted} fontWeight="500">
                  Sold by {listing.shops.shop_name}
                </Text>
              ) : null}

              {fulfillmentInfo ? <ListingFulfillmentPanel info={fulfillmentInfo} compact /> : null}

              {displayStock != null ? (
                <Text fontSize={13} color={displayStock > 0 ? ui.success : ui.error} fontWeight="500">
                  {displayStock > 0 ? `${displayStock} in stock` : 'Out of stock'}
                </Text>
              ) : null}

              <AvailableOffersCard currency={currency} shopId={listing.shop_id} compact />

              <Separator borderColor={ui.panelBorder} />

              <ListingVariantPicker
                groups={variationGroups}
                selection={variantSelection}
                currency={currency}
                basePrice={listing.price}
                variant="mobile"
                onSelect={(groupName, variationId) =>
                  setVariantSelection((current) => ({ ...current, [groupName]: variationId }))
                }
              />

              {shopCard}

              {(listing.description?.trim() || specifications.length > 0) ? (
                <YStack gap="$4" paddingTop="$2">
                  <Separator borderColor={ui.panelBorder} />
                  <ListingDetailsPanel
                    description={listing.description}
                    specifications={specifications}
                  />
                </YStack>
              ) : null}

              <Separator borderColor={ui.panelBorder} />
              <ReviewsSection
                title={`Reviews for this item`}
                summary={reviewSummary}
                reviews={reviews}
                isLoading={reviewsLoading}
                error={reviewsError}
              />

              <Separator borderColor={ui.panelBorder} />
              <ListingRecommendationsSections listingId={listing.id} />
            </YStack>
          </YStack>
        </PageScroll>

        <ListingMobileStickyBuyBar
          price={displayPrice}
          currency={currency}
          disabled={outOfStock}
          isLoading={isAddingToCart}
          label="Add to cart"
          buyNowLabel={isDigital ? 'Download' : 'Buy now'}
          onPress={() => handleAddToCart(false)}
          onBuyNow={() => handleAddToCart(true)}
        />
      </YStack>
    )
  }

  const imageGallery = (
    <YStack flex={1.2} gap="$3" minWidth={0}>
      <YStack
        width="100%"
        aspectRatio={1}
        borderRadius={radius.card}
        overflow="hidden"
        backgroundColor={ui.imagePlaceholder}
        position="relative"
        borderWidth={1}
        borderColor={ui.borderSubtle}
        style={getShadowStyle('sm')}
      >
        {activeGalleryUrls.length > 0 ? (
          <ListingImage
            imageUrls={activeGalleryUrls}
            alt={activeImage?.alt_text ?? listing.title}
            width="100%"
            height="100%"
            objectFit="cover"
            placeholderIconSize={48}
          />
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <Icons.Image size={48} color={ui.textMuted} />
          </YStack>
        )}
        <FavoriteButton listingId={listing.id} size={20} />
      </YStack>

      {sortedImages.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$2">
            {sortedImages.map((image, index) => (
              <XStack
                key={image.id}
                width={72}
                height={72}
                borderRadius={radius.chip}
                overflow="hidden"
                borderWidth={activeImageIndex === index ? 2 : 1}
                borderColor={activeImageIndex === index ? ui.text : ui.panelBorder}
                cursor="pointer"
                onPress={() => setActiveImageIndex(index)}
              >
                <ListingImage
                  imageUrls={[image.image_url]}
                  alt={image.alt_text ?? listing.title}
                  width={72}
                  height={72}
                  objectFit="cover"
                  placeholderIconSize={20}
                />
              </XStack>
            ))}
          </XStack>
        </ScrollView>
      ) : null}
    </YStack>
  )

  const buyPanel = (
    <CommercePanel flex={1} gap="$4" minWidth={0} padding="$5">
      <YStack gap="$2">
        <Text fontSize={13} color={ui.textMuted} fontWeight="600" letterSpacing={0.2} textTransform="uppercase">
          {listing.shops?.shop_name ?? BRAND_SHOP_LABEL}
        </Text>
        <XStack alignItems="flex-start" justifyContent="space-between" gap="$2">
          <Text fontWeight="700" fontSize={26} color={ui.text} lineHeight={32} letterSpacing={-0.45} flex={1}>
            {listing.title}
          </Text>
          {listingShareButton}
        </XStack>
      </YStack>

      <RatingSummary summary={reviewSummary} />

      <Text fontWeight="800" fontSize={32} color={ui.text} letterSpacing={-0.6}>
        {formatCurrency(displayPrice, currency)}
      </Text>

      {fulfillmentInfo ? <ListingFulfillmentPanel info={fulfillmentInfo} /> : null}

      {displayStock != null ? (
        <Text fontSize={13} color={displayStock > 0 ? ui.success : ui.error} fontWeight="500">
          {displayStock > 0 ? `${displayStock} in stock` : 'Out of stock'}
        </Text>
      ) : null}

      <AvailableOffersCard currency={currency} shopId={listing.shop_id} />

      <ListingVariantPicker
        groups={variationGroups}
        selection={variantSelection}
        currency={currency}
        basePrice={listing.price}
        onSelect={(groupName, variationId) =>
          setVariantSelection((current) => ({ ...current, [groupName]: variationId }))
        }
      />

      <XStack gap="$3" flexWrap="wrap">
        <Theme name={BRAND_THEME}>
          <Button
            tone="primary"
            size="$5"
            flex={1}
            minWidth={200}
            borderRadius={999}
            disabled={isAddingToCart || outOfStock}
            onPress={() => handleAddToCart(false)}
            icon={isAddingToCart ? <Spinner size="small" color="white" /> : undefined}
          >
            {outOfStock ? 'Out of stock' : isAddingToCart ? 'Adding…' : 'Add to cart'}
          </Button>
        </Theme>
        <Button
          tone="outline"
          size="$5"
          borderRadius={999}
          flex={1}
          minWidth={200}
          disabled={isAddingToCart || outOfStock}
          onPress={() => handleAddToCart(true)}
        >
          {buyNowLabel}
        </Button>
      </XStack>

      {shopCard}
    </CommercePanel>
  )

  return (
    <PageScroll>
      <YStack
        padding="$4"
        paddingBottom="$10"
        width="100%"
        gap="$5"
      >
        {media.gtMd ? (
          <Link href={commerceRoutes.shops} asChild>
            <XStack alignItems="center" gap="$1" cursor="pointer" alignSelf="flex-start">
              <Icons.ArrowLeft size={16} color={ui.textSecondary} />
              <Text fontSize={13} color={ui.textSecondary} hoverStyle={{ textDecorationLine: 'underline' }}>
                Back to shops
              </Text>
            </XStack>
          </Link>
        ) : null}

        <XStack gap="$6" alignItems="flex-start">
          {imageGallery}
          {buyPanel}
        </XStack>

        {(listing.description?.trim() || specifications.length > 0) ? (
          <>
            <Separator borderColor={ui.panelBorder} />
            <ListingDetailsPanel description={listing.description} specifications={specifications} />
          </>
        ) : null}

        <Separator borderColor={ui.panelBorder} />
        <ReviewsSection
          title="Reviews for this item"
          summary={reviewSummary}
          reviews={reviews}
          isLoading={reviewsLoading}
          error={reviewsError}
        />

        <Separator borderColor={ui.panelBorder} />
        <ListingRecommendationsSections listingId={listing.id} />
      </YStack>
    </PageScroll>
  )
}