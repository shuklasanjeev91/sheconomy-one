import { useEffect, useMemo, useState } from 'react'
import { Keyboard } from 'react-native'

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
import { getShadowStyle, radius, touchSlop } from '~/config/tokens'
import { useCart } from '~/commerce/hooks/useCart'
import { filterSelectedCartItems } from '~/commerce/lib/cart-selection'
import {
  fetchAvailableOffers,
  offerBadgeLabel,
  toCartOfferItems,
  type AvailableOffer,
  type CartOfferFetchContext,
} from '~/commerce/lib/discounts'
import { formatCurrency } from '~/lib/format'
import { useAppUi, useIsDarkTheme } from '~/lib/theme/useAppUi'

const FIELD_HEIGHT = 48

export function CartCoupon() {
  const ui = useAppUi()
  const isDark = useIsDarkTheme()
  const toast = useAppToast()
  const { cart, items, applyCoupon, removeCoupon, couponAutoApplied } = useCart()

  const [code, setCode] = useState('')
  const [focused, setFocused] = useState(false)
  const [applying, setApplying] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offers, setOffers] = useState<AvailableOffer[]>([])
  const [offersOpen, setOffersOpen] = useState(false)
  const [applyingCode, setApplyingCode] = useState<string | null>(null)

  const selectedItems = useMemo(() => filterSelectedCartItems(items), [items])
  const cartOfferItems = useMemo(() => toCartOfferItems(selectedItems), [selectedItems])
  const selectedSubtotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
    [selectedItems],
  )

  const currency = cart?.currency ?? 'INR'
  const appliedId = cart?.applied_discount_id ?? null
  const appliedName = cart?.applied_discount_name ?? null
  const discountAmount = cart?.discount_amount ?? 0

  const cartContext = useMemo<CartOfferFetchContext>(
    () => ({ subtotal: selectedSubtotal, items: cartOfferItems }),
    [selectedSubtotal, cartOfferItems],
  )
  const contextKey = `${selectedSubtotal}:${cartOfferItems.map((i) => i.listing_id).sort().join(',')}`

  useEffect(() => {
    if (selectedSubtotal <= 0 || cartOfferItems.length === 0) {
      setOffers([])
      return
    }
    let active = true
    const shopIds = [
      ...new Set(selectedItems.map((item) => item.shop_id).filter((id): id is string => !!id)),
    ]
    const listingIds = cartOfferItems.map((item) => item.listing_id)
    void fetchAvailableOffers({ shopIds, listingIds, cartContext }).then((rows) => {
      if (!active) return
      setOffers(rows)
    })
    return () => {
      active = false
    }
  }, [contextKey, cartContext, selectedItems])

  if (!cart || selectedSubtotal <= 0) return null

  async function handleApply(rawCode: string, fromOffer = false) {
    const trimmed = rawCode.trim()
    if (!trimmed) {
      setError('Enter a coupon code.')
      return
    }
    Keyboard.dismiss()
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
          minHeight={42}
          paddingHorizontal="$3"
          borderRadius={radius.chip}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          cursor="pointer"
          pressStyle={{ backgroundColor: ui.surfaceHover }}
          accessibilityRole="button"
          accessibilityLabel={offersOpen ? 'Hide offers' : 'Show offers'}
          onPress={() => setOffersOpen((open) => !open)}
        >
          <Icons.Sparkles size={15} color={ui.brand} />
          <Text flex={1} minWidth={0} fontSize={13} fontWeight="700" color={ui.brand}>
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
                    <Text fontSize={11.5} color={ui.textMuted} flex={1} minWidth={0} numberOfLines={1}>
                      {offer.minOrderAmount
                        ? `Min. order ${formatCurrency(offer.minOrderAmount, currency)}`
                        : 'No minimum order'}
                    </Text>
                    <Button
                      tone="outline"
                      size="$2"
                      height={36}
                      minWidth={84}
                      borderRadius={radius.chip}
                      disabled={busy}
                      onPress={() => void handleApply(offer.code, true)}
                    >
                      {busy ? <Spinner size="small" /> : appliedId ? 'Switch' : 'Apply'}
                    </Button>
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
          padding="$3.5"
          borderRadius={radius.card}
          borderWidth={1.5}
          borderStyle="dashed"
          borderColor={ui.success}
          backgroundColor={ui.surfaceMuted}
          style={getShadowStyle('sm', isDark ? 'dark' : 'light')}
        >
          <XStack alignItems="center" gap="$2.5">
            <YStack
              width={36}
              height={36}
              flexShrink={0}
              borderRadius={radius.chip}
              alignItems="center"
              justifyContent="center"
              backgroundColor={ui.badgeSuccessBg}
            >
              <Icons.BadgeCheck size={20} color={ui.badgeSuccessText} />
            </YStack>

            <YStack flex={1} minWidth={0} gap={2}>
              <XStack alignItems="center" gap="$1.5" flexWrap="wrap">
                <Text fontWeight="800" fontSize={14} color={ui.text} numberOfLines={1}>
                  {appliedName ?? 'Coupon applied'}
                </Text>
                {couponAutoApplied ? (
                  <XStack
                    paddingHorizontal="$2"
                    paddingVertical={2}
                    borderRadius={radius.chip}
                    backgroundColor={ui.badgeBrandBg}
                  >
                    <Text fontSize={10} fontWeight="800" color={ui.badgeBrandText} letterSpacing={0.4}>
                      BEST OFFER
                    </Text>
                  </XStack>
                ) : null}
              </XStack>
              <Text fontSize={12} color={ui.textSecondary}>
                You saved{' '}
                <Text fontSize={12} fontWeight="800" color={ui.success}>
                  {formatCurrency(discountAmount, currency)}
                </Text>{' '}
                on this order
              </Text>
            </YStack>

            <Button
              tone="ghost"
              size="$2"
              height={36}
              flexShrink={0}
              paddingHorizontal="$2.5"
              borderRadius={radius.chip}
              color={ui.danger}
              disabled={removing}
              accessibilityLabel="Remove coupon"
              onPress={handleRemove}
              icon={removing ? <Spinner size="small" /> : <Icons.X size={15} color={ui.danger} />}
            >
              Remove
            </Button>
          </XStack>
        </YStack>
        {offersList}
      </YStack>
    )
  }

  const fieldBorderColor = error ? ui.error : focused ? ui.brand : ui.border
  const canApply = code.trim().length > 0 && !applying

  return (
    <YStack gap="$3">
      <YStack
        gap="$3"
        padding="$3.5"
        borderRadius={radius.card}
        borderWidth={1.5}
        borderStyle="dashed"
        borderColor={error ? ui.error : ui.border}
        backgroundColor={ui.surfaceMuted}
        style={getShadowStyle('sm', isDark ? 'dark' : 'light')}
      >
        <XStack alignItems="center" gap="$2.5">
          <YStack
            width={36}
            height={36}
            flexShrink={0}
            borderRadius={radius.chip}
            alignItems="center"
            justifyContent="center"
            backgroundColor={ui.badgeBrandBg}
          >
            <Icons.TicketPercent size={20} color={ui.badgeBrandText} />
          </YStack>
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={1}>
              Apply coupon
            </Text>
            <Text fontSize={12} color={ui.textSecondary} numberOfLines={1}>
              Have a code? Redeem it for extra savings.
            </Text>
          </YStack>
        </XStack>

        <XStack alignItems="center" gap="$2">
          <XStack
            flex={1}
            minWidth={0}
            alignItems="center"
            gap="$2"
            height={FIELD_HEIGHT}
            paddingHorizontal="$3"
            borderRadius={radius.chip}
            borderWidth={1.5}
            borderColor={fieldBorderColor}
            backgroundColor={ui.inputBackground}
          >
            <Icons.TicketPercent size={18} color={fieldBorderColor} />
            <Input
              flex={1}
              minWidth={0}
              borderWidth={0}
              paddingHorizontal={0}
              backgroundColor="transparent"
              fontSize={15}
              color={ui.inputText}
              placeholder="Enter coupon code"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={32}
              returnKeyType="done"
              enterKeyHint="done"
              accessibilityLabel="Coupon code"
              value={code}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChangeText={(next) => {
                setCode(next.toUpperCase().replace(/\s+/g, ''))
                if (error) setError(null)
              }}
              onSubmitEditing={() => void handleApply(code)}
            />
            {code.length > 0 ? (
              <YStack
                width={22}
                height={22}
                flexShrink={0}
                borderRadius={radius.pill}
                alignItems="center"
                justifyContent="center"
                backgroundColor={ui.chip}
                cursor="pointer"
                hitSlop={touchSlop(22)}
                pressStyle={{ opacity: 0.6 }}
                accessibilityRole="button"
                accessibilityLabel="Clear coupon code"
                onPress={() => {
                  setCode('')
                  setError(null)
                }}
              >
                <Icons.X size={13} color={ui.icon} />
              </YStack>
            ) : null}
          </XStack>

          <Button
            tone="primary"
            height={FIELD_HEIGHT}
            minWidth={96}
            flexShrink={0}
            paddingHorizontal="$4"
            borderRadius={radius.chip}
            disabled={!canApply}
            accessibilityLabel="Apply coupon"
            onPress={() => void handleApply(code)}
          >
            {applying ? <Spinner size="small" color={ui.onBrand} /> : 'Apply'}
          </Button>
        </XStack>

        {error ? (
          <XStack alignItems="center" gap="$1.5">
            <Icons.AlertCircle size={14} color={ui.error} />
            <Text flex={1} minWidth={0} fontSize={12} color={ui.error}>
              {error}
            </Text>
          </XStack>
        ) : null}
      </YStack>

      {offersList}
    </YStack>
  )
}
