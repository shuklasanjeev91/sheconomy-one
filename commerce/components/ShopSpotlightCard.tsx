import { useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { Avatar, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { formatRating } from '~/lib/format'
import { useThemedShadowStyle } from '~/lib/theme/useThemedShadowStyle'
import { formatShopLocation } from '~/commerce/lib/shop-location'
import { getShopSlug } from '~/lib/supabase/commerce'
import type { ShopSummary } from '~/lib/supabase/commerce'
import { routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

import { StarRating } from '~/commerce/components/StarRating'

type ShopSpotlightCardProps = {
  shop: ShopSummary
  /** Stretch to fill grid cell width/height on browse pages. */
  fill?: boolean
}

/** Banner art — logos are contained (not cover-cropped) so bad uploads don't dominate. */
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
    <YStack flex={1} width="100%" height="100%" backgroundColor={ui.roseSurface} alignItems="center" justifyContent="center">
      <Image
        src={logoUrl}
        alt={shopName}
        width="100%"
        height="100%"
        objectFit="contain"
        onError={() => setFailed(true)}
      />
    </YStack>
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

  // Banner + avatar overhang + name/rating/verified need room; previous fill minHeight
  // left ~72px under a 148px banner and clipped the rating row.
  const bannerHeight = fill ? 112 : 120
  const avatarOverlap = 22

  return (
    <AppLink href={routes.shop(getShopSlug(shop))} asChild>
      <YStack
        width={fill ? '100%' : 212}
        flex={fill ? 1 : undefined}
        minHeight={fill ? 268 : undefined}
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
          height={bannerHeight}
          overflow="visible"
          backgroundColor={ui.imagePlaceholder}
          position="relative"
          zIndex={1}
        >
          <YStack width="100%" height="100%" overflow="hidden">
            <ShopBanner logoUrl={shop.logo_url} shopName={shop.shop_name} />
          </YStack>
          <XStack
            position="absolute"
            bottom={-avatarOverlap}
            left="$3"
            borderWidth={3}
            borderColor={ui.surface}
            borderRadius={radius.pill}
            overflow="hidden"
            zIndex={2}
            style={cardShadow}
          >
            <Avatar name={shop.shop_name} src={shop.logo_url ?? undefined} size="$5" />
          </XStack>
        </YStack>

        <YStack
          flex={fill ? 1 : undefined}
          minHeight={fill ? 140 : undefined}
          paddingTop={avatarOverlap + 12}
          paddingHorizontal="$3"
          paddingBottom="$4"
          gap="$2"
          justifyContent="flex-start"
        >
          <Text fontWeight="700" fontSize={14} numberOfLines={2} color={ui.text} letterSpacing={-0.2} lineHeight={18}>
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
            <XStack gap={4} alignItems="center" flexWrap="wrap" minHeight={18}>
              <StarRating rating={averageRating ?? 0} size={11} />
              <Text fontSize={12} color={ui.textSecondary} fontWeight="600">
                {formatRating(averageRating)}
              </Text>
              <Text fontSize={11} color={ui.textMuted}>
                ({totalReviews} {totalReviews === 1 ? 'review' : 'reviews'})
              </Text>
            </XStack>
          ) : (
            <Text fontSize={11} color={ui.textMuted} minHeight={18}>
              New shop
            </Text>
          )}
          {shop.verified ? (
            <XStack gap={4} alignItems="center" marginTop={2}>
              <Icons.BadgeCheck size={13} color={ui.brand} />
              <Text fontSize={11} color={ui.textMuted} fontWeight="600">
                Verified shop
              </Text>
            </XStack>
          ) : null}
        </YStack>
      </YStack>
    </AppLink>
  )
}
