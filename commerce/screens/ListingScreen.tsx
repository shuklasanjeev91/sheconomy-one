import { useEffect, useMemo, useRef, useState, memo } from 'react'
import { Alert, Platform } from 'react-native'
import { useParams } from 'one'

import { AI_NAME } from '~/config/brand'
import { useAiAssistOptional } from '~/providers/ai-assist-context'
import {
  Button,
  Icons,
  ScrollView,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { MediaLightbox } from '~/components/media/MediaLightbox'
import {
  AvailableOffersCard,
  FavoriteButton,
  GetItByChip,
  ListingDetailsPanel,
  ListingFulfillmentPanel,
  ListingImage,
  ListingMobileGallery,
  ListingMobileStickyBuyBar,
  LISTING_MOBILE_STICKY_BAR_HEIGHT,
  ListingPriceBlock,
  ListingQuantityStepper,
  ListingRecommendationsSections,
  ListingReturnPolicyCard,
  ListingSellerCard,
  ListingShopPolicies,
  ListingVariantPicker,
  LowStockHint,
  MarketplaceBuyBox,
  MarketplaceCard,
  MarketplaceEmptyState,
  MarketplacePage,
  MarketplacePdpSection,
  MarketplacePdpShopLink,
  MarketplacePdpTitle,
  MarketplacePrimaryButton,
  MarketplaceSecondaryButton,
  MarketplaceTrustNote,
  RatingSummary,
  ReviewsSection,
  ShipsToYouWidget,
  StockNotifyButton,
  VerifiedBuyerHighlight,
  ListingVisualPreviewButtons,
  ShopActionButtons,
} from '~/commerce/components'
import {
  ListingBundleOffer,
  ListingPreorderNote,
  ListingReorderScheduleCard,
} from '~/commerce/components/ListingCommerceExtras'
import { fetchListingReturnPolicy, type ListingReturnPolicy } from '~/commerce/lib/return-policies'
import { listingMediaKind } from '~/commerce/lib/listing-media'
import { findCartItemForListing } from '~/commerce/lib/cart-listing'
import { useCart } from '~/commerce/hooks/useCart'
import { useShopFollow } from '~/commerce/hooks/useShopFollow'
import { recordListingView } from '~/commerce/lib/recently-viewed'
import { LISTING_METADATA_KEYS } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import { readMetadataBoolean } from '~/commerce/components/vendor/listing-publish/listing-publish.utils'
import { useListingReviews } from '~/commerce/hooks/useListingReviews'
import { useCanonicalListingSlug } from '~/commerce/hooks/useCanonicalSlug'
import { FullWidthLayout, LAYOUT_STRETCH, PageCenter, PageSection, StickyRail } from '~/components/layout'
import { ShareActionRow, ShareSheet } from '~/components/share'
import { openComposer } from '~/community/lib/composer-store'
import { ShareListingSheet } from '~/chat/components/ShareListingSheet'
import { listingDetailToChatListing } from '~/chat/lib/listing-message'
import { CommunityAttributionStrip } from '~/community/components/CommunityAttributionStrip'
import { PostedAtPriceChip } from '~/community/components/PostedAtPriceChip'
import { PostSiblingProductsRail } from '~/community/components/PostSiblingProductsRail'
import { useCommunityListingAttribution } from '~/community/hooks/useCommunityListingAttribution'
import { radius } from '~/config/tokens'
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
import { productJsonLd } from '~/lib/seo/json-ld'
import { buildAbsoluteUrl } from '~/lib/platform/url'
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
  const ai = useAiAssistOptional()
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
  const {
    addToCart,
    addBundleToCart,
    items: cartItems,
    updateQuantity,
    removeItem,
    refresh: refreshCart,
  } = useCart()
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
      const canonicalPath = String(commerceRoutes.listing(slug ?? listing.slug ?? listing.id))
      const url = buildAbsoluteUrl(canonicalPath)
      const stock = listing.stock
      const quantity = listing.quantity
      const inStock =
        listing.listing_status === 'active' &&
        (stock == null || stock > 0) &&
        (quantity == null || quantity > 0)
      return {
        title: listing.title,
        description: plainDescription || undefined,
        image: primaryImage,
        type: 'product' as const,
        canonicalPath,
        jsonLd: productJsonLd({
          name: listing.title,
          description: plainDescription,
          image: primaryImage,
          url,
          price: listing.price,
          currency: listing.shops?.shop_currency,
          inStock,
        }),
      }
    }, [listing, images, slug]),
  )

  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [galleryLightboxOpen, setGalleryLightboxOpen] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [optimisticInCart, setOptimisticInCart] = useState(false)
  const addingRef = useRef(false)
  const [isUpdatingQuantity, setIsUpdatingQuantity] = useState(false)
  const [shipsToYouLabel, setShipsToYouLabel] = useState<string | null>(null)
  const [returnPolicy, setReturnPolicy] = useState<ListingReturnPolicy | null>(null)
  const [shareChatOpen, setShareChatOpen] = useState(false)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const variationGroups = useMemo(() => groupListingVariations(variations), [variations])
  const [variantSelection, setVariantSelection] = useState<Record<string, string>>({})

  useEffect(() => {
    setOptimisticInCart(false)
    addingRef.current = false
    setIsAddingToCart(false)
    setShipsToYouLabel(null)
  }, [listing?.id])

  useEffect(() => {
    setGalleryLightboxOpen(false)
  }, [hasSideRails])

  useEffect(() => {
    setVariantSelection((current) => {
      const next = getDefaultVariantSelection(variationGroups)
      const keys = Object.keys(next)
      if (
        keys.length === Object.keys(current).length &&
        keys.every((key) => current[key] === next[key])
      ) {
        return current
      }
      return next
    })
    // Reset only when the listing identity changes — `variationGroups` is derived
    // and must not re-trigger setState every render (React #185).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listing id gate
  }, [listing?.id])

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

  // Must stay above loading/error early returns — calling useMemo only after
  // listing resolves triggers React #310 ("Rendered more hooks than previous render").
  const chatListing = useMemo(
    () =>
      listing
        ? listingDetailToChatListing({
            id: listing.id,
            title: listing.title,
            price: listing.price,
            currency: listing.currency,
            slug: listing.slug,
            imageUrl: sortedImages[0]?.image_url ?? null,
            shopName: listing.shops?.shop_name ?? null,
          })
        : null,
    [listing, sortedImages],
  )

  if (isLoading && !listing) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (error || !listing) {
    return (
      <FullWidthLayout scroll>
        <PageSection paddingVertical="$8" {...LAYOUT_STRETCH}>
          <MarketplacePage hasSideRails={hasSideRails}>
            <MarketplaceEmptyState
              hasSideRails={hasSideRails}
              icon={<Icons.Search size={44} color={ui.brand} />}
              title="Listing not found"
              subtitle={error ?? 'This listing could not be loaded.'}
              action={
                <YStack width={hasSideRails ? 280 : '100%'}>
                  <MarketplacePrimaryButton onPress={() => navigateApp(commerceRoutes.home)}>
                    Browse marketplace
                  </MarketplacePrimaryButton>
                </YStack>
              }
            />
          </MarketplacePage>
        </PageSection>
      </FullWidthLayout>
    )
  }

  const currency = listing.shops?.shop_currency ?? 'INR'
  const selectedVariations = getSelectedVariations(variations, variantSelection)
  const displayPrice = getVariantPrice(listing.price, selectedVariations)
  const displayStock = getVariantStock(listing.stock, selectedVariations)
  const selectedVariantId = selectedVariations[0]?.id ?? null
  const listingMeta =
    listing.listing_metadata && typeof listing.listing_metadata === 'object'
      ? (listing.listing_metadata as Record<string, unknown>)
      : {}
  const outOfStock = displayStock === 0
  const allowPreorder = readMetadataBoolean(listingMeta, LISTING_METADATA_KEYS.ALLOW_PREORDER, false)
  const cartItem = findCartItemForListing(cartItems, listing.id, selectedVariantId)
  const showInCart = Boolean(cartItem) || optimisticInCart
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
    if (addingRef.current || (outOfStock && !allowPreorder)) return
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
    // Always open checkout (or sign-in→checkout). Do not no-op when the cart line is
    // still syncing after add — that left buyers stuck on the listing page.
    const href = user
      ? commerceRoutes.checkout
      : buildSignInUrl(String(commerceRoutes.checkout))
    void (async () => {
      if (!cartItem) {
        try {
          await refreshCart()
        } catch {
          // Navigation still proceeds — checkout will re-load the cart.
        }
      }
      navigateApp(href)
    })()
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
  // Return policy is already shown as ListingReturnPolicyCard in the buy box —
  // omit it here so "Shop Return Policy" does not render twice on the PDP.
  const shopPolicies = buildListingShopPolicies({
    fulfillment: fulfillmentInfo,
    returnPolicy: null,
    deliveryProfile,
    currency,
  })

  const isDigital = isDigitalListing(listing.listing_type)
  const buyNowLabel = isDigital ? 'Buy & download' : 'Buy it now'
  const mobileBottomInset = LISTING_MOBILE_STICKY_BAR_HEIGHT + 16
  const listingShareSlug = slug ?? listing.id
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
  const listingSharePayload = {
    url: getListingShareUrl(listingShareSlug),
    title: listing.title,
    text: listing.shops?.shop_name
      ? `${listing.title} from ${listing.shops.shop_name} on SHEconomy`
      : `${listing.title} on SHEconomy`,
  }

  // Single Share control — WhatsApp / copy / social / Community / Chat live in the sheet.
  const listingShareButton = (
    <>
      <Button
        tone="ghost"
        size="$3"
        borderRadius={999}
        icon={<Icons.Share2 size={18} />}
        accessibilityLabel="Share listing"
        onPress={() => setShareMenuOpen(true)}
      />
      <ShareSheet
        open={shareMenuOpen}
        onOpenChange={setShareMenuOpen}
        payload={listingSharePayload}
        title="Share this listing"
        copyLabel="Copy listing link"
        copyToastMessage="Listing link copied to clipboard."
        extraActions={
          <>
            <ShareActionRow
              icon={Icons.PenLine}
              label="Post to Community"
              onPress={() => {
                setShareMenuOpen(false)
                handleShareToCommunity()
              }}
            />
            <ShareActionRow
              icon={Icons.MessageCircle}
              label="Send in Chat"
              onPress={() => {
                setShareMenuOpen(false)
                handleShareToChat()
              }}
            />
          </>
        }
      />
    </>
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

  const askSherpaButton = ai ? (
    <Button
      tone="outline"
      size="$4"
      width="100%"
      borderRadius={8}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      hoverStyle={{ backgroundColor: ui.surfaceHover, borderColor: ui.brand }}
      icon={<Icons.Sparkles size={16} color={ui.brand} />}
      onPress={() => {
        const listingSlug = slug ?? listing.slug ?? listing.id
        ai.openAssist({
          product: 'commerce',
          contextPage: 'listing',
          context: {
            listing_id: listing.id,
            listing_slug: listingSlug,
            listing_title: listing.title,
            listing_category: listing.category,
            route: `/listing/${listingSlug}`,
          },
          prompt: 'Tell me about this product',
          autoSend: true,
        })
      }}
    >
      Ask {AI_NAME} about this product
    </Button>
  ) : null

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

  const shopSlug = listing.shops ? getShopSlug(listing.shops) : null
  const openShop = shopSlug ? () => navigateApp(commerceRoutes.shop(shopSlug)) : undefined

  const followersOnlyBanner = followersOnly ? (
    <XStack
      gap="$2"
      alignItems="flex-start"
      padding="$3.5"
      borderRadius={14}
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
            ? 'Follow this shop to unlock Add to cart and Buy it now.'
            : 'Thanks for following — you can purchase this perk listing.'}
        </Text>
        {purchaseLocked && listing.shops?.id ? (
          <ShopActionButtons shopId={listing.shops.id} ownerUserId={listing.shops.user_id} />
        ) : null}
      </YStack>
    </XStack>
  ) : null

  const stockAndExtras = (
    <YStack gap="$2.5" width="100%">
      {displayStock != null ? (
        <Text fontSize={13} color={displayStock > 0 ? ui.success : ui.error} fontWeight="600">
          {displayStock > 0
            ? `${displayStock} in stock`
            : allowPreorder
              ? 'Pre-order available'
              : 'Out of stock'}
        </Text>
      ) : null}
      <ListingPreorderNote metadata={listingMeta} />
      {displayStock != null ? <LowStockHint stock={displayStock} /> : null}
      <StockNotifyButton listingId={listing.id} outOfStock={outOfStock && !allowPreorder} />
      <ListingBundleOffer
        listingId={listing.id}
        onAddBundle={async (bundleId) => {
          const { error } = await addBundleToCart(bundleId)
          if (error) toast.show(error, { tone: 'danger' })
          else toast.show('Bundle added to cart', { tone: 'success' })
        }}
      />
      <ListingReorderScheduleCard listingId={listing.id} metadata={listingMeta} />
      {askSherpaButton}
      {visualPreviewButtons}
    </YStack>
  )

  const lowerSections = (
    <YStack gap="$4" width="100%">
      {(listing.description?.trim() || specifications.length > 0) ? (
        <MarketplaceCard hasSideRails={hasSideRails}>
          <ListingDetailsPanel description={listing.description} specifications={specifications} />
        </MarketplaceCard>
      ) : null}

      {shopPolicies ? (
        <MarketplaceCard hasSideRails={hasSideRails}>
          <ListingShopPolicies policies={shopPolicies} />
        </MarketplaceCard>
      ) : null}

      {trustSnapshot.buyerHighlight ? (
        <MarketplaceCard hasSideRails={hasSideRails}>
          <VerifiedBuyerHighlight snapshot={trustSnapshot} />
        </MarketplaceCard>
      ) : null}

      <MarketplacePdpSection title="Reviews for this item" hasSideRails={hasSideRails}>
        <ReviewsSection
          title="Reviews for this item"
          summary={reviewSummary}
          reviews={reviews}
          isLoading={reviewsLoading}
          error={reviewsError}
          hideTitle
        />
      </MarketplacePdpSection>

      <ListingRecommendationsSections {...recommendationProps} />
    </YStack>
  )

  // Only show the green chip once we have a real date — never the "Enter ZIP…" prompt.
  const deliveryChipLabel =
    shipsToYouLabel ||
    (fulfillmentInfo?.kind === 'physical' && fulfillmentInfo.hasDeliveryEstimate
      ? fulfillmentInfo.estimatedDeliveryLabel
      : null)

  // Physical: one ZIP widget (no duplicate "Enter ZIP" fulfillment card).
  // Digital: download panel only.
  const deliveryBlock =
    fulfillmentInfo?.kind === 'digital' ? (
      <ListingFulfillmentPanel info={fulfillmentInfo} />
    ) : fulfillmentInfo?.kind === 'physical' ? (
      <YStack gap="$2" width="100%">
        <ShipsToYouWidget
          onEstimate={(estimate) => setShipsToYouLabel(estimate?.label ?? null)}
        />
        <Text fontSize={12} color={ui.textSecondary} lineHeight={17}>
          {[fulfillmentInfo.processingLabel, fulfillmentInfo.shippingCostLabel]
            .filter(Boolean)
            .join(' · ')}
          {fulfillmentInfo.shipsFromLabel ? ` · ${fulfillmentInfo.shipsFromLabel}` : ''}
        </Text>
      </YStack>
    ) : null

  const deliveryBlockCompact =
    fulfillmentInfo?.kind === 'digital' ? (
      <ListingFulfillmentPanel info={fulfillmentInfo} compact />
    ) : fulfillmentInfo?.kind === 'physical' ? (
      <YStack gap="$2" width="100%">
        <ShipsToYouWidget
          compact
          onEstimate={(estimate) => setShipsToYouLabel(estimate?.label ?? null)}
        />
        <Text fontSize={12} color={ui.textSecondary} lineHeight={17}>
          {[fulfillmentInfo.processingLabel, fulfillmentInfo.shippingCostLabel]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </YStack>
    ) : null

  // ─── Mobile layout ──────────────────────────────────────────────────────────
  if (!hasSideRails) {
    return (
      <YStack flex={1} width="100%" backgroundColor={ui.surfaceMuted} position="relative">
        <FullWidthLayout scroll>
          <YStack width="100%" paddingBottom={mobileBottomInset}>
            <ListingMobileGallery
              images={sortedImages}
              title={listing.title}
              listingId={listing.id}
              activeIndex={activeImageIndex}
              onIndexChange={setActiveImageIndex}
            />

            <MarketplacePage hasSideRails={false} paddingBottom={0} flush>
              <MarketplaceCard hasSideRails={false} gap="$4">
                {fromCommunityPost && communityPostId ? (
                  <CommunityAttributionStrip postId={communityPostId} />
                ) : null}
                {fromCommunityPost && communityPostId && listing?.id ? (
                  <PostSiblingProductsRail postId={communityPostId} listingId={listing.id} />
                ) : null}

                <XStack alignItems="center" justifyContent="space-between" gap="$2" width="100%">
                  {listing.shops?.shop_name ? (
                    <MarketplacePdpShopLink shopName={listing.shops.shop_name} onPress={openShop} />
                  ) : (
                    <YStack flex={1} />
                  )}
                  {listingShareButton}
                </XStack>

                <MarketplacePdpTitle hasSideRails={false}>{listing.title}</MarketplacePdpTitle>

                <RatingSummary summary={reviewSummary} size="sm" />

                <YStack gap="$2">
                  <ListingPriceBlock
                    price={displayPrice}
                    mrp={listing.mrp}
                    currency={currency}
                    priceIncludesTax={listing.price_includes_tax}
                    taxPercent={listing.tax_percent}
                    size="lg"
                  />
                  {fromCommunityPost && communityPostId && listing?.id ? (
                    <PostedAtPriceChip
                      listingId={listing.id}
                      postId={communityPostId}
                      livePrice={displayPrice}
                      liveCurrency={currency}
                    />
                  ) : null}
                  {deliveryChipLabel ? <GetItByChip label={deliveryChipLabel} /> : null}
                </YStack>

                {followersOnlyBanner}

                {deliveryBlockCompact}

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

                {stockAndExtras}

                {returnPolicy ? <ListingReturnPolicyCard policy={returnPolicy} /> : null}
                <AvailableOffersCard currency={currency} shopId={listing.shop_id} compact />
                <MarketplaceTrustNote>
                  Secure checkout · Buyer protection on eligible orders
                </MarketplaceTrustNote>
                {shopCard}
              </MarketplaceCard>

              {lowerSections}
            </MarketplacePage>
          </YStack>
        </FullWidthLayout>

        <ListingMobileStickyBuyBar
          price={displayPrice}
          mrp={listing.mrp}
          priceIncludesTax={listing.price_includes_tax}
          taxPercent={listing.tax_percent}
          currency={currency}
          disabled={((outOfStock && !allowPreorder) && !showInCart) || purchaseLocked}
          isLoading={isAddingToCart}
          inCart={showInCart}
          quantity={cartItem?.quantity ?? 1}
          maxQuantity={displayStock}
          isUpdatingQuantity={isUpdatingQuantity}
          label="Add to cart"
          buyNowLabel={isDigital ? 'Download' : 'Buy it now'}
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

  const addToCartLabel = purchaseLocked
    ? 'Follow to unlock'
    : outOfStock && !allowPreorder
      ? 'Out of stock'
      : outOfStock
        ? 'Pre-order'
        : 'Add to cart'

  const imageGallery = (
    <StickyRail flex={1.2} minWidth={0} flexShrink={1} maxWidth="100%">
      <MarketplaceCard hasSideRails padding="$3" gap="$3">
        <XStack gap="$3" width="100%" alignItems="flex-start" justifyContent="flex-start">
          {sortedImages.length > 1 ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 560, width: 76, flexShrink: 0, flexGrow: 0 }}
            >
              <YStack gap="$2" width={72}>
                {sortedImages.map((image, index) => (
                  <ThumbnailImage
                    key={image.id}
                    image={image}
                    title={listing.title}
                    isActive={activeImageIndex === index}
                    onPress={() => setActiveImageIndex(index)}
                  />
                ))}
              </YStack>
            </ScrollView>
          ) : null}

          {/* Outer flex takes remaining width; inner square uses that width (avoid flex+aspectRatio on one node). */}
          <YStack flex={1} minWidth={0} width="100%" maxWidth="100%">
            <YStack
              width="100%"
              aspectRatio={1}
              borderRadius={14}
              overflow="hidden"
              backgroundColor={ui.imagePlaceholder}
              position="relative"
              borderWidth={1}
              borderColor={ui.borderSubtle}
              cursor={activeGalleryUrls.length > 0 ? 'zoom-in' : undefined}
              onPress={
                activeGalleryUrls.length > 0 ? () => setGalleryLightboxOpen(true) : undefined
              }
            >
              <YStack position="absolute" top={0} left={0} right={0} bottom={0}>
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
                  <YStack flex={1} alignItems="center" justifyContent="center" width="100%" height="100%">
                    <Icons.Image size={48} color={ui.textMuted} />
                  </YStack>
                )}
              </YStack>
              <FavoriteButton listingId={listing.id} size={20} restockEligible={outOfStock} />
            </YStack>
          </YStack>
        </XStack>

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
      </MarketplaceCard>
    </StickyRail>
  )

  const buyPanel = (
    <YStack
      width="42%"
      minWidth={320}
      maxWidth={480}
      flexGrow={0}
      flexShrink={0}
      flexBasis="42%"
    >
      <MarketplaceBuyBox>
        {fromCommunityPost && communityPostId ? (
          <CommunityAttributionStrip postId={communityPostId} />
        ) : null}
        {fromCommunityPost && communityPostId && listing?.id ? (
          <PostSiblingProductsRail postId={communityPostId} listingId={listing.id} />
        ) : null}

        <RatingSummary summary={reviewSummary} />

        <YStack gap="$2" width="100%">
          <ListingPriceBlock
            price={displayPrice}
            mrp={listing.mrp}
            currency={currency}
            priceIncludesTax={listing.price_includes_tax}
            taxPercent={listing.tax_percent}
            size="lg"
          />
          {fromCommunityPost && communityPostId && listing?.id ? (
            <PostedAtPriceChip
              listingId={listing.id}
              postId={communityPostId}
              livePrice={displayPrice}
              liveCurrency={currency}
            />
          ) : null}
          {deliveryChipLabel ? <GetItByChip label={deliveryChipLabel} /> : null}
        </YStack>

        {followersOnlyBanner}

        {deliveryBlock}

        <ListingVariantPicker
          groups={variationGroups}
          selection={variantSelection}
          currency={currency}
          basePrice={listing.price}
          onSelect={(groupName, variationId) =>
            setVariantSelection((current) => ({ ...current, [groupName]: variationId }))
          }
        />

        {stockAndExtras}

        {returnPolicy ? <ListingReturnPolicyCard policy={returnPolicy} /> : null}
        <AvailableOffersCard currency={currency} shopId={listing.shop_id} />

        <YStack gap="$2.5" width="100%">
          {showInCart ? (
            <ListingQuantityStepper
              fullWidth
              size="lg"
              quantity={cartItem?.quantity ?? 1}
              maxQuantity={displayStock}
              disabled={isUpdatingQuantity || !cartItem}
              onDecrease={() => cartItem && handleQuantityChange(cartItem.quantity - 1)}
              onIncrease={() => cartItem && handleQuantityChange(cartItem.quantity + 1)}
            />
          ) : (
            <MarketplacePrimaryButton
              disabled={addingRef.current || (outOfStock && !allowPreorder) || purchaseLocked}
              onPress={() => handleAddToCart(false)}
            >
              {addToCartLabel}
            </MarketplacePrimaryButton>
          )}
          {showInCart ? (
            <MarketplacePrimaryButton onPress={goToCheckout}>
              {`Proceed to checkout · Qty ${cartItem?.quantity ?? 1}`}
            </MarketplacePrimaryButton>
          ) : (
            <MarketplaceSecondaryButton
              disabled={addingRef.current || (outOfStock && !allowPreorder) || purchaseLocked}
              onPress={() => handleAddToCart(true)}
            >
              {purchaseLocked ? 'Followers only' : buyNowLabel}
            </MarketplaceSecondaryButton>
          )}
        </YStack>

        <MarketplaceTrustNote>
          Secure checkout · Buyer protection on eligible orders
        </MarketplaceTrustNote>

        {shopCard}
      </MarketplaceBuyBox>
    </YStack>
  )

  return (
    <>
      <FullWidthLayout scroll backgroundColor={ui.surfaceMuted}>
        <PageSection
          paddingVertical="$4"
          paddingHorizontal="$3"
          {...LAYOUT_STRETCH}
        >
          <YStack width="100%" maxWidth="100%" alignSelf="stretch" gap="$4">
            <YStack width="100%" gap="$2.5">
              <XStack
                width="100%"
                alignItems="center"
                justifyContent="space-between"
                gap="$3"
              >
                {listing.shops?.shop_name ? (
                  <MarketplacePdpShopLink shopName={listing.shops.shop_name} onPress={openShop} />
                ) : (
                  <Text fontSize={13} color={ui.textMuted} fontWeight="600">
                    {BRAND_SHOP_LABEL}
                  </Text>
                )}
                <XStack flexShrink={0}>{listingShareButton}</XStack>
              </XStack>
              <MarketplacePdpTitle>{listing.title}</MarketplacePdpTitle>
            </YStack>

            <XStack
              width="100%"
              maxWidth="100%"
              alignSelf="stretch"
              gap="$4"
              alignItems="flex-start"
            >
              {imageGallery}
              {buyPanel}
            </XStack>

            {lowerSections}
          </YStack>
        </PageSection>
      </FullWidthLayout>
      {shareListingSheet}
    </>
  )
}