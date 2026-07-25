import { useEffect, useMemo, useState } from 'react'

import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useCart } from '~/commerce/hooks/useCart'
import {
  fetchShopCoupons,
  offerBadgeLabel,
  type AvailableOffer,
  type CartOfferFetchContext,
  type CartOfferItem,
} from '~/commerce/lib/discounts'
import { filterEligibleOffers, isOfferEligible } from '~/commerce/lib/offer-utils'
import { formatCurrency } from '~/lib/format'
import { useAppUi } from '~/lib/theme/useAppUi'

type CartShopOffersProps = {
  shopId: string
  shopName?: string | null
  /** Selected-line subtotal for this shop. */
  subtotal: number
  currency: string
  /** Selected cart lines for this shop (item-level coupon eligibility). */
  items: CartOfferItem[]
}

/**
 * Shop coupon codes inside a cart shop group (order-level + item-level linked listings).
 * Only shows offers the current selection can apply — matches checkout validation.
 */
export function CartShopOffers({ shopId, shopName, subtotal, currency, items }: CartShopOffersProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { cart, applyCoupon } = useCart()
  const [offers, setOffers] = useState<AvailableOffer[]>([])
  const [applyingCode, setApplyingCode] = useState<string | null>(null)

  const appliedId = cart?.applied_discount_id ?? null

  const cartContext = useMemo<CartOfferFetchContext>(
    () => ({ subtotal, items }),
    [subtotal, items],
  )

  const listingIdsKey = items
    .map((item) => item.listing_id)
    .sort()
    .join(',')
  const contextKey = `${subtotal}:${listingIdsKey}`

  const visibleOffers = useMemo(
    () => filterEligibleOffers(offers, subtotal, items),
    [offers, subtotal, items],
  )

  useEffect(() => {
    if (subtotal <= 0 || items.length === 0) {
      setOffers([])
      return
    }

    let active = true
    const listingIds = items.map((item) => item.listing_id)
    void fetchShopCoupons(shopId, listingIds, cartContext).then((rows) => {
      if (active) setOffers(rows)
    })

    return () => {
      active = false
    }
  }, [shopId, contextKey, cartContext])

  if (visibleOffers.length === 0) return null

  async function handleApply(offer: AvailableOffer) {
    if (!isOfferEligible(offer, subtotal, items)) {
      toast.show("Can't apply code", {
        tone: 'danger',
        message: 'Add more eligible items to meet the minimum for this offer.',
      })
      return
    }

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
        {visibleOffers.map((offer) => {
          const busy = applyingCode === offer.code.toUpperCase()
          const isApplied = appliedId === offer.id
          const canApply = isOfferEligible(offer, subtotal, items)

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
                  {offer.appliesTo === 'item' ? ' · item offer' : ''}
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
                  tone="primary"
                  size="$2"
                  borderRadius={radius.chip}
                  disabled={busy || !canApply}
                  onPress={() => void handleApply(offer)}
                >
                  {busy ? <Spinner size="small" color="white" /> : 'Apply'}
                </Button>
              )}
            </XStack>
          )
        })}
      </XStack>
    </YStack>
  )
}
