import { useEffect, useMemo, useRef, useState, memo } from 'react'
import { Alert, Platform } from 'react-native'
import { useParams } from 'one'
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
  ListingTrustSnapshot,
  ListingVariantPicker,
  LowStockHint,
  RatingSummary,
  ReviewsSection,
  StockNotifyButton,
  VerifiedBuyerHighlight,
  ListingVisualPreviewButtons,
  ShopActionButtons,
} from '~/commerce/components'
import { fetchListingReturnPolicy, type ListingReturnPolicy } from '~/commerce/lib/return-policies'
import { listingMediaKind } from '~/commerce/lib/listing-media'
import { findCartItemForListing } from '~/commerce/lib/cart-listing'
import { useCart } from '~/commerce/hooks/useCart'
import { useShopFollow } from '~/commerce/hooks/useShopFollow'
import { recordListingView } from '~/commerce/lib/recently-viewed'
import { LISTING_METADATA_KEYS } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import { useListingReviews } from '~/commerce/hooks/useListingReviews'
import { useCanonicalListingSlug } from '~/commerce/hooks/useCanonicalSlug'
import { PageCenter, PageScroll, StickyRail } from '~/components/layout'
import { DeliveryPinCheck } from '~/components/location'
import { ShareButton } from '~/components/share'
import { openComposer } from '~/community/lib/composer-store'
import { ShareListingSheet } from '~/chat/components/ShareListingSheet'
import { listingDetailToChatListing } from '~/chat/lib/listing-message'
import { useCommunityListingAttribution } from '~/community/hooks/useCommunityListingAttribution'
import { BRAND_THEME, getShadowStyle, radius } from '~/config/tokens'
import { useListing } from '~/hooks/useListing'
import { useAppLayout } from '~/hooks/useAppLayout'
import type { ListingLoaderResult } from '~/commerce/lib/listing-loader'
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
import { buildListingTrustSnapshot } from '~/commerce/lib/listing-trust-snapshot'
import { mergeReviewSummary } from '~/commerce/lib/reviews'
import { getShopSlug } from '~/lib/supabase/commerce'
import { commerceRoutes } from '~/lib/routes'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { getListingShareUrl } from '~/lib/share'
import { useAppUi } from '~/lib/theme/useAppUi'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { trackCommerceEvent } from '~/lib/analytics'
import { useSupabase } from '~/providers/SupabaseProvider'

import { BRAND_SHOP_LABEL } from '~/config/brand'
import { navigateApp } from '~/lib/platform/navigate'

type ListingScreenProps = {
  initial?: ListingLoaderResult | null
  awaitingInitial?: boolean
}

// ─── Memoized thumbnail component for desktop ──────────────────────────────

const ThumbnailImage = memo(function ThumbnailImage({
  image,
  title,
  isActive,
  onPress,
}: {
  image: { id: string; image_url: string; image_type?: string | null; alt_text?: string | null }
  title: string
  isActive: boolean
  onPress: () => void
}) {
  const ui = useAppUi()
  // Memoize the single‑element array so it doesn't change on every render
  const imageUrlArray = useMemo(() => [image.image_url], [image.image_url])

  return (
    <XStack
      width={72}
      height={72}
      borderRadius={radius.chip}
      overflow="hidden"
      borderWidth={isActive ? 2 : 1}
      borderColor={isActive ? ui.text : ui.panelBorder}
      cursor="pointer"
      onPress={onPress}
    >
      <ListingImage
        imageUrls={imageUrlArray}
        imageType={image.image_type}
        alt={image.alt_text ?? title}
        width={72}
        height={72}
        objectFit="cover"
        placeholderIconSize={20}
      />
    </XStack>
  )
})

// ─── Main ListingScreen ──────────────────────────────────────────────────────

export function ListingScreen({
  initial = null,
  awaitingInitial = false,
}: ListingScreenProps = {}) {
  const ui = useAppUi()
  const { slug } = useParams<{ slug: string }>()
  const { listing, images, variations, attributes, deliveryProfiles, isLoading, error } = useListing(
    slug,
    initial,
    { awaitingInitial },
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
  const { user } = useSupabase()
  const toast = useAppToast()
  const { hasSideRails } = useAppLayout()
  const shopFollow = useShopFollow(listing?.shop_id)
  const { fromCommunityPost, communityPostId } = useCommunityListingAttribution(listing?.id)

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
  const [optimisticInCart, setOptimisticInCart] = useState(false)
  const addingRef = useRef(false)
  const [isUpdatingQuantity, setIsUpdatingQuantity] = useState(false)
  const [personalizationNote, setPersonalizationNote] = useState('')
  const [returnPolicy, setReturnPolicy] = useState<ListingReturnPolicy | null>(null)
  const [shareChatOpen, setShareChatOpen] = useState(false)
  const variationGroups = useMemo(() => groupListingVariations(variations), [variations])
  const [variantSelection, setVariantSelection] = useState<Record<string, string>>({})

  useEffect(() => {
    setOptimisticInCart(false)
    addingRef.current = false
    setIsAddingToCart(false)
  }, [listing?.id])

  useEffect(() => {
    setGalleryLightboxOpen(false)
  }, [hasSideRails])

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

  // ─── Memoized image sorting and gallery URLs ──────────────────────────────
  const sortedImages = useMemo(() => {
    return [...images].sort(
      (a, b) => (a.is_primary ? -1 : 0) - (b.is_primary ? -1 : 0) || a.display_order - b.display_order,
    )
  }, [images])

  const galleryUrls = useMemo(() => sortedImages.map((image) => image.image_url), [sortedImages])

  const activeImage = useMemo(
    () => sortedImages[activeImageIndex] ?? sortedImages[0],
    [sortedImages, activeImageIndex],
  )

  const activeGalleryUrls = useMemo(() => {
    if (!activeImage) return []
    return [activeImage.image_url, ...galleryUrls.filter((url) => url !== activeImage.image_url)]
  }, [activeImage, galleryUrls])

  if (isLoading && !listing) {
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
  const selectedVariations = getSelectedVariations(variations, variantSelection)
  const displayPrice = getVariantPrice(listing.price, selectedVariations)
  const displayStock = getVariantStock(listing.stock, selectedVariations)
  const selectedVariantId = selectedVariations[0]?.id ?? null
  const outOfStock = displayStock === 0
  const cartItem = findCartItemForListing(cartItems, listing.id, selectedVariantId)
  const showInCart = Boolean(cartItem) || optimisticInCart
  const listingMeta =
    listing.listing_metadata && typeof listing.listing_metadata === 'object'
      ? (listing.listing_metadata as Record<string, unknown>)
      : {}
  const followersOnly = Boolean(listingMeta[LISTING_METADATA_KEYS.FOLLOWERS_ONLY])
  const isShopOwner = Boolean(user?.id && listing.shops?.user_id === user.id)
  const purchaseLocked =
    followersOnly && !isShopOwner && (!shopFollow.isFollowing || !user)

  function handleAddToCart(goToCheckout = false) {
    if (purchaseLocked) {
      toast.show('Followers only', {
        tone: 'info',
        message: 'Follow this shop to unlock purchase on this listing.',
      })
      return
    }
    if (addingRef.current || outOfStock) return
    addingRef.current = true

    // Add to cart: unlock CTA immediately (Checkout UI) so the pink button never sticks
    // on a spinner. Buy now still shows a short loading state, but only navigates after
    // the server confirms — otherwise guests land on sign-in with a failed/empty cart.
    if (!goToCheckout) {
      setOptimisticInCart(true)
      setIsAddingToCart(false)
    } else {
      setIsAddingToCart(true)
    }

    const failsafe = setTimeout(() => {
      addingRef.current = false
      setIsAddingToCart(false)
    }, 12_000)

    void (async () => {
      try {
        const { error: cartError } = await addToCart(listing.id, {
          quantity: 1,
          variantId: selectedVariantId,
          personalizationNote: personalizationNote.trim() || null,
        })

        if (cartError) {
          setOptimisticInCart(false)
          toast.show('Could not add to cart', { tone: 'danger', message: cartError, duration: 5000 })
          if (Platform.OS !== 'web') {
            Alert.alert('Could not add to cart', cartError)
          }
          return
        }

        setOptimisticInCart(true)
        setPersonalizationNote('')
        toast.show('Added to cart', { tone: 'success', duration: 2500 })
        if (goToCheckout) {
          // Guests must sign in before checkout — keep cart (session) and return here after auth.
          if (!user) {
            navigateApp(buildSignInUrl(String(commerceRoutes.checkout)))
          } else {
            navigateApp(commerceRoutes.checkout)
          }
        }
      } catch (error) {
        setOptimisticInCart(false)
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Something went wrong. Please try again.'
        toast.show('Could not add to cart', {
          tone: 'danger',
          message,
          duration: 5000,
        })
        if (Platform.OS !== 'web') {
          Alert.alert('Could not add to cart', message)
        }
      } finally {
        clearTimeout(failsafe)
        addingRef.current = false
        setIsAddingToCart(false)
      }
    })()
  }

  async function handleQuantityChange(nextQuantity: number) {
    if (!cartItem) return
    setIsUpdatingQuantity(true)
    try {
      const { error: qtyError } =
        nextQuantity <= 0
          ? await removeItem(cartItem.id)
          : await updateQuantity(cartItem.id, nextQuantity)

      if (qtyError) {
        toast.show('Could not update quantity', { tone: 'danger', message: qtyError })
      }
    } catch {
      toast.show('Could not update quantity', {
        tone: 'danger',
        message: 'Something went wrong. Please try again.',
      })
    } finally {
      setIsUpdatingQuantity(false)
    }
  }

  function goToCheckout() {
    // Require a confirmed cart line before sending guests to sign-in / checkout.
    if (!cartItem && !optimisticInCart) return
    if (!user) {
      navigateApp(buildSignInUrl(String(commerceRoutes.checkout)))
      return
    }
    navigateApp(commerceRoutes.checkout)
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
  const mobileBottomInset = LISTING_MOBILE_STICKY_BAR_HEIGHT + 16
  const listingShareSlug = slug ?? listing.id
  const chatListing = useMemo(
    () =>
      listingDetailToChatListing({
        id: listing.id,
        title: listing.title,
        price: listing.price,
        currency: listing.currency,
        slug: listing.slug,
        imageUrl: sortedImages[0]?.image_url ?? null,
        shopName: listing.shops?.shop_name ?? null,
      }),
    [listing, sortedImages],
  )
  const handleShareToCommunity = () => {
    if (!user) {
      toast.show('Sign in to share', {
        tone: 'default',
        message: 'Sign in to share this listing with your community.',
      })
      return
    }
    openComposer({
      mode: 'text',
      listingId: listing.id,
      content: `Check out ${listing.title} on SHEconomy`,
    })
  }
  const handleShareToChat = () => {
    if (!user) {
      toast.show('Sign in to share', {
        tone: 'default',
        message: 'Sign in to share this listing in chat.',
      })
      return
    }
    setShareChatOpen(true)
  }
  const listingShareButton = (
    <XStack gap="$1.5" alignItems="center">
      <Button
        tone="ghost"
        size="$3"
        borderRadius={999}
        icon={<Icons.Users size={16} />}
        onPress={handleShareToCommunity}
        accessibilityLabel="Share to Community"
      />
      <Button
        tone="ghost"
        size="$3"
        borderRadius={999}
        icon={<Icons.MessageCircle size={16} />}
        onPress={handleShareToChat}
        accessibilityLabel="Share to chat"
      />
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
    </XStack>
  )
  const shareListingSheet = (
    <ShareListingSheet
      open={shareChatOpen}
      onOpenChange={setShareChatOpen}
      currentUserId={user?.id ?? null}
      listing={chatListing}
      source="pdp"
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
    category: listing.category ?? null,
    listingType: listing.listing_type ?? null,
  }
  const trustSnapshot = buildListingTrustSnapshot({
    reviewSummary,
    reviews,
    returnPolicy,
    fulfillment: fulfillmentInfo,
    shopVerified: !!listing.shops?.verified,
    followersOnly,
    purchaseLocked,
    isDigital,
  })
  const handleOpenPolicies = () => {
    if (!listing.shops) return
    navigateApp(commerceRoutes.shopReturns(getShopSlug(listing.shops)))
  }

  // ─── Mobile layout ──────────────────────────────────────────────────────────
  if (!hasSideRails) {
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
              {fromCommunityPost && communityPostId ? (
                <CommunityAttributionStrip postId={communityPostId} />
              ) : null}
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

              {followersOnly ? (
                <XStack
                  gap="$2"
                  alignItems="flex-start"
                  padding="$3"
                  borderRadius={12}
                  backgroundColor={ui.roseSurface}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                >
                  <Icons.Users size={16} color={ui.brand} marginTop={2} />
                  <YStack flex={1} gap="$2">
                    <Text fontSize={13} fontWeight="700" color={ui.text}>
                      Followers-only listing
                    </Text>
                    <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
                      {purchaseLocked
                        ? 'Follow this shop to unlock Add to cart and Buy now.'
                        : 'Thanks for following — you can purchase this perk listing.'}
                    </Text>
                    {purchaseLocked && listing.shops?.id ? (
                      <ShopActionButtons
                        shopId={listing.shops.id}
                        ownerUserId={listing.shops.user_id}
                      />
                    ) : null}
                  </YStack>
                </XStack>
              ) : null}

              <ListingTrustSnapshot
                snapshot={trustSnapshot}
                shopId={listing.shops?.id}
                ownerUserId={listing.shops?.user_id}
                onOpenPolicies={handleOpenPolicies}
              />

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

              {trustSnapshot.buyerHighlight ? (
                <>
                  <Separator borderColor={ui.panelBorder} />
                  <VerifiedBuyerHighlight snapshot={trustSnapshot} />
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
          </YStack>
        </PageScroll>

        <ListingMobileStickyBuyBar
          price={displayPrice}
          mrp={listing.mrp}
          priceIncludesTax={listing.price_includes_tax}
          taxPercent={listing.tax_percent}
          currency={currency}
          disabled={(outOfStock && !showInCart) || purchaseLocked}
          isLoading={isAddingToCart}
          inCart={showInCart}
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
        {shareListingSheet}
      </YStack>
    )
  }

  // ─── Desktop layout ──────────────────────────────────────────────────────────

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
              displaySize={{ width: 1200, height: 1200, quality: 78, resize: 'cover' }}
            />
          ) : (
            <YStack flex={1} alignItems="center" justifyContent="center">
              <Icons.Image size={48} color={ui.textMuted} />
            </YStack>
          )}
          <FavoriteButton listingId={listing.id} size={20} restockEligible={outOfStock} />
        </YStack>

        {sortedImages.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <XStack gap="$2">
              {sortedImages.map((image, index) => (
                <ThumbnailImage
                  key={image.id}
                  image={image}
                  title={listing.title}
                  isActive={activeImageIndex === index}
                  onPress={() => setActiveImageIndex(index)}
                />
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
      {fromCommunityPost && communityPostId ? (
        <CommunityAttributionStrip postId={communityPostId} />
      ) : null}
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

      <ListingTrustSnapshot
        snapshot={trustSnapshot}
        shopId={listing.shops?.id}
        ownerUserId={listing.shops?.user_id}
        onOpenPolicies={handleOpenPolicies}
      />

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

      {showInCart ? (
        <XStack gap="$3" flexWrap="wrap" alignItems="center">
          <ListingQuantityStepper
            quantity={cartItem?.quantity ?? 1}
            maxQuantity={displayStock}
            disabled={isUpdatingQuantity || !cartItem}
            onDecrease={() => cartItem && handleQuantityChange(cartItem.quantity - 1)}
            onIncrease={() => cartItem && handleQuantityChange(cartItem.quantity + 1)}
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
              disabled={addingRef.current || outOfStock || purchaseLocked}
              onPress={() => handleAddToCart(false)}
            >
              {purchaseLocked ? 'Follow to unlock' : outOfStock ? 'Out of stock' : 'Add to cart'}
            </Button>
          </Theme>
          <Button
            tone="outline"
            size="$5"
            borderRadius={999}
            flex={1}
            minWidth={200}
            disabled={addingRef.current || outOfStock || purchaseLocked}
            onPress={() => handleAddToCart(true)}
          >
            {purchaseLocked ? 'Followers only' : buyNowLabel}
          </Button>
        </XStack>
      )}

      {shopCard}
    </CommercePanel>
  )

  return (
    <>
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

        {trustSnapshot.buyerHighlight ? (
          <>
            <Separator borderColor={ui.panelBorder} />
            <VerifiedBuyerHighlight snapshot={trustSnapshot} />
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
    {shareListingSheet}
    </>
  )
}