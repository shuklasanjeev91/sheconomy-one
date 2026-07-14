import { useEffect, useMemo, useState } from 'react'

import { Icons, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { formatCurrency } from '~/lib/format'
import { supabase } from '~/lib/supabase/client'
import { useAppUi } from '~/lib/theme/useAppUi'

type CartFreeShippingBarProps = {
  /** Physical (shippable) subtotal toward free shipping. */
  shippableSubtotal: number
  shopIds: string[]
  currency: string
}

type ThresholdRow = {
  shop_id: string | null
  free_shipping_threshold: number | string | null
}

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(n) ? n : 0
}

/**
 * Fetch the lowest free-shipping threshold among cart shops' active delivery
 * profiles. Returns null when no shop offers free-shipping-over-X.
 */
async function fetchBestFreeShippingThreshold(shopIds: string[]): Promise<number | null> {
  const unique = [...new Set(shopIds.filter(Boolean))]
  if (!unique.length) return null

  const { data } = await supabase
    .from('delivery_profiles')
    .select('shop_id, free_shipping_threshold')
    .in('shop_id', unique)
    .eq('is_active', true)
    .not('free_shipping_threshold', 'is', null)
    .gt('free_shipping_threshold', 0)

  const thresholds = ((data ?? []) as ThresholdRow[])
    .map((row) => toNumber(row.free_shipping_threshold))
    .filter((n) => n > 0)

  if (!thresholds.length) return null
  return Math.min(...thresholds)
}

/** marketplace "spend X more for free shipping" progress bar in the cart buy box. */
export function CartFreeShippingBar({
  shippableSubtotal,
  shopIds,
  currency,
}: CartFreeShippingBarProps) {
  const ui = useAppUi()
  const [threshold, setThreshold] = useState<number | null>(null)
  const shopKey = useMemo(() => [...new Set(shopIds)].sort().join(','), [shopIds])

  useEffect(() => {
    if (!shopKey) {
      setThreshold(null)
      return
    }
    let active = true
    void fetchBestFreeShippingThreshold(shopKey.split(',')).then((value) => {
      if (active) setThreshold(value)
    })
    return () => {
      active = false
    }
  }, [shopKey])

  if (threshold == null || threshold <= 0 || shippableSubtotal <= 0) return null

  const unlocked = shippableSubtotal >= threshold
  const remaining = Math.max(0, threshold - shippableSubtotal)
  const progress = Math.min(1, shippableSubtotal / threshold)

  return (
    <YStack
      gap="$2"
      padding="$3"
      borderRadius={radius.chip}
      borderWidth={1}
      borderColor={unlocked ? ui.success : ui.borderSubtle}
      backgroundColor={unlocked ? ui.badgeSuccessBg : ui.surfaceMuted}
      width="100%"
    >
      <XStack alignItems="center" gap="$2">
        <Icons.Truck size={15} color={unlocked ? ui.badgeSuccessText : ui.brand} />
        <Text
          flex={1}
          fontSize={12.5}
          fontWeight="700"
          color={unlocked ? ui.badgeSuccessText : ui.text}
        >
          {unlocked
            ? 'You have unlocked free shipping'
            : `Spend ${formatCurrency(remaining, currency)} more for free shipping`}
        </Text>
      </XStack>

      {!unlocked ? (
        <YStack
          height={6}
          borderRadius={999}
          backgroundColor={ui.borderSubtle}
          overflow="hidden"
          width="100%"
        >
          <YStack
            height="100%"
            width={`${Math.max(8, Math.round(progress * 100))}%`}
            backgroundColor={ui.brand}
            borderRadius={999}
          />
        </YStack>
      ) : null}
    </YStack>
  )
}
