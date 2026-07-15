import { useEffect, useState } from 'react'

import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useCart } from '~/commerce/hooks/useCart'
import {
  fetchShopCoupons,
  offerBadgeLabel,
  type AvailableOffer,
} from '~/commerce/lib/discounts'
import { formatCurrency } from '~/lib/format'
import { useAppUi } from '~/lib/theme/useAppUi'

type CartShopOffersProps = {
  shopId: string
  shopName?: string | null
  /** Subtotal for this shop's items — used for eligibility hints. */
  subtotal: number
  currency: string
}

/**
 * Shop-level coupon codes surfaced inside a cart shop group (marketplace). The
 * cart carries a single order-level discount, so applying a shop code replaces
 * any current coupon (the customer is told when they tap Apply).
 */
export function CartShopOffers({ shopId, shopName, subtotal, currency }: CartShopOffersProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { cart, applyCoupon } = useCart()
  const [offers, setOffers] = useState<AvailableOffer[]>([])
  const [applyingCode, setApplyingCode] = useState<string | null>(null)

  const appliedId = cart?.applied_discount_id ?? null

  useEffect(() => {
    let active = true
    void fetchShopCoupons(shopId).then((rows) => {
      if (active) setOffers(rows)
    })
    return () => {
      active = false
    }
  }, [shopId])

  if (offers.length === 0) return null

  async function handleApply(offer: AvailableOffer) {
    setApplyingCode(offer.code.toUpperCase())
    const { error } = await applyCoupon(offer.code)
    setApplyingCode(null)
    if (error) {
      toast.show("Couldn't apply code", { tone: 'danger', message: error })
      return
    }
    toast.show('Coupon applied', {
      tone: 'success',
      message: `${offer.code} from ${shopName ?? 'this shop'} added to your order.`,
    })
  }

  return (
    <YStack gap="$2">
      <XStack alignItems="center" gap="$1.5">
        <Icons.Tag size={13} color={ui.brand} />
        <Text fontSize={12} fontWeight="700" color={ui.brand}>
          Offers from {shopName ?? 'this shop'}
        </Text>
      </XStack>
      <XStack gap="$2" flexWrap="wrap">
        {offers.map((offer) => {
          const eligible = offer.minOrderAmount == null || subtotal >= offer.minOrderAmount
          const busy = applyingCode === offer.code.toUpperCase()
          const isApplied = appliedId === offer.id
          return (
            <XStack
              key={offer.id}
              alignItems="center"
              gap="$2"
              paddingLeft="$2.5"
              paddingRight="$1"
              paddingVertical="$1"
              borderRadius={radius.chip}
              borderWidth={1}
              borderStyle="dashed"
              borderColor={ui.border}
              backgroundColor={ui.surfaceMuted}
            >
              <YStack>
                <Text fontSize={12} fontWeight="800" color={ui.text}>
                  {offer.code}
                </Text>
                <Text fontSize={10.5} color={ui.success} fontWeight="700">
                  {offerBadgeLabel(offer, currency)}
                  {offer.minOrderAmount
                    ? ` · min ${formatCurrency(offer.minOrderAmount, currency)}`
                    : ''}
                </Text>
              </YStack>
              {isApplied ? (
                <XStack alignItems="center" gap={2} paddingHorizontal="$1.5">
                  <Icons.BadgeCheck size={14} color={ui.success} />
                </XStack>
              ) : (
                <Button
                  tone={eligible ? 'primary' : 'ghost'}
                  size="$2"
                  borderRadius={radius.chip}
                  disabled={busy || !eligible}
                  onPress={() => void handleApply(offer)}
                >
                  {busy ? <Spinner size="small" color="white" /> : eligible ? 'Apply' : 'Locked'}
                </Button>
              )}
            </XStack>
          )
        })}
      </XStack>
    </YStack>
  )
}
