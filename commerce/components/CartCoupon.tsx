import { useEffect, useState } from 'react'

import {
  Button,
  Icons,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { radius } from '~/config/tokens'
import { useCart } from '~/commerce/hooks/useCart'
import {
  fetchAvailableOffers,
  isOfferEligible,
  offerBadgeLabel,
  offerEligibleSubtotal,
  type AvailableOffer,
} from '~/commerce/lib/discounts'
import { formatCurrency } from '~/lib/format'
import { useAppUi } from '~/lib/theme/useAppUi'

export function CartCoupon() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { cart, items, applyCoupon, removeCoupon, couponAutoApplied } = useCart()

  const [code, setCode] = useState('')
  const [applying, setApplying] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offers, setOffers] = useState<AvailableOffer[]>([])
  const [offersOpen, setOffersOpen] = useState(false)
  const [applyingCode, setApplyingCode] = useState<string | null>(null)

  const currency = cart?.currency ?? 'INR'
  const subtotal = cart?.items_subtotal ?? 0
  const appliedId = cart?.applied_discount_id ?? null
  const appliedName = cart?.applied_discount_name ?? null
  const discountAmount = cart?.discount_amount ?? 0
  const cartShopIdsKey = items
    .map((item) => item.shop_id)
    .filter(Boolean)
    .sort()
    .join(',')

  useEffect(() => {
    let active = true
    const shopIds = [
      ...new Set(items.map((item) => item.shop_id).filter((id): id is string => !!id)),
    ]
    void fetchAvailableOffers({ shopIds }).then((rows) => {
      if (!active) return
      setOffers(rows)
    })
    return () => {
      active = false
    }
  }, [cartShopIdsKey])

  if (!cart || subtotal <= 0) return null

  async function handleApply(rawCode: string, fromOffer = false) {
    const trimmed = rawCode.trim()
    if (!trimmed) {
      setError('Enter a coupon code.')
      return
    }
    setError(null)
    if (fromOffer) setApplyingCode(trimmed.toUpperCase())
    else setApplying(true)

    const { error: applyError } = await applyCoupon(trimmed)

    setApplying(false)
    setApplyingCode(null)

    if (applyError) {
      setError(applyError)
      return
    }

    setCode('')
    setOffersOpen(false)
    toast.show('Coupon applied', {
      tone: 'success',
      message: 'Your discount has been added to the order.',
    })
  }

  async function handleRemove() {
    setRemoving(true)
    setError(null)
    const { error: removeError } = await removeCoupon()
    setRemoving(false)
    if (removeError) {
      toast.show('Could not remove coupon', { tone: 'danger', message: removeError })
      return
    }
    toast.show('Coupon removed', { tone: 'default' })
  }

  const otherOffers = offers.filter((offer) => offer.id !== appliedId)
  const offersList =
    otherOffers.length > 0 ? (
      <YStack gap="$2">
        <XStack
          alignItems="center"
          gap="$2"
          cursor="pointer"
          onPress={() => setOffersOpen((open) => !open)}
        >
          <Icons.Sparkles size={15} color={ui.brand} />
          <Text fontSize={13} fontWeight="700" color={ui.brand}>
            {appliedId
              ? `${otherOffers.length} other ${otherOffers.length === 1 ? 'offer' : 'offers'}`
              : `${otherOffers.length} ${otherOffers.length === 1 ? 'offer' : 'offers'} available`}
          </Text>
          {offersOpen ? (
            <Icons.ChevronUp size={16} color={ui.brand} />
          ) : (
            <Icons.ChevronDown size={16} color={ui.brand} />
          )}
        </XStack>

        {offersOpen ? (
          <YStack gap="$2">
            {otherOffers.map((offer) => {
              const eligibleSubtotal = offerEligibleSubtotal(offer, subtotal, items)
              const eligible = isOfferEligible(offer, subtotal, items)
              const shortfall =
                offer.minOrderAmount == null ? 0 : Math.max(0, offer.minOrderAmount - eligibleSubtotal)
              const busy = applyingCode === offer.code.toUpperCase()
              return (
                <YStack
                  key={offer.id}
                  gap="$2"
                  padding="$3"
                  borderRadius={radius.chip}
                  borderWidth={1}
                  borderStyle="dashed"
                  borderColor={ui.border}
                  backgroundColor={ui.surfaceMuted}
                >
                  <XStack alignItems="center" gap="$2" flexWrap="wrap">
                    <XStack
                      alignItems="center"
                      gap="$1.5"
                      paddingHorizontal="$2.5"
                      paddingVertical="$1"
                      borderRadius={radius.chip}
                      backgroundColor={ui.badgeBrandBg}
                    >
                      <Icons.Tag size={12} color={ui.badgeBrandText} />
                      <Text fontSize={12} fontWeight="800" color={ui.badgeBrandText}>
                        {offer.code}
                      </Text>
                    </XStack>
                    <Text fontSize={12} fontWeight="700" color={ui.success}>
                      {offerBadgeLabel(offer, currency)}
                    </Text>
                  </XStack>

                  <Text fontSize={13} color={ui.text} fontWeight="600" numberOfLines={1}>
                    {offer.name}
                  </Text>
                  {offer.description ? (
                    <Text fontSize={12} color={ui.textSecondary} numberOfLines={2}>
                      {offer.description}
                    </Text>
                  ) : null}

                  <XStack alignItems="center" justifyContent="space-between" gap="$2">
                    <Text fontSize={11.5} color={ui.textMuted} flex={1} numberOfLines={1}>
                      {offer.minOrderAmount
                        ? `Min. order ${formatCurrency(offer.minOrderAmount, currency)}`
                        : 'No minimum order'}
                    </Text>
                    {eligible ? (
                      <Button
                        tone="outline"
                        size="$2"
                        borderRadius={radius.chip}
                        disabled={busy}
                        onPress={() => void handleApply(offer.code, true)}
                      >
                        {busy ? <Spinner size="small" /> : appliedId ? 'Switch' : 'Apply'}
                      </Button>
                    ) : (
                      <Text fontSize={11.5} fontWeight="600" color={ui.textSecondary}>
                        Add {formatCurrency(shortfall, currency)} more
                      </Text>
                    )}
                  </XStack>
                </YStack>
              )
            })}
          </YStack>
        ) : null}
      </YStack>
    ) : null

  if (appliedId) {
    return (
      <YStack gap="$3">
        <YStack
          gap="$2"
          padding="$3"
          borderRadius={radius.chip}
          borderWidth={1}
          borderColor={ui.success}
          backgroundColor={ui.badgeSuccessBg}
        >
          <XStack alignItems="center" gap="$2.5">
            <Icons.BadgeCheck size={20} color={ui.success} />
            <YStack flex={1} minWidth={0} gap={1}>
              <Text fontWeight="700" fontSize={14} color={ui.text} numberOfLines={1}>
                {appliedName ?? 'Coupon applied'}
              </Text>
              <Text fontSize={12} color={ui.textSecondary}>
                {couponAutoApplied ? 'Best offer applied · ' : ''}You saved{' '}
                {formatCurrency(discountAmount, currency)}
              </Text>
            </YStack>
            <Button
              tone="ghost"
              size="$2"
              color={ui.danger}
              disabled={removing}
              onPress={handleRemove}
              icon={removing ? <Spinner size="small" /> : <Icons.X size={15} />}
            >
              Remove
            </Button>
          </XStack>
        </YStack>
        {offersList}
      </YStack>
    )
  }

  return (
    <YStack gap="$3">
      <XStack alignItems="center" gap="$2">
        <XStack
          flex={1}
          alignItems="center"
          gap="$2"
          paddingHorizontal="$3"
          borderRadius={radius.chip}
          borderWidth={1}
          borderColor={error ? ui.error : ui.borderSubtle}
          backgroundColor={ui.inputBackground}
        >
          <Icons.TicketPercent size={18} color={ui.icon} />
          <Input
            flex={1}
            borderWidth={0}
            paddingHorizontal={0}
            backgroundColor="transparent"
            placeholder="Enter coupon code"
            autoCapitalize="characters"
            value={code}
            onChangeText={(next) => {
              setCode(next)
              if (error) setError(null)
            }}
            onSubmitEditing={() => void handleApply(code)}
          />
        </XStack>
        <Button
          tone="primary"
          size="$3.5"
          borderRadius={radius.chip}
          disabled={applying || !code.trim()}
          onPress={() => void handleApply(code)}
        >
          {applying ? <Spinner size="small" color="white" /> : 'Apply'}
        </Button>
      </XStack>

      {error ? (
        <Text fontSize={12} color={ui.error}>
          {error}
        </Text>
      ) : null}

      {offersList}
    </YStack>
  )
}
