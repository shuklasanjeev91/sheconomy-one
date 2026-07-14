import { Link } from 'one'
import { Platform } from 'react-native'

import { Avatar, Button, Icons, Image, Text, XStack, YStack, useMedia } from '~/components/ui'
import { ShopActionButtons } from '~/commerce/components/ShopActionButtons'
import { RatingSummary } from '~/commerce/components/RatingSummary'
import type { ReviewSummary } from '~/commerce/lib/reviews'
import { ShareButton } from '~/components/share'
import { getShopShareUrl } from '~/lib/share'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

type ShopHeroProps = {
  shopId: string
  shopName: string
  logoUrl?: string | null
  description?: string | null
  verified?: boolean
  reviewSummary?: ReviewSummary
  hasReviews: boolean
  listingsCount: number
  country?: string | null
  websiteUrl?: string | null
  ownerUserId?: string | null
  shopSlug: string
}

export function ShopHero({
  shopId,
  shopName,
  logoUrl,
  description,
  verified,
  reviewSummary,
  hasReviews,
  listingsCount,
  country,
  websiteUrl,
  ownerUserId,
  shopSlug,
}: ShopHeroProps) {
  const ui = useAppUi()
  const media = useMedia()
  const isDesktop = media.gtMd
  const coverHeight = isDesktop ? 240 : 160

  return (
    <YStack width="100%">
      <YStack
        width="100%"
        height={coverHeight}
        position="relative"
        overflow="hidden"
        backgroundColor={ui.imagePlaceholder}
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
                    background: `linear-gradient(135deg, ${ui.brandDark} 0%, ${ui.brand} 55%, ${ui.brandLight} 100%)`,
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
              background: 'linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.55) 100%)',
            }}
          />
        ) : (
          <YStack position="absolute" inset={0} backgroundColor="rgba(0,0,0,0.28)" />
        )}
      </YStack>

      <YStack
        width="100%"
        paddingHorizontal={isDesktop ? 24 : 16}
        marginTop={isDesktop ? -48 : -36}
        position="relative"
        zIndex={1}
      >
        <XStack
          gap={isDesktop ? '$5' : '$3'}
          alignItems={isDesktop ? 'flex-end' : 'flex-start'}
          flexDirection={isDesktop ? 'row' : 'column'}
        >
          <XStack
            borderWidth={4}
            borderColor={ui.surface}
            borderRadius={radius.pill}
            overflow="hidden"
            style={getShadowStyle('md')}
          >
            <Avatar name={shopName} src={logoUrl ?? undefined} size={isDesktop ? '$10' : '$8'} />
          </XStack>

          <YStack flex={isDesktop ? 1 : undefined} gap="$3" width="100%" paddingTop={isDesktop ? 0 : '$1'}>
            <YStack gap="$2">
              <XStack gap="$2" alignItems="center" flexWrap="wrap">
                <Text
                  fontWeight="700"
                  fontSize={isDesktop ? 34 : 28}
                  color={ui.text}
                  letterSpacing={-0.6}
                  lineHeight={isDesktop ? 40 : 34}
                >
                  {shopName}
                </Text>
                {verified ? <ShopBadge tone="success" label="Verified shop" icon={Icons.BadgeCheck} /> : null}
              </XStack>

              <XStack gap="$2" alignItems="center" flexWrap="wrap">
                {hasReviews && reviewSummary ? (
                  <RatingSummary summary={reviewSummary} size="sm" />
                ) : null}
                <ShopBadge label={`${listingsCount} ${listingsCount === 1 ? 'item' : 'items'}`} />
                {country ? <ShopBadge icon={Icons.MapPin} label={country} /> : null}
              </XStack>
            </YStack>

            {description ? (
              <Text
                color={ui.textSecondary}
                fontSize={15}
                lineHeight={24}
                numberOfLines={isDesktop ? 3 : 4}
              >
                {description}
              </Text>
            ) : null}

            <XStack gap="$2" flexWrap="wrap" alignItems="center">
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
                <Link href={websiteUrl as never} target="_blank" asChild>
                  <Button
                    tone="ghost"
                    size="$3"
                    borderRadius={999}
                    icon={<Icons.ExternalLink size={15} />}
                  >
                    Website
                  </Button>
                </Link>
              ) : null}
            </XStack>
          </YStack>
        </XStack>
      </YStack>
    </YStack>
  )
}

function ShopBadge({
  label,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string
  icon?: typeof Icons.MapPin
  tone?: 'neutral' | 'success'
}) {
  const ui = useAppUi()
  const isSuccess = tone === 'success'

  return (
    <XStack
      gap={5}
      alignItems="center"
      paddingHorizontal="$2.5"
      paddingVertical={5}
      borderRadius={999}
      backgroundColor={isSuccess ? ui.badgeSuccessBg : ui.chip}
      borderWidth={1}
      borderColor={isSuccess ? 'transparent' : ui.borderSubtle}
    >
      {Icon ? <Icon size={12} color={isSuccess ? ui.badgeSuccessText : ui.textMuted} /> : null}
      <Text
        fontSize={12}
        fontWeight="500"
        color={isSuccess ? ui.badgeSuccessText : ui.textSecondary}
      >
        {label}
      </Text>
    </XStack>
  )
}