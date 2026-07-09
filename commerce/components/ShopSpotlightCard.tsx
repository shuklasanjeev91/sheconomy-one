import { Link } from 'one'

import { Avatar, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { formatRating } from '~/lib/format'
import { hasVisibleReviews, mergeReviewSummary } from '~/commerce/lib/reviews'
import { getShopSlug } from '~/lib/supabase/commerce'
import type { ShopSummary } from '~/lib/supabase/commerce'
import { routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

import { StarRating } from './StarRating'

type ShopSpotlightCardProps = {
  shop: ShopSummary
}

/** Etsy-style shop tile — banner image, avatar overlap, name + rating. */
export function ShopSpotlightCard({ shop }: ShopSpotlightCardProps) {
  const ui = useAppUi()
  const ratingSummary = mergeReviewSummary(
    { averageRating: shop.average_rating, totalReviews: shop.total_reviews },
    { averageRating: null, totalReviews: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
  )

  return (
    <Link href={routes.shop(getShopSlug(shop))} asChild>
      <YStack
        width={200}
        cursor="pointer"
        animation="quick"
        hoverStyle={{ opacity: 0.9 }}
        pressStyle={{ scale: 0.98 }}
      >
        <YStack
          width="100%"
          height={120}
          borderRadius={8}
          overflow="hidden"
          backgroundColor={ui.imagePlaceholder}
          position="relative"
        >
          {shop.logo_url ? (
            <Image
              src={shop.logo_url}
              width="100%"
              height="100%"
              objectFit="cover"
            />
          ) : (
            <YStack flex={1} alignItems="center" justifyContent="center">
              <Icons.Store size={32} color={ui.textMuted} />
            </YStack>
          )}
          <XStack
            position="absolute"
            bottom={-20}
            left="$3"
            borderWidth={3}
            borderColor="$background"
            borderRadius={999}
            overflow="hidden"
          >
            <Avatar name={shop.shop_name} src={shop.logo_url ?? undefined} size="$5" />
          </XStack>
        </YStack>

        <YStack paddingTop="$5" paddingHorizontal="$1" gap={4}>
          <Text fontWeight="500" fontSize={14} numberOfLines={1} color={ui.text}>
            {shop.shop_name}
          </Text>
          {hasVisibleReviews(ratingSummary) ? (
            <XStack gap={4} alignItems="center">
              <StarRating rating={ratingSummary.averageRating ?? 0} size={11} />
              <Text fontSize={12} color={ui.textSecondary}>
                {formatRating(ratingSummary.averageRating)}
                {ratingSummary.totalReviews ? ` (${ratingSummary.totalReviews})` : ''}
              </Text>
            </XStack>
          ) : null}
          {shop.verified ? (
            <Text fontSize={11} color={ui.success} fontWeight="500">
              Star Seller
            </Text>
          ) : null}
        </YStack>
      </YStack>
    </Link>
  )
}