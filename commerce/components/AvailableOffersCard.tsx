import { useEffect, useState } from 'react'

import { Icons, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { radius } from '~/config/tokens'
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
}

export function AvailableOffersCard({
  currency = 'INR',
  maxItems = 4,
  compact = false,
  shopId,
  title = 'Available offers',
  bordered = true,
}: AvailableOffersCardProps) {
  const ui = useAppUi()
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

  async function handleCopy(code: string) {
    const ok = await copyToClipboard(code)
    toast.show(ok ? 'Coupon code copied' : 'Copy failed', {
      tone: ok ? 'success' : 'danger',
      message: ok ? `Apply ${code} at checkout to save.` : undefined,
    })
  }

  return (
    <YStack
      gap="$3"
      padding={bordered ? (compact ? '$3.5' : '$4') : '$0'}
      borderRadius={bordered ? radius.card : 0}
      borderWidth={bordered ? 1 : 0}
      borderColor={ui.borderSubtle}
      backgroundColor={bordered ? ui.surface : 'transparent'}
    >
      <XStack alignItems="center" gap="$2">
        <Icons.TicketPercent size={18} color={ui.brand} />
        <Text fontWeight="700" fontSize={15} color={ui.text} letterSpacing={-0.2}>
          {title}
        </Text>
      </XStack>

      <YStack gap="$2.5">
        {visible.map((offer) => (
          <XStack key={offer.id} gap="$3" alignItems="center">
            <Icons.BadgePercent size={16} color={ui.success} style={{ marginTop: 2 }} />
            <YStack flex={1} minWidth={0} gap={1}>
              <Text fontSize={13.5} color={ui.text} fontWeight="600">
                <Text fontWeight="800" color={ui.success}>
                  {offerBadgeLabel(offer, currency)}
                </Text>
                {'  '}
                {offer.name}
              </Text>
              <Text fontSize={12} color={ui.textMuted}>
                {offer.minOrderAmount
                  ? `On orders above ${formatCurrency(offer.minOrderAmount, currency)}`
                  : 'No minimum order'}
              </Text>
            </YStack>
            <XStack
              alignItems="center"
              gap="$1.5"
              paddingHorizontal="$2.5"
              paddingVertical="$1.5"
              borderRadius={radius.chip}
              borderWidth={1}
              borderStyle="dashed"
              borderColor={ui.brand}
              cursor="pointer"
              hoverStyle={{ backgroundColor: ui.chip }}
              pressStyle={{ opacity: 0.7 }}
              onPress={() => void handleCopy(offer.code)}
              aria-label={`Copy coupon ${offer.code}`}
            >
              <Text fontSize={12} fontWeight="800" color={ui.brand}>
                {offer.code}
              </Text>
              <Icons.Copy size={12} color={ui.brand} />
            </XStack>
          </XStack>
        ))}
      </YStack>
    </YStack>
  )
}
