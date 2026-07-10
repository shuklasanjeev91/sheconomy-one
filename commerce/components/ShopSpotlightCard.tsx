import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'one'

import { Avatar, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { formatRating } from '~/lib/format'
import { useThemedShadowStyle } from '~/lib/theme/useThemedShadowStyle'
import { formatShopLocation } from '~/commerce/lib/shop-location'
import { getShopSlug } from '~/lib/supabase/commerce'
import type { ShopSummary } from '~/lib/supabase/commerce'
import { routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

import { StarRating } from './StarRating'

type ShopSpotlightCardProps = {
  shop: ShopSummary
  /** Stretch to fill grid cell width/height on browse pages. */
  fill?: boolean
}

function ShopBanner({ logoUrl, shopName }: { logoUrl: string | null; shopName: string }) {
  const ui = useAppUi()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [logoUrl])

  if (!logoUrl || failed) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor={ui.roseSurface}>
        <Icons.Store size={34} color={ui.brand} />
      </YStack>
    )
  }

  return (
    <Image
      src={logoUrl}
      alt={shopName}
      width="100%"
      height="100%"
      objectFit="cover"
      onError={() => setFailed(true)}
    />
  )
}

/** Shop spotlight tile — banner, avatar, rating; fills grid cells when `fill` is set. */
export function ShopSpotlightCard({ shop, fill = false }: ShopSpotlightCardProps) {
  const ui = useAppUi()
  const cardShadow = useThemedShadowStyle('sm')
  const cardShadowMd = useThemedShadowStyle('md')
  const location =
    shop.location_label ??
    formatShopLocation({
      city: shop.city ?? null,
      state: shop.state ?? null,
      country: shop.country ?? null,
    })
  const averageRating =
    shop.average_rating != null ? Number(shop.average_rating) : null
  const totalReviews = shop.total_reviews != null ? Number(shop.total_reviews) : 0
  const hasRating =
    averageRating != null &&
    Number.isFinite(averageRating) &&
    averageRating > 0 &&
    totalReviews > 0

  return (
    <Link href={routes.shop(getShopSlug(shop))} asChild>
      <YStack
        width={fill ? '100%' : 212}
        flex={fill ? 1 : undefined}
        minHeight={fill ? 220 : undefined}
        cursor="pointer"
        animation="quick"
        borderRadius={radius.card}
        backgroundColor={ui.surface}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        overflow="hidden"
        style={cardShadow}
        hoverStyle={{ y: -3, ...cardShadowMd }}
        pressStyle={{ scale: 0.98, y: 0 }}
      >
        <YStack
          width="100%"
          height={fill ? 148 : 128}
          overflow="hidden"
          backgroundColor={ui.imagePlaceholder}
          position="relative"
        >
          <ShopBanner logoUrl={shop.logo_url} shopName={shop.shop_name} />
          <XStack
            position="absolute"
            bottom={-22}
            left="$3"
            borderWidth={3}
            borderColor={ui.surface}
            borderRadius={radius.pill}
            overflow="hidden"
            style={cardShadow}
          >
            <Avatar name={shop.shop_name} src={shop.logo_url ?? undefined} size="$5" />
          </XStack>
        </YStack>

        <YStack
          flex={fill ? 1 : undefined}
          paddingTop="$6"
          paddingHorizontal="$3"
          paddingBottom="$3"
          gap={5}
          justifyContent="space-between"
        >
          <YStack gap={5}>
            <Text fontWeight="700" fontSize={14} numberOfLines={1} color={ui.text} letterSpacing={-0.2}>
              {shop.shop_name}
            </Text>
            {location ? (
              <XStack gap={4} alignItems="center">
                <Icons.MapPin size={12} color={ui.textMuted} />
                <Text fontSize={11} color={ui.textMuted} numberOfLines={1} flex={1}>
                  {location}
                </Text>
              </XStack>
            ) : null}
            {hasRating ? (
              <XStack gap={4} alignItems="center" flexWrap="wrap">
                <StarRating rating={averageRating ?? 0} size={11} />
                <Text fontSize={12} color={ui.textSecondary} fontWeight="600">
                  {formatRating(averageRating)}
                </Text>
                <Text fontSize={11} color={ui.textMuted}>
                  ({totalReviews} {totalReviews === 1 ? 'review' : 'reviews'})
                </Text>
              </XStack>
            ) : (
              <Text fontSize={11} color={ui.textMuted}>
                New shop
              </Text>
            )}
          </YStack>
          {shop.verified ? (
            <XStack gap={4} alignItems="center">
              <Icons.BadgeCheck size={13} color={ui.brand} />
              <Text fontSize={11} color={ui.textMuted} fontWeight="600">
                Verified shop
              </Text>
            </XStack>
          ) : null}
        </YStack>
      </YStack>
    </Link>
  )
}
