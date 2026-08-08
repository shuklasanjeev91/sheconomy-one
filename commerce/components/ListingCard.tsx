import { memo, useState, useMemo } from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { Button, Icons, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { radius } from '~/config/tokens'
import { getListingSlug } from '~/lib/supabase/commerce'
import type { ListingSummary } from '~/lib/supabase/commerce'
import { routes } from '~/lib/routes'
import { useCart } from '~/commerce/hooks/useCart'
import { useAsyncAction } from '~/hooks/useAsyncAction'
import { useThemedShadowStyle } from '~/lib/theme/useThemedShadowStyle'
import { motion } from '~/lib/theme/motion'
import { prefetchNativeLoader, seedNativeLoaderCache } from '~/lib/bootstrap/native-loader-cache'
import {
  fetchListingDetailById,
  listingLoaderResultFromSummary,
} from '~/commerce/lib/listing-loader'
import { prefetchListingRecommendations } from '~/commerce/lib/listing-recommendations'

import { FavoriteButton } from '~/commerce/components/FavoriteButton'
import { ListingBadge } from '~/commerce/components/ListingBadge'
import { ListingImage } from '~/commerce/components/ListingImage'
import { ListingPriceBlock } from '~/commerce/components/ListingPriceBlock'
import { ListingTypeBadge } from '~/commerce/components/ListingTypeBadge'
import { StarRating } from '~/commerce/components/StarRating'
import { useOptionalMarketplacePersonalization } from '~/commerce/context/MarketplacePersonalizationContext'
import { buildListingFulfillmentInputFromSummary, getListingCardFulfillmentLabel } from '~/commerce/lib/listing-fulfillment'
import { useAppUi } from '~/lib/theme/useAppUi'
import { formatRating } from '~/lib/format'

function warmListingRoute(listing: ListingSummary, slug: string) {
  if (Platform.OS === 'web' || !listing.id) return
  const cacheKey = `route:listing:${listing.id}`
  const aliases = slug && slug !== listing.id ? [`route:listing:${slug}`] : undefined
  seedNativeLoaderCache(cacheKey, listingLoaderResultFromSummary(listing), aliases)
  prefetchNativeLoader(cacheKey, () => fetchListingDetailById(listing.id), aliases)
  prefetchListingRecommendations(listing.id, listing.shop_id, undefined, {
    shopId: listing.shop_id,
    category: listing.category,
    listingType: listing.listing_type,
  })
}

type ListingCardProps = {
  listing: ListingSummary
  compact?: boolean
  showQuickAdd?: boolean
}

/**
 * Listing tile — square image(s), heart overlay, title, optional rating, bold price.
 */
export const ListingCard = memo(function ListingCard({ listing, compact, showQuickAdd }: ListingCardProps) {
  const ui = useAppUi()
  const cardShadow = useThemedShadowStyle('sm')
  const cardShadowMd = useThemedShadowStyle('md')
  const personalization = useOptionalMarketplacePersonalization()
  const badge = personalization?.getBadge(listing) ?? null
  const hasRating =
    listing.average_rating != null &&
    listing.average_rating > 0 &&
    (listing.total_reviews ?? 0) > 0
  const imageUrls = listing.image_urls?.length
    ? listing.image_urls
    : listing.image_url
      ? [listing.image_url]
      : []
  const [hoverImageIndex, setHoverImageIndex] = useState(0)
  const cardTitle = listing.card_title || listing.title

  // ─── FIX: Memoize displayUrls to prevent new array on every render ────
  const displayUrls = useMemo(() => {
    if (hoverImageIndex > 0 && imageUrls[hoverImageIndex]) {
      return [imageUrls[hoverImageIndex], ...imageUrls.filter((_, i) => i !== hoverImageIndex)]
    }
    return imageUrls
  }, [imageUrls, hoverImageIndex])

  const listingSlug = getListingSlug(listing)
  const listingHref = routes.listing(Platform.OS === 'web' ? listingSlug : listing.id)

  const deliveryHint = getListingCardFulfillmentLabel(
    buildListingFulfillmentInputFromSummary(listing),
  )

  const warmListing = () => warmListingRoute(listing, listingSlug)

  return (
    <YStack width="100%" gap={compact ? '$1.5' : '$2'}>
      <YStack
        width="100%"
        position="relative"
        aspectRatio={1}
        onMouseEnter={() => {
          if (imageUrls.length > 1) setHoverImageIndex(1)
          warmListing()
        }}
        onMouseLeave={() => setHoverImageIndex(0)}
      >
        <AppLink href={listingHref} asChild>
          <YStack
            width="100%"
            height="100%"
            borderRadius={radius.card}
            overflow="hidden"
            backgroundColor={ui.imagePlaceholder}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            {...motion.cardLift}
            hoverStyle={{ ...motion.cardLift.hoverStyle, ...cardShadowMd }}
            style={cardShadow}
            onPressIn={warmListing}
          >
            <ListingImage
              imageUrls={displayUrls}
              alt={cardTitle}
              width="100%"
              height="100%"
              objectFit="cover"
              displaySize={{ width: 640, height: 640, quality: 72, resize: 'cover' }}
            />
          </YStack>
        </AppLink>
        <FavoriteButton listingId={listing.id} size={compact ? 16 : 18} />
        {imageUrls.length > 1 ? (
          <XStack
            position="absolute"
            bottom="$2"
            left={0}
            right={0}
            justifyContent="center"
            gap={4}
            pointerEvents="none"
          >
            {imageUrls.slice(0, 5).map((_, index) => (
              <YStack
                key={index}
                width={6}
                height={6}
                borderRadius={999}
                backgroundColor={index === hoverImageIndex ? ui.overlayDotActive : ui.overlayDot}
              />
            ))}
          </XStack>
        ) : null}
        {badge ? (
          <XStack
            position="absolute"
            top="$2"
            left="$2"
            right="$2"
            zIndex={2}
            alignItems="flex-start"
          >
            <ListingBadge badge={badge} />
          </XStack>
        ) : null}
      </YStack>

      {deliveryHint || listing.listing_type ? (
        <ListingTypeBadge
          listingType={listing.listing_type}
          compact={compact}
          deliveryHint={deliveryHint}
        />
      ) : null}

      <AppLink href={listingHref} asChild>
        <YStack
          gap={4}
          cursor="pointer"
          paddingHorizontal={2}
          animation="quick"
          onPressIn={warmListing}
        >
          <Text
            fontSize={compact ? 12 : 13}
            fontWeight="600"
            numberOfLines={2}
            lineHeight={compact ? 17 : 19}
            color={ui.text}
            letterSpacing={-0.2}
            hoverStyle={{ color: ui.brand }}
          >
            {cardTitle}
          </Text>

          {hasRating ? (
            <XStack gap={4} alignItems="center">
              <StarRating rating={listing.average_rating ?? 0} size={11} />
              <Text fontSize={12} color={ui.textSecondary} fontWeight="500">
                {formatRating(listing.average_rating)}
                {listing.total_reviews ? ` (${listing.total_reviews})` : ''}
              </Text>
            </XStack>
          ) : null}

          <YStack gap={2}>
            <ListingPriceBlock
              price={listing.price}
              mrp={listing.mrp}
              currency={listing.currency}
              priceIncludesTax={listing.price_includes_tax}
              taxPercent={listing.tax_percent}
              size="sm"
              hideTaxLabel
            />
            {listing.shop_name && !compact ? (
              <Text fontSize={11} color={ui.textMuted} numberOfLines={1} fontWeight="500">
                {listing.shop_name}
              </Text>
            ) : null}
          </YStack>
        </YStack>
      </AppLink>

      {showQuickAdd ? <QuickAddButton listing={listing} /> : null}
    </YStack>
  )
})

function QuickAddButton({ listing }: { listing: ListingSummary }) {
  const { addToCart } = useCart()
  const toast = useAppToast()
  const router = useRouter()
  const { run, pending } = useAsyncAction()

  return (
    <Button
      size="$2.5"
      tone="primary"
      borderRadius={999}
      width="100%"
      minHeight={44}
      disabled={pending}
      accessibilityLabel={`Add ${listing.title} to cart`}
      icon={<Icons.ShoppingCart size={14} />}
      onPress={() => {
        void run(
          async () => {
            const { error } = await addToCart(listing.id)
            if (error) {
              toast.show('Choose options', {
                tone: 'default',
                message: 'Select options on the product page to add it.',
              })
              router.push(routes.listing(Platform.OS === 'web' ? getListingSlug(listing) : listing.id))
              return
            }
            toast.show('Added to cart', { tone: 'success' })
          },
          { haptic: 'success', errorTitle: 'Could not add to cart' },
        )
      }}
    >
      {pending ? 'Adding…' : 'Add to cart'}
    </Button>
  )
}