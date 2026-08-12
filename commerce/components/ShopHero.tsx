import { Platform } from 'react-native'

import { Avatar, Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { ShopActionButtons } from '~/commerce/components/ShopActionButtons'
import { SellerTrustStrip } from '~/commerce/components/SellerTrustStrip'
import { StarRating } from '~/commerce/components/StarRating'
import type { ReviewSummary } from '~/commerce/lib/reviews'
import { AppLink } from '~/components/navigation/AppLink'
import { ShareButton } from '~/components/share'
import { useAppLayout } from '~/hooks/useAppLayout'
import { getShopShareUrl } from '~/lib/share'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

type ShopHeroProps = {
  shopId: string
  shopName: string
  logoUrl?: string | null
  description?: string | null
  verified?: boolean
  ownerVerified?: boolean | null
  reviewSummary?: ReviewSummary
  hasReviews: boolean
  listingsCount: number
  country?: string | null
  websiteUrl?: string | null
  ownerUserId?: string | null
  shopSlug: string
}

/**
 * Amazon-style storefront header.
 * Logo overlap uses reserved padding so layout height never collapses
 * (avoids Follow / ratings painting over tabs + Results).
 */
export function ShopHero({
  shopId,
  shopName,
  logoUrl,
  description,
  verified,
  ownerVerified,
  reviewSummary,
  hasReviews,
  listingsCount,
  country,
  websiteUrl,
  ownerUserId,
  shopSlug,
}: ShopHeroProps) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()
  const bannerHeight = isDesktop ? 160 : 100
  const logoSize = isDesktop ? 88 : 72
  const logoOverlap = Math.round(logoSize / 2)
  const rating = Number(reviewSummary?.averageRating ?? 0)
  const reviewCount = reviewSummary?.totalReviews ?? 0

  return (
    <YStack
      width="100%"
      backgroundColor={ui.surface}
      borderBottomWidth={1}
      borderBottomColor={ui.borderSubtle}
      overflow="hidden"
      zIndex={1}
    >
      <XStack
        paddingHorizontal={isDesktop ? 24 : 16}
        paddingTop="$3"
        paddingBottom="$2"
        gap="$2"
        alignItems="center"
        flexWrap="wrap"
      >
        <Crumb href={commerceRoutes.home} label="Home" />
        <Icons.ChevronRight size={12} color={ui.textMuted} />
        <Crumb href={commerceRoutes.shops} label="Shops" />
        <Icons.ChevronRight size={12} color={ui.textMuted} />
        <Text fontSize={13} color={ui.text} fontWeight="600" numberOfLines={1} flexShrink={1}>
          {shopName}
        </Text>
      </XStack>

      <YStack
        width="100%"
        height={bannerHeight}
        overflow="hidden"
        backgroundColor={ui.imagePlaceholder}
        position="relative"
      >
        {logoUrl ? (
          <Image src={logoUrl} width="100%" height="100%" objectFit="cover" />
        ) : (
          <YStack
            width="100%"
            height="100%"
            backgroundColor={ui.brand}
            style={
              Platform.OS === 'web'
                ? {
                    background: `linear-gradient(90deg, ${ui.brandDark} 0%, ${ui.brand} 45%, ${ui.brandLight} 100%)`,
                  }
                : undefined
            }
          />
        )}
        {Platform.OS === 'web' ? (
          <YStack
            position="absolute"
            inset={0}
            style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.28) 100%)',
            }}
          />
        ) : (
          <YStack position="absolute" inset={0} backgroundColor="rgba(0,0,0,0.2)" />
        )}
      </YStack>

      {/* paddingTop reserves logo overlap so sibling sections don't collide */}
      <YStack
        width="100%"
        paddingHorizontal={isDesktop ? 24 : 16}
        paddingTop={logoOverlap + 12}
        paddingBottom={isDesktop ? 20 : 16}
        gap="$3"
        position="relative"
      >
        <YStack
          position="absolute"
          top={-logoOverlap}
          left={isDesktop ? 24 : 16}
          width={logoSize}
          height={logoSize}
          borderRadius={6}
          overflow="hidden"
          borderWidth={2}
          borderColor={ui.surface}
          backgroundColor={ui.surface}
          zIndex={2}
        >
          {logoUrl ? (
            <Image src={logoUrl} width="100%" height="100%" objectFit="cover" />
          ) : (
            <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor={ui.surfaceMuted}>
              <Avatar name={shopName} size={isDesktop ? '$5' : '$4'} />
            </YStack>
          )}
        </YStack>

        {/* Clear the absolute logo on the first text row (desktop inline / mobile below) */}
        <YStack
          gap="$2"
          width="100%"
          paddingLeft={isDesktop ? logoSize + 16 : 0}
          minHeight={isDesktop ? logoOverlap : undefined}
        >
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <Text
              fontWeight="700"
              fontSize={isDesktop ? 26 : 22}
              color={ui.text}
              letterSpacing={-0.3}
              lineHeight={isDesktop ? 32 : 28}
              flexShrink={1}
            >
              {shopName}
            </Text>
            {verified ? (
              <XStack gap={4} alignItems="center" flexShrink={0}>
                <Icons.BadgeCheck size={16} color={ui.brand} />
                <Text fontSize={12} fontWeight="600" color={ui.brand}>
                  Verified
                </Text>
              </XStack>
            ) : null}
          </XStack>

          <XStack gap="$2" alignItems="center" flexWrap="wrap" rowGap="$1.5">
            {hasReviews && reviewSummary ? (
              <XStack gap="$1.5" alignItems="center" flexShrink={0}>
                <Text fontSize={14} fontWeight="700" color={ui.danger}>
                  {rating.toFixed(1)}
                </Text>
                <StarRating rating={rating} size={14} />
                <Text fontSize={13} color={ui.link} fontWeight="500">
                  {reviewCount.toLocaleString()} rating{reviewCount === 1 ? '' : 's'}
                </Text>
              </XStack>
            ) : (
              <Text fontSize={13} color={ui.textMuted}>
                No ratings yet
              </Text>
            )}
            <MetaDot />
            <Text fontSize={13} color={ui.textSecondary} fontWeight="500">
              {listingsCount}
              {listingsCount === 1 ? ' product' : ' products'}
            </Text>
            {country ? (
              <>
                <MetaDot />
                <XStack gap={4} alignItems="center">
                  <Icons.MapPin size={12} color={ui.textMuted} />
                  <Text fontSize={13} color={ui.textSecondary}>
                    {country}
                  </Text>
                </XStack>
              </>
            ) : null}
          </XStack>

          <SellerTrustStrip
            ui={ui}
            shopId={shopId}
            ownerUserId={ownerUserId}
            shopVerified={verified}
            ownerVerified={ownerVerified}
            averageRating={reviewSummary?.averageRating}
            totalReviews={reviewSummary?.totalReviews}
          />

          {description ? (
            <Text color={ui.textSecondary} fontSize={14} lineHeight={21} numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </YStack>

        <XStack gap="$2" flexWrap="wrap" alignItems="center" width="100%">
          <ShopActionButtons shopId={shopId} ownerUserId={ownerUserId} />
          <ShareButton
            variant="outline"
            label="Share"
            sheetTitle="Share shop"
            copyLabel="Copy shop link"
            copyToastMessage="Shop link copied to clipboard."
            payload={{
              url: getShopShareUrl(shopSlug),
              title: shopName,
              text: description ?? undefined,
            }}
          />
          {websiteUrl ? (
            <AppLink href={websiteUrl} external asChild>
              <Button tone="ghost" size="$3" borderRadius={8} icon={<Icons.ExternalLink size={15} />}>
                Website
              </Button>
            </AppLink>
          ) : null}
        </XStack>
      </YStack>
    </YStack>
  )
}

function MetaDot() {
  const ui = useAppUi()
  return (
    <Text fontSize={13} color={ui.textMuted}>
      ·
    </Text>
  )
}

function Crumb({ href, label }: { href: import('one').Href; label: string }) {
  const ui = useAppUi()
  return (
    <AppLink href={href} asChild>
      <Text
        fontSize={13}
        color={ui.link}
        cursor="pointer"
        hoverStyle={{ textDecorationLine: 'underline', color: ui.brand }}
      >
        {label}
      </Text>
    </AppLink>
  )
}
