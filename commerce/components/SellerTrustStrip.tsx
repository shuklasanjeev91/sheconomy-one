import { useEffect, useState } from 'react'

import { Icons, Text, XStack, YStack } from '~/components/ui'
import { supabase } from '~/lib/supabase/client'
import type { AppUiTokens } from '~/lib/theme/app-ui'

export type SellerTrustSignals = {
  shopVerified: boolean
  ownerVerified: boolean
  rating: number | null
  reviewCount: number
  shipsWithTracking: boolean
}

export async function fetchSellerTrustSignals(input: {
  shopId: string
  ownerUserId?: string | null
  shopVerified?: boolean
  ownerVerified?: boolean | null
  averageRating?: number | null
  totalReviews?: number | null
}): Promise<SellerTrustSignals> {
  let shipsWithTracking = false
  try {
    const { data: itemRows } = await supabase
      .from('order_items')
      .select('order_id')
      .eq('vendor_id', input.shopId)
      .limit(40)

    const orderIds = [...new Set((itemRows ?? []).map((row) => row.order_id).filter(Boolean))]
    if (orderIds.length) {
      const { count } = await supabase
        .from('order_delivery')
        .select('id', { count: 'exact', head: true })
        .in('order_id', orderIds)
        .or('tracking_number.not.is.null,awb_code.not.is.null')
        .limit(1)
      shipsWithTracking = (count ?? 0) > 0
    }
  } catch {
    shipsWithTracking = false
  }

  let ownerVerified = Boolean(input.ownerVerified)
  if (input.ownerUserId && input.ownerVerified == null) {
    const { data } = await supabase
      .from('profiles')
      .select('is_verified')
      .eq('id', input.ownerUserId)
      .maybeSingle()
    ownerVerified = Boolean(data?.is_verified)
  }

  return {
    shopVerified: Boolean(input.shopVerified),
    ownerVerified,
    rating:
      typeof input.averageRating === 'number' && Number.isFinite(input.averageRating)
        ? input.averageRating
        : null,
    reviewCount: Number(input.totalReviews ?? 0) || 0,
    shipsWithTracking,
  }
}

type SellerTrustStripProps = {
  ui: AppUiTokens
  shopId: string
  ownerUserId?: string | null
  shopVerified?: boolean
  ownerVerified?: boolean | null
  averageRating?: number | null
  totalReviews?: number | null
}

export function SellerTrustStrip({
  ui,
  shopId,
  ownerUserId,
  shopVerified,
  ownerVerified,
  averageRating,
  totalReviews,
}: SellerTrustStripProps) {
  const [signals, setSignals] = useState<SellerTrustSignals | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchSellerTrustSignals({
      shopId,
      ownerUserId,
      shopVerified,
      ownerVerified,
      averageRating,
      totalReviews,
    }).then((next) => {
      if (!cancelled) setSignals(next)
    })
    return () => {
      cancelled = true
    }
  }, [averageRating, ownerUserId, ownerVerified, shopId, shopVerified, totalReviews])

  if (!signals) return null

  const chips: { key: string; label: string; icon: 'check' | 'user' | 'star' | 'truck' }[] = []
  if (signals.shopVerified) chips.push({ key: 'shop', label: 'Verified shop', icon: 'check' })
  if (signals.ownerVerified) chips.push({ key: 'owner', label: 'Human-verified seller', icon: 'user' })
  if (signals.rating != null && signals.reviewCount > 0) {
    chips.push({
      key: 'rating',
      label: `${signals.rating.toFixed(1)} · ${signals.reviewCount} review${signals.reviewCount === 1 ? '' : 's'}`,
      icon: 'star',
    })
  }
  if (signals.shipsWithTracking) {
    chips.push({ key: 'track', label: 'Ships with tracking', icon: 'truck' })
  }

  if (!chips.length) return null

  return (
    <XStack gap="$2" flexWrap="wrap" alignItems="center">
      {chips.map((chip) => (
        <XStack
          key={chip.key}
          gap={6}
          alignItems="center"
          paddingHorizontal={10}
          paddingVertical={6}
          borderRadius={999}
          backgroundColor={ui.roseSurface}
          borderWidth={1}
          borderColor={ui.borderSubtle}
        >
          {chip.icon === 'check' ? <Icons.BadgeCheck size={13} color={ui.brand} /> : null}
          {chip.icon === 'user' ? <Icons.ShieldCheck size={13} color={ui.brand} /> : null}
          {chip.icon === 'star' ? <Icons.Star size={13} color={ui.brand} /> : null}
          {chip.icon === 'truck' ? <Icons.Truck size={13} color={ui.brand} /> : null}
          <Text fontSize={11} fontWeight="700" color={ui.text}>
            {chip.label}
          </Text>
        </XStack>
      ))}
    </XStack>
  )
}
