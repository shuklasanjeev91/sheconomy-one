import { useEffect, useMemo, useState } from 'react'
import { useLoader, useParams, useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import {
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
import { MediaLightbox } from '~/components/media/MediaLightbox'
import {
  AvailableOffersCard,
  CommercePanel,
  FavoriteButton,
  GetItByChip,
  ListingAskQuestion,
  ListingDetailsPanel,
  ListingFulfillmentPanel,
  ListingImage,
  ListingMobileGallery,
  ListingMobileStickyBuyBar,
  LISTING_MOBILE_STICKY_BAR_HEIGHT,
  ListingPersonalizationNote,
  ListingPriceBlock,
  ListingQuantityStepper,
  ListingRecommendationsSections,
  ListingReturnPolicyCard,
  ListingSellerCard,
  ListingShopPolicies,
  ListingVariantPicker,
  LowStockHint,
  RatingSummary,
  ReviewsSection,
  StockNotifyButton,
  ListingVisualPreviewButtons,
} from '~/commerce/components'
import { fetchListingReturnPolicy, type ListingReturnPolicy } from '~/commerce/lib/return-policies'
import { listingMediaKind } from '~/commerce/lib/listing-media'
import { findCartItemForListing } from '~/commerce/lib/cart-listing'
import { useCart } from '~/commerce/hooks/useCart'
import { recordListingView } from '~/commerce/lib/recently-viewed'
import { useListingReviews } from '~/commerce/hooks/useListingReviews'
import { useCanonicalListingSlug } from '~/commerce/hooks/useCanonicalSlug'
import { PageCenter, PageScroll, StickyRail } from '~/components/layout'
import { DeliveryPinCheck } from '~/components/location'
import { ShareButton } from '~/components/share'
import { BRAND_THEME, getShadowStyle, radius } from '~/config/tokens'
import { useListing } from '~/hooks/useListing'
import { listingLoader } from '~/commerce/lib/listing-loader'
import {
  buildListingSpecifications,
  getDefaultVariantSelection,
  getSelectedVariations,
  getVariantPrice,
  getVariantStock,
  groupListingVariations,
} from '~/commerce/lib/listing-detail'
import {
  buildManufacturingSpecifications,
  parseListingProductInfo,
} from '~/commerce/lib/listing-product-info'
import {
  buildListingFulfillmentInfo,
  isDigitalListing,
  resolveDeliveryProfile,
} from '~/commerce/lib/listing-fulfillment'
import { buildListingShopPolicies } from '~/commerce/lib/shop-policies'
import { buildShopShippingSummary } from '~/commerce/lib/shop-shipping'
import { mergeReviewSummary } from '~/commerce/lib/reviews'
import { getShopSlug } from '~/lib/supabase/commerce'
import { commerceRoutes } from '~/lib/routes'
import { getListingShareUrl } from '~/lib/share'
import { useAppUi } from '~/lib/theme/useAppUi'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { trackCommerceEvent } from '~/lib/analytics'

import { BRAND_SHOP_LABEL } from '~/config/brand'

export async function loader(props: Parameters<typeof listingLoader>[0]) {
  return listingLoader(props)
}

export default function ListingDetailScreen() {
  const ui = useAppUi()
  const { slug } = useParams<{ slug: string }>()
  const loaderResult = useLoader(loader)
  const { listing, images, variations, attributes, deliveryProfiles, isLoading, error } = useListing(
    slug,
    loaderResult,
  )
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
  const { addToCart, items: cartItems, updateQuantity, removeItem } = useCart()
  const toast = useAppToast()
  const router = useRouter()
  const media = useMedia()
  /**
   * SSR always paints the mobile tree (`gtMd` defaults false). Switching to the
   * desktop tree on the first client media update unmounts portal hosts
   * (ShareSheet / MediaLightbox) mid-reconcile and can throw removeChild.
   * Wait until after mount before allowing the desktop branch.
   */
  const [layoutReady, setLayoutReady] = useState(false)
  useEffect(() => {
    setLayoutReady(true)
  }, [])
  const isDesktop = layoutReady && media.gtMd

  usePageSeo(
    useMemo(() => {
      if (!listing) return null
      const primaryImage =
        images.find((image) => image.is_primary)?.image_url ?? images[0]?.image_url ?? null
      const plainDescription = (listing.description ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200)
      return {
        title: listing.title,
        description: plainDescription || undefined,
        image: primaryImage,
        type: 'product' as const,
        canonicalPath: String(commerceRoutes.listing(slug ?? listing.slug ?? listing.id)),
      }
    }, [listing, images, slug]),
  )

  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [galleryLightboxOpen, setGalleryLightboxOpen] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [isUpdatingQuantity, setIsUpdatingQuantity] = useState(false)
  const [personalizationNote, setPersonalizationNote] = useState('')
  const [returnPolicy, setReturnPolicy] = useState<ListingReturnPolicy | null>(null)
  const variationGroups = useMemo(() => groupListingVariations(variations), [variations])
  const [variantSelection, setVariantSelection] = useState<Record<string, string>>({})

  useEffect(() => {
    setGalleryLightboxOpen(false)
  }, [isDesktop])

  useEffect(() => {
    setVariantSelection(getDefaultVariantSelection(variationGroups))
  }, [listing?.id, variationGroups])

  useEffect(() => {
    if (!listing?.id) return
    recordListingView(listing.id)
    trackCommerceEvent('view_item', {
      currency: listing.shops?.shop_currency ?? 'INR',
      value: listing.price ?? undefined,
      items: [
        {
          id: listing.id,
          name: listing.title,
          category: listing.category ?? undefined,
          price: listing.price ?? undefined,
          quantity: 1,
        },
      ],
    })
  }, [listing?.id])

  useEffect(() => {
    if (!listing?.id) {
      setReturnPolicy(null)
      return
    }
    let active = true
    void fetchListingReturnPolicy(listing.id, listing.shop_id).then((policy) => {
      if (active) setReturnPolicy(policy)
    })
    return () => {
      active = false
    }
  }, [listing?.id, listing?.shop_id])

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
          <AppLink href={commerceRoutes.home} asChild>
            <Button tone="outline" size="$4" alignSelf="flex-start" borderRadius={999}>
              Browse marketplace
            </Button>
          </AppLink>
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
  const cartItem = findCartItemForListing(cartItems, listing.id, selectedVariantId)

  async function handleAddToCart(goToCheckout = false) {
    setIsAddingToCart(true)
    const { error: cartError } = await addToCart(listing.id, {
      quantity: 1,
      variantId: selectedVariantId,
      personalizationNote: personalizationNote.trim() || null,
    })
    setIsAddingToCart(false)

    if (cartError) {
      toast.show('Could not add to cart', { tone: 'danger', message: cartError })
      return
    }

    setPersonalizationNote('')
    toast.show('Added to cart', { tone: 'success' })
    if (goToCheckout) {
      router.push(commerceRoutes.checkout)
    }
  }

  async function handleQuantityChange(nextQuantity: number) {
    if (!cartItem) return
    setIsUpdatingQuantity(true)
    const { error: qtyError } =
      nextQuantity <= 0
        ? await removeItem(cartItem.id)
        : await updateQuantity(cartItem.id, nextQuantity)
    setIsUpdatingQuantity(false)

    if (qtyError) {
      toast.show('Could not update quantity', { tone: 'danger', message: qtyError })
    }
  }

  function goToCheckout() {
    router.push(commerceRoutes.checkout)
  }

  const specifications = buildListingSpecifications({
    sku: selectedVariations[0]?.sku ?? listing.sku,
    weight: listing.weight,
    dimensions: listing.dimensions,
    category: listing.category,
    listingType: listing.listing_type,
    attributes,
    tags: listing.tags,
    productInfoSpecs: buildManufacturingSpecifications(
      parseListingProductInfo(listing.product_info, listing.listing_metadata),
    ),
  })

  const fulfillmentInput = {
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
  }

  const fulfillmentInfo = buildListingFulfillmentInfo(fulfillmentInput)
  const deliveryProfile = resolveDeliveryProfile(fulfillmentInput)
  const shopPolicies = buildListingShopPolicies({
    fulfillment: fulfillmentInfo,
    returnPolicy,
    deliveryProfile,
    currency,
  })

  const isDigital = isDigitalListing(listing.listing_type)
  const buyNowLabel = isDigital ? 'Buy & download' : 'Buy it now'
  /** PageScroll already insets for the tab bar; only clear the sticky buy bar. */
  const mobileBottomInset = LISTING_MOBILE_STICKY_BAR_HEIGHT + 16
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

  const visualPreviewButtons = (
    <ListingVisualPreviewButtons
      listingId={listing.id}
      listingTitle={listing.title}
      category={listing.category}
      tags={Array.isArray(listing.tags) ? listing.tags : null}
      listingMetadata={
        listing.listing_metadata && typeof listing.listing_metadata === 'object'
          ? (listing.listing_metadata as Record<string, unknown>)
          : null
      }
      hasPrimaryImage={sortedImages.length > 0}
      listingImageUrl={sortedImages[0]?.image_url ?? null}
      listingShareUrl={getListingShareUrl(listingShareSlug)}
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
    <ListingSellerCard
      shopId={listing.shops.id}
      shopName={listing.shops.shop_name}
      shopSlug={getShopSlug(listing.shops)}
      logoUrl={listing.shops.logo_url}
      verified={!!listing.shops.verified}
      reviewSummary={shopReviewSummary}
      ownerUserId={listing.shops.user_id}
    />
  ) : null

  const recommendationProps = {
    listingId: listing.id,
    shopId: listing.shop_id,
    shopName: listing.shops?.shop_name ?? null,
    shopSlug: listing.shops ? getShopSlug(listing.shops) : null,
  }

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
                <ListingPriceBlock
                  price={displayPrice}
                  mrp={listing.mrp}
                  currency={currency}
                  priceIncludesTax={listing.price_includes_tax}
                  taxPercent={listing.tax_percent}
                  size="lg"
                />
                {fulfillmentInfo?.kind === 'physical' && fulfillmentInfo.estimatedDeliveryLabel ? (
                  <GetItByChip label={fulfillmentInfo.estimatedDeliveryLabel} />
                ) : null}
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

              {fulfillmentInfo?.kind === 'physical' ? (
                <DeliveryPinCheck
                  shopId={listing.shop_id}
                  listingId={listing.id}
                  listingType={listing.listing_type}
                  compact
                />
              ) : null}

              {displayStock != null ? (
                <YStack gap="$2">
                  <Text fontSize={13} color={displayStock > 0 ? ui.success : ui.error} fontWeight="500">
                    {displayStock > 0 ? `${displayStock} in stock` : 'Out of stock'}
                  </Text>
                  <LowStockHint stock={displayStock} />
                  <StockNotifyButton listingId={listing.id} outOfStock={outOfStock} />
                  <ListingAskQuestion
                    listingId={listing.id}
                    shopId={listing.shop_id}
                    sellerId={listing.shops?.user_id}
                    listingTitle={listing.title}
                  />
                  {visualPreviewButtons}
                </YStack>
              ) : (
                <YStack gap="$2">
                  <ListingAskQuestion
                    listingId={listing.id}
                    shopId={listing.shop_id}
                    sellerId={listing.shops?.user_id}
                    listingTitle={listing.title}
                  />
                  {visualPreviewButtons}
                </YStack>
              )}

              {returnPolicy ? <ListingReturnPolicyCard policy={returnPolicy} /> : null}

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

              <ListingPersonalizationNote
                value={personalizationNote}
                onChange={setPersonalizationNote}
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

              {shopPolicies ? (
                <YStack gap="$4" paddingTop="$2">
                  <Separator borderColor={ui.panelBorder} />
                  <ListingShopPolicies policies={shopPolicies} />
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
              <ListingRecommendationsSections {...recommendationProps} />
            </YStack>
          </YStack>
        </PageScroll>

        <ListingMobileStickyBuyBar
          price={displayPrice}
          mrp={listing.mrp}
          priceIncludesTax={listing.price_includes_tax}
          taxPercent={listing.tax_percent}
          currency={currency}
          disabled={outOfStock && !cartItem}
          isLoading={isAddingToCart}
          inCart={!!cartItem}
          quantity={cartItem?.quantity ?? 1}
          maxQuantity={displayStock}
          isUpdatingQuantity={isUpdatingQuantity}
          label="Add to cart"
          buyNowLabel={isDigital ? 'Download' : 'Buy now'}
          onPress={() => handleAddToCart(false)}
          onBuyNow={() => handleAddToCart(true)}
          onIncreaseQuantity={() => handleQuantityChange((cartItem?.quantity ?? 1) + 1)}
          onDecreaseQuantity={() => handleQuantityChange((cartItem?.quantity ?? 1) - 1)}
          onCheckout={goToCheckout}
        />
      </YStack>
    )
  }

  const imageGallery = (
    <StickyRail flex={1.2} minWidth={0} width="100%" maxWidth="100%">
      <YStack gap="$3" width="100%">
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
          cursor={activeGalleryUrls.length > 0 ? 'zoom-in' : undefined}
          onPress={
            activeGalleryUrls.length > 0
              ? () => setGalleryLightboxOpen(true)
              : undefined
          }
        >
          {activeGalleryUrls.length > 0 ? (
            <ListingImage
              imageUrls={activeGalleryUrls}
              imageType={activeImage?.image_type}
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
                    imageType={image.image_type}
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

        {sortedImages.length > 0 ? (
          <MediaLightbox
            items={sortedImages.map((image) => ({
              url: image.image_url,
              kind: listingMediaKind(image.image_url, image.image_type),
              alt: image.alt_text ?? listing.title,
            }))}
            open={galleryLightboxOpen}
            onOpenChange={setGalleryLightboxOpen}
            initialIndex={activeImageIndex}
          />
        ) : null}
      </YStack>
    </StickyRail>
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

      <ListingPriceBlock
        price={displayPrice}
        mrp={listing.mrp}
        currency={currency}
        priceIncludesTax={listing.price_includes_tax}
        taxPercent={listing.tax_percent}
        size="lg"
      />

      {fulfillmentInfo?.kind === 'physical' && fulfillmentInfo.estimatedDeliveryLabel ? (
        <GetItByChip label={fulfillmentInfo.estimatedDeliveryLabel} />
      ) : null}

      {fulfillmentInfo ? <ListingFulfillmentPanel info={fulfillmentInfo} /> : null}

      {fulfillmentInfo?.kind === 'physical' ? (
        <DeliveryPinCheck
          shopId={listing.shop_id}
          listingId={listing.id}
          listingType={listing.listing_type}
          country={listing.shops ? undefined : 'IN'}
        />
      ) : null}

      {displayStock != null ? (
        <YStack gap="$2">
          <Text fontSize={13} color={displayStock > 0 ? ui.success : ui.error} fontWeight="500">
            {displayStock > 0 ? `${displayStock} in stock` : 'Out of stock'}
          </Text>
          <LowStockHint stock={displayStock} />
          <StockNotifyButton listingId={listing.id} outOfStock={outOfStock} />
          <ListingAskQuestion
            listingId={listing.id}
            shopId={listing.shop_id}
            sellerId={listing.shops?.user_id}
            listingTitle={listing.title}
          />
          {visualPreviewButtons}
        </YStack>
      ) : (
        <YStack gap="$2">
          <ListingAskQuestion
            listingId={listing.id}
            shopId={listing.shop_id}
            sellerId={listing.shops?.user_id}
            listingTitle={listing.title}
          />
          {visualPreviewButtons}
        </YStack>
      )}

      {returnPolicy ? <ListingReturnPolicyCard policy={returnPolicy} /> : null}

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

      <ListingPersonalizationNote
        value={personalizationNote}
        onChange={setPersonalizationNote}
      />

      {cartItem ? (
        <XStack gap="$3" flexWrap="wrap" alignItems="center">
          <ListingQuantityStepper
            quantity={cartItem.quantity}
            maxQuantity={displayStock}
            disabled={isUpdatingQuantity}
            onDecrease={() => handleQuantityChange(cartItem.quantity - 1)}
            onIncrease={() => handleQuantityChange(cartItem.quantity + 1)}
          />
          <Theme name={BRAND_THEME}>
            <Button
              tone="primary"
              size="$5"
              flex={1}
              minWidth={200}
              borderRadius={999}
              onPress={goToCheckout}
            >
              Checkout
            </Button>
          </Theme>
        </XStack>
      ) : (
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
      )}

      {shopCard}
    </CommercePanel>
  )

  return (
    <PageScroll>
      <YStack
        padding="$4"
        paddingBottom="$2"
        width="100%"
        gap="$5"
      >
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

        {shopPolicies ? (
          <>
            <Separator borderColor={ui.panelBorder} />
            <ListingShopPolicies policies={shopPolicies} />
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
        <ListingRecommendationsSections {...recommendationProps} />
      </YStack>
    </PageScroll>
  )
}