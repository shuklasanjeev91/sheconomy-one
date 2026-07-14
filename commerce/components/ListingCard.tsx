import { useState } from 'react'
import { Link, useRouter } from 'one'

import { Button, Icons, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { radius } from '~/config/tokens'
import { getListingSlug } from '~/lib/supabase/commerce'
import type { ListingSummary } from '~/lib/supabase/commerce'
import { routes } from '~/lib/routes'
import { useCart } from '~/commerce/hooks/useCart'
import { useThemedShadowStyle } from '~/lib/theme/useThemedShadowStyle'

import { FavoriteButton } from './FavoriteButton'
import { ListingBadge } from './ListingBadge'
import { ListingImage } from './ListingImage'
import { ListingTypeBadge } from './ListingTypeBadge'
import { StarRating } from './StarRating'
import { useOptionalMarketplacePersonalization } from '~/commerce/context/MarketplacePersonalizationContext'
import { buildListingFulfillmentInputFromSummary, getListingCardFulfillmentLabel } from '~/commerce/lib/listing-fulfillment'
import { useAppUi } from '~/lib/theme/useAppUi'
import { formatCurrency, formatRating } from '~/lib/format'

type ListingCardProps = {
  listing: ListingSummary
  compact?: boolean
  /** Show an inline "Add to cart" button (used on wishlist/favorites). */
  showQuickAdd?: boolean
}

/**
 * Listing tile — square image(s), heart overlay, title, optional rating, bold price.
 */
export function ListingCard({ listing, compact, showQuickAdd }: ListingCardProps) {
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
  const displayUrls =
    hoverImageIndex > 0 && imageUrls[hoverImageIndex]
      ? [imageUrls[hoverImageIndex], ...imageUrls.filter((_, index) => index !== hoverImageIndex)]
      : imageUrls

  const listingHref = routes.listing(getListingSlug(listing))

  const deliveryHint = getListingCardFulfillmentLabel(
    buildListingFulfillmentInputFromSummary(listing),
  )

  return (
    <YStack width="100%" gap={compact ? '$1.5' : '$2'}>
      <YStack
        width="100%"
        position="relative"
        aspectRatio={1}
        onMouseEnter={() => {
          if (imageUrls.length > 1) setHoverImageIndex(1)
        }}
        onMouseLeave={() => setHoverImageIndex(0)}
      >
        <Link href={listingHref} asChild>
          <YStack
            width="100%"
            height="100%"
            borderRadius={radius.card}
            overflow="hidden"
            backgroundColor={ui.imagePlaceholder}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            cursor="pointer"
            animation="quick"
            hoverStyle={{ opacity: 0.98, y: -4, ...cardShadowMd }}
            pressStyle={{ scale: 0.985, y: 0 }}
            style={cardShadow}
          >
            <ListingImage
              imageUrls={displayUrls}
              alt={cardTitle}
              width="100%"
              height="100%"
              objectFit="cover"
            />
          </YStack>
        </Link>
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

      <Link href={listingHref} asChild>
        <YStack gap={4} cursor="pointer" paddingHorizontal={2} animation="quick">
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

          <XStack alignItems="baseline" gap="$2" flexWrap="wrap">
            <Text fontSize={compact ? 15 : 17} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
              {formatCurrency(listing.price, listing.currency)}
            </Text>
            {listing.shop_name && !compact ? (
              <Text fontSize={11} color={ui.textMuted} numberOfLines={1} fontWeight="500">
                · {listing.shop_name}
              </Text>
            ) : null}
          </XStack>
        </YStack>
      </Link>

      {showQuickAdd ? <QuickAddButton listing={listing} /> : null}
    </YStack>
  )
}

function QuickAddButton({ listing }: { listing: ListingSummary }) {
  const { addToCart } = useCart()
  const toast = useAppToast()
  const router = useRouter()
  const [adding, setAdding] = useState(false)

  return (
    <Button
      size="$2.5"
      tone="primary"
      borderRadius={999}
      width="100%"
      disabled={adding}
      icon={<Icons.ShoppingCart size={14} />}
      onPress={async () => {
        setAdding(true)
        const { error } = await addToCart(listing.id)
        setAdding(false)
        if (error) {
          // Likely needs variant/option selection — send them to the product page.
          toast.show('Choose options', {
            tone: 'default',
            message: 'Select options on the product page to add it.',
          })
          router.push(routes.listing(getListingSlug(listing)))
          return
        }
        toast.show('Added to cart', { tone: 'success' })
      }}
    >
      {adding ? 'Adding…' : 'Add to cart'}
    </Button>
  )
}