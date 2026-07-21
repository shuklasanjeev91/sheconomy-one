import { useEffect, useState } from 'react'

import { Icons, ScrollView, Text, XStack, YStack, useAppToast, useMedia } from '~/components/ui'
import { PageSection } from '~/components/layout'
import { getShadowStyle, radius } from '~/config/tokens'
import {
  fetchAvailableOffers,
  offerBadgeLabel,
  type AvailableOffer,
} from '~/commerce/lib/discounts'
import { formatCurrency } from '~/lib/format'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { useAppUi } from '~/lib/theme/useAppUi'

type AvailableOffersCardProps = {
  currency?: string
  /** Cap how many offers to show (product pages stay concise). */
  maxItems?: number
  compact?: boolean
  /** Scope to a shop's own coupons plus platform-wide ones. */
  shopId?: string | null
  /** Override the card heading. */
  title?: string
  /** Draw the surrounding card chrome (border + background). Off when embedded. */
  bordered?: boolean
  /**
   * `row` = horizontal scroll of equal-width cards (home / marketplace rails).
   * `stack` = vertical list (product / shop side panels).
   */
  layout?: 'row' | 'stack'
  /** Wrap in PageSection only when offers exist (avoids empty home gaps). */
  inset?: boolean
}

export function AvailableOffersCard({
  currency = 'INR',
  maxItems = 4,
  compact = false,
  shopId,
  title = 'Available offers',
  bordered = true,
  layout = 'stack',
  inset = false,
}: AvailableOffersCardProps) {
  const ui = useAppUi()
  const media = useMedia()
  const toast = useAppToast()
  const [offers, setOffers] = useState<AvailableOffer[]>([])

  useEffect(() => {
    let active = true
    void fetchAvailableOffers({ shopId }).then((rows) => {
      if (active) setOffers(rows)
    })
    return () => {
      active = false
    }
  }, [shopId])

  if (offers.length === 0) return null

  const visible = offers.slice(0, maxItems)
  const cardWidth = media.gtLg ? 280 : media.gtMd ? 260 : media.gtSm ? 220 : 168

  async function handleCopy(code: string) {
    const ok = await copyToClipboard(code)
    toast.show(ok ? 'Coupon code copied' : 'Copy failed', {
      tone: ok ? 'success' : 'danger',
      message: ok ? `Apply ${code} at checkout to save.` : undefined,
    })
  }

  const cards = visible.map((offer) => (
    <OfferCard
      key={offer.id}
      offer={offer}
      currency={currency}
      compact={compact || layout === 'row'}
      onCopy={() => void handleCopy(offer.code)}
      width={layout === 'row' ? cardWidth : '100%'}
    />
  ))

  const content = (
    <YStack
      gap={compact ? '$3' : '$3.5'}
      padding={bordered ? (compact ? '$3.5' : '$4') : '$0'}
      borderRadius={bordered ? radius.card : 0}
      borderWidth={bordered ? 1 : 0}
      borderColor={ui.borderSubtle}
      backgroundColor={bordered ? ui.surface : 'transparent'}
      width="100%"
    >
      <XStack alignItems="center" gap="$2">
        <Icons.TicketPercent size={18} color={ui.brand} />
        <Text fontWeight="800" fontSize={compact ? 15 : 17} color={ui.text} letterSpacing={-0.3}>
          {title}
        </Text>
      </XStack>

      {layout === 'row' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ flexGrow: 0, alignItems: 'stretch' }}
        >
          <XStack gap="$3" paddingRight="$2" alignItems="stretch">
            {cards}
          </XStack>
        </ScrollView>
      ) : (
        <YStack gap="$3" width="100%">
          {cards}
        </YStack>
      )}
    </YStack>
  )

  return inset ? <PageSection>{content}</PageSection> : content
}

function OfferCard({
  offer,
  currency,
  compact,
  onCopy,
  width = '100%',
}: {
  offer: AvailableOffer
  currency: string
  compact: boolean
  onCopy: () => void
  width?: number | '100%'
}) {
  const ui = useAppUi()
  const cardShadow = getShadowStyle('sm')
  const badge = offerBadgeLabel(offer, currency)
  const condition = offer.minOrderAmount
    ? `On orders above ${formatCurrency(offer.minOrderAmount, currency)}`
    : 'No minimum order'

  return (
    <XStack
      width={width}
      flexShrink={0}
      alignItems="stretch"
      borderRadius={12}
      borderWidth={1}
      borderColor={ui.border}
      backgroundColor={ui.elevatedSurface ?? ui.surface}
      overflow="hidden"
      style={cardShadow}
    >
      <YStack width={5} backgroundColor={ui.success} alignSelf="stretch" flexShrink={0} />

      <YStack
        flex={1}
        minWidth={0}
        gap={compact ? '$2' : '$2.5'}
        paddingVertical={compact ? '$3' : '$3.5'}
        paddingHorizontal={compact ? '$3' : '$3.5'}
      >
        <XStack
          alignItems="center"
          gap="$1.5"
          paddingHorizontal="$2.5"
          paddingVertical={5}
          borderRadius={6}
          backgroundColor={ui.badgeSuccessBg}
          alignSelf="flex-start"
        >
          <Icons.BadgePercent size={12} color={ui.badgeSuccessText} />
          <Text fontSize={11.5} fontWeight="800" color={ui.badgeSuccessText} letterSpacing={0.3}>
            {badge}
          </Text>
        </XStack>

        <Text
          fontSize={compact ? 13.5 : 15}
          fontWeight="700"
          color={ui.text}
          numberOfLines={2}
          letterSpacing={-0.2}
          minHeight={compact ? 36 : 40}
        >
          {offer.name}
        </Text>

        {offer.description ? (
          <Text fontSize={12} color={ui.textSecondary} numberOfLines={2} lineHeight={17}>
            {offer.description}
          </Text>
        ) : null}

        <Text fontSize={11.5} color={ui.textMuted} numberOfLines={1}>
          {condition}
        </Text>

        <XStack
          alignItems="center"
          justifyContent="center"
          gap="$1.5"
          paddingHorizontal="$3"
          paddingVertical="$2"
          borderRadius={8}
          borderWidth={1.5}
          borderStyle="dashed"
          borderColor={ui.brand}
          backgroundColor={ui.chip}
          cursor="pointer"
          hoverStyle={{ opacity: 0.9, backgroundColor: ui.surfaceMuted }}
          pressStyle={{ opacity: 0.75, scale: 0.98 }}
          onPress={onCopy}
          aria-label={`Copy coupon ${offer.code}`}
          marginTop="auto"
        >
          <Text fontSize={12} fontWeight="800" color={ui.brand} letterSpacing={0.6} numberOfLines={1}>
            {offer.code}
          </Text>
          <Icons.Copy size={12} color={ui.brand} />
        </XStack>
      </YStack>
    </XStack>
  )
}
