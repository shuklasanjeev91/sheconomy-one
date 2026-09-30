import { useEffect, useRef, useState } from 'react'

import { ListingCard } from '~/commerce/components/ListingCard'
import { ShopSpotlightCard } from '~/commerce/components/ShopSpotlightCard'
import type { SponsoredCommerceItem } from '~/commerce/hooks/useSponsoredCommerce'
import { Text, XStack, YStack } from '~/components/ui'
import { useInView } from '~/hooks/useInView'
import { useAppUi } from '~/lib/theme/useAppUi'

type SponsoredListingCardProps = {
  item: SponsoredCommerceItem
  onImpression: (item: SponsoredCommerceItem) => void
  onClick: (item: SponsoredCommerceItem) => void
  onHide?: (item: SponsoredCommerceItem) => void
  compact?: boolean
  fill?: boolean
}

const recordedImpressions = new Set<string>()

function adReason(item: SponsoredCommerceItem): string {
  const ad = item.ad as unknown as Record<string, unknown>
  const reason = ad.reason_label ?? ad.matchReason ?? ad.reason
  return typeof reason === 'string' && reason.trim()
    ? reason.trim()
    : 'This promotion may be relevant to what you are browsing.'
}

/** Disclosed commerce ad card with MRC-style 50% / one-second impression timing. */
export function SponsoredListingCard({
  item,
  onImpression,
  onClick,
  onHide,
  compact,
  fill = true,
}: SponsoredListingCardProps) {
  const ui = useAppUi()
  const { ref, inView } = useInView({ threshold: 0.5 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!inView || hidden || recordedImpressions.has(item.ad.creative_id)) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      return
    }
    timerRef.current = setTimeout(() => {
      recordedImpressions.add(item.ad.creative_id)
      onImpression(item)
      timerRef.current = null
    }, 1000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [hidden, inView, item, onImpression])

  if (hidden) return null

  return (
    <YStack
      ref={ref}
      width="100%"
      gap="$2"
      onPress={() => onClick(item)}
      accessibilityLabel={`Sponsored ${item.kind}`}
      testID={`sponsored-${item.kind}-${item.entityId}`}
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$2" minHeight={22}>
        <Text fontSize={11} fontWeight="800" color={ui.textSecondary}>
          Sponsored
        </Text>
        <Text
          fontSize={11}
          fontWeight="600"
          color={ui.textMuted}
          cursor="pointer"
          accessibilityRole="button"
          accessibilityLabel="Hide this ad"
          onPress={(event) => {
            event?.stopPropagation?.()
            setHidden(true)
            onHide?.(item)
          }}
        >
          Hide
        </Text>
      </XStack>

      {item.kind === 'listing' ? (
        <ListingCard listing={item.listing} compact={compact} />
      ) : (
        <ShopSpotlightCard shop={item.shop} fill={fill} />
      )}

      <Text fontSize={11} lineHeight={16} color={ui.textMuted} numberOfLines={2}>
        Why this ad: {adReason(item)}
      </Text>
    </YStack>
  )
}
