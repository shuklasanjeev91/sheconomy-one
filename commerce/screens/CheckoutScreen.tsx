import { useRouter } from 'one'
import { Platform } from 'react-native'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'
import { AppLink } from '~/components/navigation/AppLink'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  Field,
  Icons,
  Image,
  Input,
  Paragraph,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection, StickyRail } from '~/components/layout'
import { useCart } from '~/commerce/hooks/useCart'
import { useStorefrontCartItems } from '~/commerce/hooks/useStorefrontCartItems'
import { useShopPartners } from '~/commerce/hooks/useShopPartners'
import { useShopHeaders } from '~/commerce/hooks/useShopHeaders'
import {
  CartCoupon,
  CheckoutContactSection,
  CommerceButton,
  CommerceLink,
  CommerceMobileCheckoutBar,
  COMMERCE_MOBILE_CHECKOUT_BAR_HEIGHT,
  CommerceRadio,
  ShopPartnerChips,
  ShopRatingBadge,
  useCommercePalette,
} from '~/commerce/components'
import {
  checkCartStock,
  cancelCheckoutPayment,
  createAtomicMarketplaceCheckout,
  fetchUserAddresses,
  saveUserAddress,
  type CheckoutAddressInput,
  type CheckoutPaymentMode,
  type UserAddress,
} from '~/commerce/lib/checkout'
import { ensureShepayCheckoutUrl } from '~/commerce/lib/shepay'
import { ensureDirectCheckoutUrl } from '~/commerce/lib/razorpay-direct'
import {
  checkoutShippingLabel,
  onlinePaymentOptionCopy,
  resolvePostCheckoutNext,
} from '~/commerce/lib/checkout-payment-route'
import { savePendingOrderSuccess } from '~/commerce/lib/customer-orders'
import {
  computeCheckoutShippingQuote,
  fetchDeliveryProfilesByShopIds,
} from '~/commerce/lib/checkout-shipping'
import type { ShippingPolicy } from '~/lib/shipping-policy/shipping-policy.type'
import { computeSelectedTotals, useCartSelection } from '~/commerce/lib/cart-selection'
import { ensureCartDiscountValidForCheckout, toCartOfferItems } from '~/commerce/lib/discounts'
import { cartRequiresShipping, fetchListingTypesByIds } from '~/commerce/lib/listing-fulfillment'
import { paymentCollectionFor } from '~/commerce/lib/shop-commerce'
import { deliveryEstimateLabel } from '~/commerce/lib/delivery-estimate'
import {
  buildCustomerAmountsByShop,
  computeCheckoutDisplayTotals,
  computeShopDisplaySubtotal,
  shopCurrencyFor,
} from '~/commerce/lib/checkout-display-pricing'
import { useFormatCurrency } from '~/hooks/useFormatCurrency'
import { useFormValidation } from '~/hooks/useFormValidation'
import { useProfile } from '~/hooks/useProfile'
import { openExternalUrl } from '~/lib/platform/openUrl'
import { commerceRoutes, routes } from '~/lib/routes'
import { createEmptyAddressInput } from '~/commerce/components/AddressForm'
import { validateAddressInput } from '~/commerce/lib/addresses'
import { LocationFields, addressGeoFromInput, patchAddressFromGeo } from '~/components/geo'
import {
  AddressAutocompleteField,
  DeliveryPinCheck,
  LocationAssistActions,
} from '~/components/location'
import {
  readRecentAddresses,
  rememberRecentAddress,
  resolvedAddressToFormPatch,
  type RecentAddressSnapshot,
  type ResolvedAddress,
} from '~/lib/location'
import { maxLength, minLength, required } from '~/lib/validation'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'
import { resolveAuthContact } from '~/features/auth/services/account-contact'
import { trackCommerceEvent } from '~/lib/analytics'
import { navigateApp, replaceApp } from '~/lib/platform/navigate'

const SUMMARY_WIDTH = 320

export function CheckoutScreen() {
  const c = useCommercePalette()
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()
  const { user, isAuthenticated } = useProfile()
  const { formatMoney, convertMoney, preferredCurrency } = useFormatCurrency()
  const { cart, items: cartItems, isLoading, refresh } = useCart()
  const { items, isChecking } = useStorefrontCartItems(cartItems)
  const toast = useAppToast()

  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [recentAddresses, setRecentAddresses] = useState<RecentAddressSnapshot[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [useNewAddress, setUseNewAddress] = useState(false)
  const [newAddress, setNewAddress] = useState<CheckoutAddressInput>(() => createEmptyAddressInput())
  const addressForm = useFormValidation(
    useMemo(
      () => ({
        address_line_1: { validators: [required('Address line 1 is required.'), minLength(3)] },
        address_line_2: { validators: [maxLength(120)] },
      }),
      [],
    ),
  )
  const [notesByShop, setNotesByShop] = useState<Record<string, string>>({})
  const [giftByShop, setGiftByShop] = useState<Record<string, boolean>>({})
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMode>('online')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRedirectingToPayment, setIsRedirectingToPayment] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true)
  const [listingTypes, setListingTypes] = useState<Map<string, string>>(new Map())
  const [deliveryProfilesByShop, setDeliveryProfilesByShop] = useState(
    () => new Map<string, ShippingPolicy[]>(),
  )
  const checkoutAttemptKey = useRef<string | null>(null)
  const [contactCheckoutReady, setContactCheckoutReady] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)

  const authContact = useMemo(() => resolveAuthContact(user), [user])

  useEffect(() => {
    setContactCheckoutReady(authContact.checkoutReady)
  }, [authContact.checkoutReady])

  const availableIds = useMemo(() => items.map((item) => item.id), [items])
  const { isSelected, noneSelected, selectedIds } = useCartSelection(availableIds)
  const selectedIdsKey = useMemo(
    () => [...selectedIds].sort().join(','),
    [[...selectedIds].sort().join(',')],
  )
  const itemShopKey = useMemo(
    () => items.map((item) => `${item.id}:${item.shop_id}:${item.shop_name}`).join('|'),
    [items],
  )
  const { selectedItems, subtotal, unitCount, discount, total } = computeSelectedTotals(
    cart,
    items,
    isSelected,
  )

  useEffect(() => {
    if (!selectedItems.length || !cart?.id) return
    trackCommerceEvent('begin_checkout', {
      currency: cart.currency ?? 'INR',
      value: total,
      items: selectedItems.map((item) => ({
        id: item.listing_id,
        name: item.listing_id,
        price: item.unit_price ?? undefined,
        quantity: item.quantity,
      })),
    })
  }, [cart?.id, selectedItems.length])

  const orderShops = useMemo(() => {
    const selected = new Set(selectedIds)
    const map = new Map<string, string>()
    for (const item of items) {
      if (!selected.has(item.id)) continue
      if (!map.has(item.shop_id)) map.set(item.shop_id, item.shop_name)
    }
    return [...map.entries()].map(([shopId, shopName]) => ({ shopId, shopName }))
  }, [itemShopKey, selectedIdsKey])

  const shopIdsKey = useMemo(() => {
    const selected = new Set(selectedIdsKey ? selectedIdsKey.split(',') : [])
    const ids = new Set<string>()
    for (const item of items) {
      if (!selected.has(item.id) || !item.shop_id) continue
      ids.add(item.shop_id)
    }
    return [...ids].sort().join(',')
  }, [itemShopKey, selectedIdsKey])

  useEffect(() => {
    if (!shopIdsKey) {
      setDeliveryProfilesByShop((prev) => (prev.size === 0 ? prev : new Map()))
      return
    }
    const shopIds = shopIdsKey.split(',')
    let active = true
    void fetchDeliveryProfilesByShopIds(shopIds)
      .then((profiles) => {
        if (!active) return
        setDeliveryProfilesByShop((prev) => {
          if (prev.size === profiles.size) {
            let unchanged = true
            for (const [shopId, rows] of profiles) {
              const existing = prev.get(shopId)
              if (!existing || existing.length !== rows.length) {
                unchanged = false
                break
              }
            }
            if (unchanged) return prev
          }
          return profiles
        })
      })
      .catch(() => {
        if (active) setDeliveryProfilesByShop((prev) => (prev.size === 0 ? prev : new Map()))
      })
    return () => {
      active = false
    }
  }, [shopIdsKey])

  const needsShipping = cartRequiresShipping(
    listingTypes,
    selectedItems.map((item) => item.listing_id),
  )

  const checkoutAddressDraft = useMemo(
    (): CheckoutAddressInput => ({
      ...newAddress,
      address_line_1: addressForm.fields.address_line_1.value.trim(),
      address_line_2: addressForm.fields.address_line_2.value.trim(),
    }),
    [
      addressForm.fields.address_line_1.value,
      addressForm.fields.address_line_2.value,
      newAddress,
    ],
  )

  const addressReady = useMemo(() => {
    if (!needsShipping) return true
    if (useNewAddress) return !validateAddressInput(checkoutAddressDraft)
    return Boolean(selectedAddressId)
  }, [checkoutAddressDraft, needsShipping, selectedAddressId, useNewAddress])

  const addressRequirementMessage = useMemo(() => {
    if (!needsShipping || addressReady) return null
    if (!useNewAddress) {
      return addresses.length > 0
        ? 'Select a delivery address to continue.'
        : 'Add a delivery address to continue.'
    }
    if (
      addresses.length === 0 &&
      !checkoutAddressDraft.address_line_1.trim() &&
      !checkoutAddressDraft.city.trim()
    ) {
      return 'Add a delivery address to continue.'
    }
    return validateAddressInput(checkoutAddressDraft) ?? 'Add a delivery address to continue.'
  }, [addressReady, addresses.length, checkoutAddressDraft, needsShipping, useNewAddress])

  const deliveryAddressNotice = addressError ?? addressRequirementMessage

  useEffect(() => {
    if (addressReady) setAddressError(null)
  }, [addressReady])

  useEffect(() => {
    setAddressError(null)
  }, [
    checkoutAddressDraft.address_line_1,
    checkoutAddressDraft.address_line_2,
    checkoutAddressDraft.city,
    checkoutAddressDraft.state,
    checkoutAddressDraft.postal_code,
    checkoutAddressDraft.country,
    selectedAddressId,
    useNewAddress,
  ])

  const shippingQuote = useMemo(
    () =>
      computeCheckoutShippingQuote({
        cart,
        selectedItems,
        listingTypes,
        deliveryProfilesByShop,
        selectedSubtotal: subtotal,
        selectedDiscount: discount,
      }),
    [cart, deliveryProfilesByShop, discount, listingTypes, selectedItems, subtotal],
  )

  const orderTotal = needsShipping ? shippingQuote.grandTotal : total
  const shopIds = useMemo(() => (shopIdsKey ? shopIdsKey.split(',') : []), [shopIdsKey])
  const { partners: shopPartners } = useShopPartners(shopIds)
  const shopHeaders = useShopHeaders(shopIds)
  const settlementCurrency = cart?.currency ?? 'INR'
  const shopCurrencies = useMemo(() => {
    const map = new Map<string, string>()
    for (const [shopId, header] of shopHeaders) {
      map.set(shopId, header.shopCurrency)
    }
    return map
  }, [shopHeaders])

  const displayTotals = useMemo(
    () =>
      computeCheckoutDisplayTotals({
        selectedItems,
        subtotal,
        discount,
        shippingQuote,
        needsShipping,
        shopCurrencies,
        convertMoney,
        settlementCurrency,
      }),
    [
      convertMoney,
      discount,
      needsShipping,
      selectedItems,
      settlementCurrency,
      shippingQuote,
      shopCurrencies,
      subtotal,
    ],
  )

  const customerAmountsByShop = useMemo(
    () =>
      buildCustomerAmountsByShop({
        selectedItems,
        subtotal,
        discount,
        shippingQuote,
        shopCurrencies,
        convertMoney,
        settlementCurrency,
      }),
    [
      convertMoney,
      discount,
      selectedItems,
      settlementCurrency,
      shippingQuote,
      shopCurrencies,
      subtotal,
    ],
  )

  const formatCheckoutMoney = useCallback(
    (amount: number, sourceCurrency?: string | null) =>
      formatMoney(amount, sourceCurrency ?? preferredCurrency, {
        convert: sourceCurrency ? undefined : false,
      }),
    [formatMoney, preferredCurrency],
  )

  const multiShop = orderShops.length > 1

  // Group shops by who collects the money. Every SHEPay shop can be collected in a
  // single SHEconomy payment; each seller with their own gateway is paid directly
  // (0% commission), so it forms its own payment.
  const paymentGroups = useMemo(() => {
    const shepay: { shopId: string; shopName: string }[] = []
    const direct: { shopId: string; shopName: string; gateway: string }[] = []
    for (const shop of orderShops) {
      const info = shopPartners.get(shop.shopId)
      if (paymentCollectionFor(info) === 'direct') {
        direct.push({ ...shop, gateway: info?.paymentLabel ?? 'their gateway' })
      } else {
        shepay.push(shop)
      }
    }
    return { shepay, direct }
  }, [orderShops, shopPartners])

  const paymentStepCount = (paymentGroups.shepay.length ? 1 : 0) + paymentGroups.direct.length
  const onlineCopy = useMemo(
    () =>
      onlinePaymentOptionCopy({
        shepayShops: paymentGroups.shepay,
        directShops: paymentGroups.direct,
      }),
    [paymentGroups],
  )

  useEffect(() => {
    const ids = items.map((item) => item.listing_id)
    if (!ids.length) {
      setListingTypes(new Map())
      return
    }
    void fetchListingTypesByIds(ids).then(setListingTypes)
  }, [items])

  useEffect(() => {
    void readRecentAddresses().then(setRecentAddresses)
  }, [])

  const userId = user?.id ?? null

  useEffect(() => {
    if (!isAuthenticated || !userId) return

    setIsLoadingAddresses(true)
    fetchUserAddresses(userId)
      .then(({ addresses: rows, error }) => {
        setAddresses(rows)
        const defaultAddress = rows.find((row) => row.is_default) ?? rows[0]
        setSelectedAddressId(defaultAddress?.id ?? null)
        setUseNewAddress(rows.length === 0)
        if (error) toast.show('Could not load addresses', { tone: 'danger', message: error })
      })
      .catch(() => toast.show('Could not load addresses', { tone: 'danger' }))
      .finally(() => setIsLoadingAddresses(false))
  }, [isAuthenticated, toast, userId])

  if (!isAuthenticated) {
    return <SpaRedirect href={routes.signIn} />
  }

  if (isLoading || isLoadingAddresses || isChecking) {
    return (
      <FullWidthLayout>
        <PageSection paddingVertical="$10" alignItems="center">
          <Spinner size="large" />
        </PageSection>
      </FullWidthLayout>
    )
  }

  if (!orderPlaced && (!cart || items.length === 0)) {
    return <SpaRedirect href={commerceRoutes.cart} />
  }
  if (!cart) {
    return <SpaRedirect href={commerceRoutes.home} />
  }

  const showSettlementCurrencyNote = preferredCurrency !== settlementCurrency

  // Pure Razorpay-direct order: no SHEPay steps involved, payment mode is online.
  // Used to contextualise button labels so the user understands they are going
  // to a payment gateway, not placing a confirmed order.
  const isRazorpayDirectOnly =
    paymentMethod === 'online' &&
    paymentGroups.direct.length > 0 &&
    paymentGroups.shepay.length === 0

  const placeLabel = isRazorpayDirectOnly ? 'Continue to payment' : 'Place your order'
  const submittingLabel = isRazorpayDirectOnly ? 'Setting up payment…' : 'Placing…'

  const canPlace =
    !noneSelected &&
    !isSubmitting &&
    !isRedirectingToPayment &&
    !isLoadingAddresses &&
    contactCheckoutReady &&
    addressReady
  const showMobileBar = !isDesktop && !orderPlaced

  function handlePlaceOrderPress() {
    if (needsShipping && !addressReady) {
      const message = addressRequirementMessage ?? 'Add a delivery address to continue.'
      setAddressError(message)
      toast.show('Delivery address required', { tone: 'warning', message })
      return
    }
    if (!contactCheckoutReady) {
      toast.show('Verify your mobile', {
        tone: 'warning',
        message: 'Add and verify a mobile number before placing your order.',
      })
      return
    }
    if (!canPlace) return
    void handlePlaceOrder()
  }

  async function handlePlaceOrder() {
    if (!cart || !user || noneSelected || !contactCheckoutReady) {
      if (!contactCheckoutReady) {
        toast.show('Verify your mobile', {
          tone: 'warning',
          message: 'Add and verify a mobile number before placing your order.',
        })
      }
      return
    }
    if (needsShipping && !addressReady) {
      const message = addressRequirementMessage ?? 'Add a delivery address to continue.'
      setAddressError(message)
      toast.show('Delivery address required', { tone: 'warning', message })
      return
    }
    setIsSubmitting(true)

    let shippingAddressId = selectedAddressId
    /** Web Razorpay same-tab handoff — leave the button in a busy state until navigation. */
    let keepSubmittingForRedirect = false

    try {
      // Validate stock up-front so a multi-shop order never places some orders
      // and then fails midway on an out-of-stock item.
      const { issues, error: stockError } = await checkCartStock(
        selectedItems.map((item) => ({ listingId: item.listing_id, quantity: item.quantity })),
      )
      if (stockError) {
        toast.show('Could not verify stock', { tone: 'danger', message: stockError })
        return
      }
      if (issues.length > 0) {
        const first = issues[0]
        toast.show('Not enough stock', {
          tone: 'danger',
          message:
            issues.length === 1
              ? `Only ${first.available} left of "${first.title}". Update the quantity in your cart.`
              : `${issues.length} items exceed available stock. Update quantities in your cart.`,
        })
        navigateApp(commerceRoutes.cart)
        return
      }

      if (needsShipping) {
        if (useNewAddress) {
          if (!addressForm.validateAll()) {
            return
          }
          const draftAddress: CheckoutAddressInput = {
            ...newAddress,
            address_line_1: addressForm.fields.address_line_1.value.trim(),
            address_line_2: addressForm.fields.address_line_2.value.trim(),
          }
          const addressValidationError = validateAddressInput(draftAddress)
          if (addressValidationError) {
            toast.show('Check your address', { tone: 'danger', message: addressValidationError })
            return
          }
          const { address, error } = await saveUserAddress(user.id, draftAddress)
          if (error || !address) {
            toast.show('Could not save address', { tone: 'danger', message: error ?? undefined })
            return
          }
          shippingAddressId = address.id
        }
        if (!shippingAddressId) {
          toast.show('Select a delivery address', { tone: 'danger' })
          return
        }
      } else if (!shippingAddressId && addresses[0]?.id) {
        shippingAddressId = addresses[0].id
      }

      if (!shippingAddressId) {
        toast.show('Add an address for your order records', { tone: 'danger' })
        return
      }

      const mode: CheckoutPaymentMode = needsShipping ? paymentMethod : 'online'
      const selectionKey = selectedItems
        .map((item) => item.id)
        .sort()
        .join(',')

      if (cart.applied_discount_id) {
        const { removed } = await ensureCartDiscountValidForCheckout(
          cart,
          toCartOfferItems(selectedItems),
        )
        if (removed) {
          await refresh()
          toast.show('Coupon removed', {
            tone: 'default',
            message:
              'The applied offer no longer applies to your selected items. Review your order and try again.',
          })
          return
        }
      }

      if (
        !checkoutAttemptKey.current ||
        !checkoutAttemptKey.current.includes(`:${selectionKey}:`)
      ) {
        checkoutAttemptKey.current = `${user.id}:${cart.id}:${selectionKey}:${Date.now()}`
      }
      const result = await createAtomicMarketplaceCheckout({
        cartId: cart.id,
        cartItemIds: selectedItems.map((item) => item.id),
        shippingAddressId,
        billingAddressId: shippingAddressId,
        paymentMode: mode,
        idempotencyKey: checkoutAttemptKey.current,
        notesByShop,
        giftShopIds: Object.entries(giftByShop)
          .filter(([, enabled]) => enabled)
          .map(([shopId]) => shopId),
        customerCurrency: preferredCurrency,
        customerAmountsByShop: customerAmountsByShop,
      })
      if (result.error || !result.data) {
        toast.show('Checkout failed', {
          tone: 'danger',
          message: result.error ?? 'Please try again.',
        })
        return
      }

      const { orderIds, orderNumbers, checkoutGroupId } = result.data
      let checkoutUrl =
        result.data.paymentSteps.find((step) => step.checkoutUrl)?.checkoutUrl ?? null
      let paymentSetupError: string | null = null
      const hasShepaySteps = result.data.paymentSteps.some((step) => step.collection === 'shepay')
      const hasDirectSteps = result.data.paymentSteps.some((step) => step.collection === 'direct')

      if (mode === 'online' && hasShepaySteps && !checkoutUrl) {
        const shepay = await ensureShepayCheckoutUrl(result.data.paymentSteps, {
          paymentMethodId: null,
        })
        paymentSetupError = shepay.error
        checkoutUrl = shepay.checkoutUrl
      }

      if (mode === 'online' && hasDirectSteps && !checkoutUrl) {
        const direct = await ensureDirectCheckoutUrl(result.data.paymentSteps)
        paymentSetupError = paymentSetupError ?? direct.error
        checkoutUrl = direct.checkoutUrl ?? checkoutUrl
      }

      const usedAddress =
        addresses.find((row) => row.id === shippingAddressId) ??
        (useNewAddress
          ? ({
              address_line_1: newAddress.address_line_1,
              address_line_2: newAddress.address_line_2,
              city: newAddress.city,
              state: newAddress.state,
              postal_code: newAddress.postal_code,
              country: newAddress.country,
              address_label: newAddress.address_label,
            } as RecentAddressSnapshot)
          : null)
      if (usedAddress) {
        void rememberRecentAddress(usedAddress as never).then(setRecentAddresses)
      }

      const next = resolvePostCheckoutNext({
        mode,
        checkoutUrl,
        shepayError: paymentSetupError,
        hasShepaySteps: hasShepaySteps || hasDirectSteps,
      })

      if (next.kind === 'cancel_and_stay') {
        if (checkoutGroupId) {
          await cancelCheckoutPayment(checkoutGroupId)
        }
        toast.show('Payment setup incomplete', {
          tone: 'danger',
          message: next.error,
        })
        return
      }

      const awaitingExternalPayment = next.kind === 'payu_bridge' || next.kind === 'external_pay'
      const pendingUrl =
        next.kind === 'payu_bridge' ? next.href : next.kind === 'external_pay' ? next.url : null

      if (orderIds.length > 0) {
        await savePendingOrderSuccess({
          orderIds,
          orderNumbers,
          createdAt: Date.now(),
          paymentMode: mode,
          awaitingExternalPayment,
          checkoutGroupId,
          checkoutUrl: pendingUrl,
        })
      }

      const successHref = commerceRoutes.orderSuccess(orderIds)

      if (next.kind === 'payu_bridge') {
        setOrderPlaced(true)
        void refresh()
        replaceApp(next.href as never)
        return
      }

      if (next.kind === 'external_pay') {
        const isRazorpayDirect = hasDirectSteps && !hasShepaySteps
        if (Platform.OS === 'web' && isRazorpayDirect && typeof window !== 'undefined') {
          // Same-tab redirect: razorpay-return handles the callback.
          // Do NOT set orderPlaced — the page is destroyed immediately after redirect.
          // The button switches to "Redirecting to payment…" for the brief moment before navigation.
          keepSubmittingForRedirect = true
          setIsRedirectingToPayment(true)
          setTimeout(() => {
            window.location.href = next.url
          }, 120)
          return
        }
        // Native / non-Razorpay external: navigate first, then open payment (never await
        // Linking.openURL — it can hang while Safari is open and looks like infinite loading).
        setOrderPlaced(true)
        replaceApp(successHref)
        void refresh()
        void openExternalUrl(next.url).then((opened) => {
          if (!opened) {
            toast.show('Complete payment', {
              tone: 'info',
              message: 'Allow pop-ups, or use Resume payment on the next screen.',
            })
          }
        })
        return
      }

      // COD / fully settled at checkout — show success immediately.
      setOrderPlaced(true)
      trackCommerceEvent('purchase', {
        currency: settlementCurrency,
        value: orderTotal,
        transactionId: orderNumbers[0] ?? orderIds[0] ?? cart.id,
        items: selectedItems.map((item) => ({
          id: item.listing_id,
          name: item.listing_id,
          price: item.unit_price ?? undefined,
          quantity: item.quantity,
        })),
      })

      toast.show('Order placed', {
        tone: 'success',
        message:
          orderNumbers.length > 1
            ? `${orderNumbers.length} packages from ${orderNumbers.length} shops are on the way.`
            : orderNumbers[0]
              ? `Order ${orderNumbers[0]} has been placed.`
              : 'Your order has been placed.',
      })
      replaceApp(successHref)
      void refresh()
    } catch {
      toast.show('Checkout failed', { tone: 'danger', message: 'Please try again.' })
    } finally {
      if (!keepSubmittingForRedirect) {
        setIsSubmitting(false)
      }
    }
  }

  const placeButton = (
    <YStack gap="$2" width="100%">
      {needsShipping && deliveryAddressNotice ? (
        <XStack
          alignItems="center"
          gap="$2"
          padding="$2"
          borderRadius={8}
          borderWidth={1}
          borderColor={ui.error}
          backgroundColor={ui.roseSurface}
        >
          <Icons.Info size={14} color={ui.error} />
          <Text fontSize={12} color={ui.error} fontWeight="600" flex={1}>
            {deliveryAddressNotice}
          </Text>
        </XStack>
      ) : null}
      <CommerceButton
        variant="primary"
        width="100%"
        disabled={!canPlace}
        onPress={handlePlaceOrderPress}
      >
        {isRedirectingToPayment ? 'Redirecting to payment…' : isSubmitting ? submittingLabel : placeLabel}
      </CommerceButton>
    </YStack>
  )

  const orderSummary = (
    <YStack
      backgroundColor={c.panel}
      borderColor={c.border}
      borderWidth={1}
      borderRadius={12}
      padding="$4"
      gap="$3"
      width="100%"
    >
      {!isDesktop ? null : placeButton}
      {isDesktop ? (
        <Text fontSize={11} color={c.secondary} textAlign="center" lineHeight={15}>
          By placing your order, you agree to SHEconomy&apos;s privacy notice and conditions of use.
        </Text>
      ) : null}
      <YStack height={1} backgroundColor={c.divider} />
      <Text fontSize={17} fontWeight="700" color={c.text}>
        Order summary
      </Text>
      <SummaryRow
        label={`Items (${unitCount})`}
        value={formatCheckoutMoney(displayTotals.itemsSubtotal)}
      />
      <SummaryRow
        label="Delivery"
        value={
          needsShipping
            ? displayTotals.shipping <= 0
              ? 'FREE'
              : formatCheckoutMoney(displayTotals.shipping)
            : 'FREE'
        }
        valueColor={c.inStock}
      />
      {discount > 0 ? (
        <SummaryRow
          label={`Promotion${cart.applied_discount_name ? ` (${cart.applied_discount_name})` : ''}`}
          value={`−${formatCheckoutMoney(displayTotals.promotion)}`}
          valueColor={c.inStock}
        />
      ) : null}
      <CartCoupon />
      <YStack height={1} backgroundColor={c.divider} />
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize={18} fontWeight="700" color={c.priceStrong}>
          Order total:
        </Text>
        <Text fontSize={18} fontWeight="700" color={c.priceStrong}>
          {formatCheckoutMoney(displayTotals.orderTotal)}
        </Text>
      </XStack>
      {showSettlementCurrencyNote ? (
        <Text fontSize={11} color={c.secondary} lineHeight={15}>
          Prices shown in {preferredCurrency}. You will be charged in {settlementCurrency} at
          payment.
        </Text>
      ) : null}
      {multiShop ? (
        <Text fontSize={11} color={c.secondary} lineHeight={15}>
          {paymentGroups.direct.length
            ? `Payments routed per shop · ${paymentGroups.direct.length} paid directly to sellers (0% commission)`
            : `Securely collected by SHEconomy · ${orderShops.length} shops fulfil separately`}
        </Text>
      ) : null}
      {isDesktop ? null : (
        <>
          {placeButton}
          <Text fontSize={11} color={c.secondary} textAlign="center" lineHeight={15}>
            By placing your order, you agree to SHEconomy&apos;s privacy notice and conditions of use.
          </Text>
        </>
      )}
    </YStack>
  )

  const checkoutLayout = (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$5" {...LAYOUT_STRETCH}>
        <YStack
          gap="$4"
          width="100%"
          maxWidth="100%"
          alignSelf="stretch"
          backgroundColor={c.page}
          padding={isDesktop ? '$4' : '$2'}
          borderRadius={12}
          paddingBottom={
            showMobileBar ? COMMERCE_MOBILE_CHECKOUT_BAR_HEIGHT + 24 : undefined
          }
        >
          <XStack alignItems="center" gap="$2" paddingHorizontal="$1">
            <Icons.Lock size={16} color={c.brand} />
            <Text fontSize={22} fontWeight="600" color={c.text}>
              Secure checkout
            </Text>
          </XStack>

          <XStack
            width="100%"
            alignSelf="stretch"
            flexDirection={isDesktop ? 'row' : 'column'}
            alignItems="flex-start"
            gap="$4"
          >
            <YStack flex={1} minWidth={0} width="100%" gap="$4">
              {user ? (
                <SectionCard step={1} title="Contact details">
                  <CheckoutContactSection
                    user={user}
                    onCheckoutReadyChange={setContactCheckoutReady}
                  />
                </SectionCard>
              ) : null}

              {needsShipping ? (
                <SectionCard step={2} title="Delivery address">
                  {addresses.length === 0 ? (
                    <XStack alignItems="center" gap="$2">
                      <Icons.Info size={14} color={ui.badgeAccentText} />
                      <Text fontSize={13} color={ui.badgeAccentText} fontWeight="600" flex={1}>
                        Add a delivery address to ship this order.
                      </Text>
                    </XStack>
                  ) : null}
                  {recentAddresses.length > 0 ? (
                    <YStack gap="$2">
                      <Text fontSize={12} fontWeight="600" color={c.secondary}>
                        Recently used
                      </Text>
                      <XStack gap="$2" flexWrap="wrap">
                        {recentAddresses.map((recent) => (
                          <XStack
                            key={`${recent.id ?? recent.address_line_1}-${recent.postal_code}`}
                            paddingHorizontal={12}
                            paddingVertical={8}
                            borderRadius={999}
                            borderWidth={1}
                            borderColor={c.border}
                            backgroundColor={c.chip}
                            cursor="pointer"
                            onPress={() => {
                              const match = addresses.find((row) => row.id && row.id === recent.id)
                              if (match) {
                                setUseNewAddress(false)
                                setSelectedAddressId(match.id)
                                setAddressError(null)
                                return
                              }
                              setUseNewAddress(true)
                              setAddressError(null)
                              setNewAddress({
                                address_line_1: recent.address_line_1,
                                address_line_2: recent.address_line_2 ?? '',
                                city: recent.city,
                                state: recent.state,
                                postal_code: recent.postal_code,
                                country: recent.country,
                                address_label: recent.address_label ?? 'Home',
                              })
                              addressForm.fields.address_line_1.onChange(recent.address_line_1)
                              addressForm.fields.address_line_2.onChange(
                                recent.address_line_2 ?? '',
                              )
                            }}
                          >
                            <Text fontSize={12} fontWeight="600" color={c.text}>
                              {recent.address_label || recent.city || recent.postal_code}
                            </Text>
                          </XStack>
                        ))}
                      </XStack>
                    </YStack>
                  ) : null}

                  {addresses.length > 0 ? (
                    <YStack gap="$2">
                      {addresses.map((address) => {
                        const selected = !useNewAddress && selectedAddressId === address.id
                        return (
                          <XStack
                            key={address.id}
                            gap="$3"
                            padding="$3"
                            borderRadius={10}
                            borderWidth={1}
                            borderColor={selected ? c.brand : c.border}
                            backgroundColor={selected ? c.chip : c.panel}
                            cursor="pointer"
                            onPress={() => {
                              setUseNewAddress(false)
                              setSelectedAddressId(address.id)
                              setAddressError(null)
                            }}
                          >
                            <YStack paddingTop="$1">
                              <CommerceRadio selected={selected} />
                            </YStack>
                            <YStack flex={1} gap={2}>
                              <Text fontWeight="700" fontSize={14} color={c.text}>
                                {address.address_label}
                              </Text>
                              <Paragraph fontSize={13} color={c.secondary}>
                                {address.address_line_1}
                                {address.address_line_2 ? `, ${address.address_line_2}` : ''}
                                {'\n'}
                                {address.city}, {address.state} {address.postal_code}
                              </Paragraph>
                            </YStack>
                          </XStack>
                        )
                      })}
                    </YStack>
                  ) : null}

                  <XStack gap="$3" alignItems="center" flexWrap="wrap">
                    <CommerceLink
                      onPress={() => {
                        setUseNewAddress(true)
                        setAddressError(null)
                      }}
                    >
                      {addresses.length ? '+ Add a new delivery address' : '+ Add a delivery address'}
                    </CommerceLink>
                    {addresses.length > 0 && useNewAddress ? (
                      <CommerceLink
                        onPress={() => {
                          setUseNewAddress(false)
                          setSelectedAddressId(
                            addresses.find((row) => row.is_default)?.id ?? addresses[0]?.id ?? null,
                          )
                          setAddressError(null)
                        }}
                      >
                        Choose a saved address
                      </CommerceLink>
                    ) : null}
                    <AppLink href={commerceRoutes.addresses} asChild>
                      <Text fontSize={13} color={c.link} cursor="pointer">
                        Manage addresses
                      </Text>
                    </AppLink>
                  </XStack>

                  {useNewAddress ? (
                    <YStack
                      gap="$3"
                      padding="$3"
                      borderRadius={10}
                      borderWidth={1}
                      borderColor={c.border}
                    >
                      <AddressAutocompleteField
                        country={newAddress.country}
                        onResolved={(resolved: ResolvedAddress) => {
                          const patch = resolvedAddressToFormPatch(resolved, {
                            ...newAddress,
                            address_line_2: newAddress.address_line_2 ?? '',
                            address_type: 'shipping',
                            is_default: false,
                            address_label: newAddress.address_label ?? 'Home',
                          })
                          setNewAddress((current) => ({
                            ...current,
                            address_line_1: patch.address_line_1 ?? current.address_line_1,
                            address_line_2: patch.address_line_2 ?? current.address_line_2 ?? '',
                            city: patch.city ?? current.city,
                            state: patch.state ?? current.state,
                            postal_code: patch.postal_code ?? current.postal_code,
                            country: patch.country ?? current.country,
                          }))
                          addressForm.fields.address_line_1.onChange(patch.address_line_1 ?? '')
                          addressForm.fields.address_line_2.onChange(patch.address_line_2 ?? '')
                        }}
                      />
                      <LocationAssistActions
                        onResolved={(resolved: ResolvedAddress) => {
                          const patch = resolvedAddressToFormPatch(resolved, {
                            ...newAddress,
                            address_line_2: newAddress.address_line_2 ?? '',
                            address_type: 'shipping',
                            is_default: false,
                            address_label: newAddress.address_label ?? 'Home',
                          })
                          setNewAddress((current) => ({
                            ...current,
                            address_line_1: patch.address_line_1 || current.address_line_1,
                            address_line_2: patch.address_line_2 || current.address_line_2 || '',
                            city: patch.city || current.city,
                            state: patch.state || current.state,
                            postal_code: patch.postal_code || current.postal_code,
                            country: patch.country || current.country,
                          }))
                          if (patch.address_line_1) {
                            addressForm.fields.address_line_1.onChange(patch.address_line_1)
                          }
                          addressForm.fields.address_line_2.onChange(patch.address_line_2 ?? '')
                        }}
                      />
                      <Field label="Address line 1">
                        <Input
                          value={addressForm.fields.address_line_1.value}
                          onChangeText={addressForm.fields.address_line_1.onChange}
                          autoComplete="street-address"
                        />
                      </Field>
                      <Field label="Address line 2">
                        <Input
                          value={addressForm.fields.address_line_2.value}
                          onChangeText={addressForm.fields.address_line_2.onChange}
                          autoComplete="address-line2"
                        />
                      </Field>
                      <LocationFields
                        value={addressGeoFromInput(newAddress)}
                        onChange={(geo) =>
                          setNewAddress((current) => patchAddressFromGeo(current, geo))
                        }
                      />
                    </YStack>
                  ) : null}

                  <DeliveryPinCheck
                    country={
                      useNewAddress
                        ? newAddress.country
                        : addresses.find((row) => row.id === selectedAddressId)?.country ?? 'IN'
                    }
                    state={
                      useNewAddress
                        ? newAddress.state
                        : addresses.find((row) => row.id === selectedAddressId)?.state
                    }
                    initialPostal={
                      useNewAddress
                        ? newAddress.postal_code
                        : addresses.find((row) => row.id === selectedAddressId)?.postal_code ?? ''
                    }
                    listingType={needsShipping ? 'physical' : 'digital'}
                    compact
                  />
                  {deliveryAddressNotice ? (
                    <XStack alignItems="center" gap="$2" paddingTop="$1">
                      <Icons.Info size={14} color={ui.error} />
                      <Text fontSize={12} color={ui.error} fontWeight="600" flex={1}>
                        {deliveryAddressNotice}
                      </Text>
                    </XStack>
                  ) : null}
                </SectionCard>
              ) : (
                <SectionCard step={2} title="Digital delivery">
                  <Text fontSize={13} color={c.secondary} lineHeight={19}>
                    Your items are digital — files will be available to download right after
                    purchase. No shipping address required.
                  </Text>
                </SectionCard>
              )}

              <SectionCard step={needsShipping ? 3 : 2} title="Payment method">
                {paymentMethod === 'online' && paymentStepCount > 1 ? (
                  <YStack
                    gap="$2"
                    padding="$3"
                    borderRadius={10}
                    borderWidth={1}
                    borderColor={c.border}
                    backgroundColor={c.chip}
                  >
                    <XStack alignItems="center" gap="$2">
                      <Icons.Info size={15} color={c.brand} />
                      <Text fontSize={12} color={c.text} fontWeight="700" flex={1}>
                        This order is paid in {paymentStepCount} secure steps
                      </Text>
                    </XStack>
                    {paymentGroups.shepay.length ? (
                      <PaymentRouteRow
                        icon={<Icons.ShieldCheck size={14} color={c.brand} />}
                        title="SHEPay (PayU hosted)"
                        detail={`${paymentGroups.shepay
                          .map((shop) => shop.shopName)
                          .join(', ')} · choose UPI, card, or net banking on PayU`}
                      />
                    ) : null}
                    {paymentGroups.direct.map((group) => (
                      <PaymentRouteRow
                        key={group.shopId}
                        icon={<Icons.Wallet size={14} color={c.inStock} />}
                        title={`Paid directly to ${group.shopName}`}
                        detail={`via ${group.gateway} · 0% SHEconomy commission`}
                      />
                    ))}
                  </YStack>
                ) : paymentMethod === 'online' && paymentGroups.direct.length === 1 ? (
                  <XStack
                    gap="$2"
                    alignItems="center"
                    padding="$2.5"
                    borderRadius={10}
                    backgroundColor={c.chip}
                  >
                    <Icons.Wallet size={15} color={c.inStock} />
                    <Text fontSize={12} color={c.secondary} flex={1}>
                      Paid directly to {paymentGroups.direct[0].shopName} via{' '}
                      {paymentGroups.direct[0].gateway}. SHEconomy charges no commission.
                    </Text>
                  </XStack>
                ) : null}
                <PaymentOption
                  selected={paymentMethod === 'online'}
                  title={onlineCopy.title}
                  subtitle={onlineCopy.subtitle}
                  onPress={() => setPaymentMethod('online')}
                />

                {needsShipping ? (
                  <PaymentOption
                    selected={paymentMethod === 'cod'}
                    title="Cash on delivery / Pay on delivery"
                    subtitle="Pay with cash, UPI or card when your order arrives"
                    onPress={() => setPaymentMethod('cod')}
                  />
                ) : null}
              </SectionCard>

              <SectionCard step={needsShipping ? 4 : 3} title="Review your order">
                {multiShop ? (
                  <Text fontSize={12} color={c.secondary}>
                    Your order includes items from {orderShops.length} shops. Each shop packs and
                    ships separately, so you may receive multiple deliveries.
                  </Text>
                ) : null}

                {orderShops.map((shop, index) => {
                  const shopItems = selectedItems.filter((item) => item.shop_id === shop.shopId)
                  const shopSubtotal = computeShopDisplaySubtotal(
                    shopItems,
                    shopCurrencies,
                    convertMoney,
                    settlementCurrency,
                  )
                  return (
                    <YStack
                      key={shop.shopId}
                      gap="$2.5"
                      paddingTop={index > 0 ? '$3' : 0}
                      borderTopWidth={index > 0 ? 1 : 0}
                      borderTopColor={c.divider}
                    >
                      <XStack alignItems="center" gap="$2">
                        <Icons.Store size={14} color={c.secondary} />
                        <Text fontSize={13} color={c.text} fontWeight="600">
                          {shop.shopName}
                        </Text>
                      </XStack>
                      <ShopRatingBadge info={shopHeaders.get(shop.shopId)} />
                      <XStack alignItems="center" gap="$1.5" flexWrap="wrap">
                        <Icons.Truck size={13} color={c.inStock} />
                        <Text fontSize={12} color={c.inStock} fontWeight="600">
                          {deliveryEstimateLabel()}
                          {' · '}
                          {checkoutShippingLabel(shopPartners.get(shop.shopId))}
                        </Text>
                      </XStack>
                      <ShopPartnerChips info={shopPartners.get(shop.shopId)} />
                      {shopItems.map((item) => (
                        <XStack key={item.id} gap="$3" alignItems="center">
                          <YStack
                            width={54}
                            height={54}
                            borderRadius={8}
                            overflow="hidden"
                            backgroundColor={c.imagePlaceholder}
                            flexShrink={0}
                          >
                            {item.image_url ? (
                              <Image
                                src={item.image_url}
                                width={54}
                                height={54}
                                objectFit="contain"
                              />
                            ) : null}
                          </YStack>
                          <YStack flex={1} minWidth={0}>
                            <Text fontSize={13} color={c.text} numberOfLines={2}>
                              {item.title}
                            </Text>
                            <Text fontSize={12} color={c.secondary}>
                              Qty: {item.quantity}
                            </Text>
                          </YStack>
                          <Text fontSize={14} fontWeight="700" color={c.priceStrong}>
                            {formatMoney(
                              item.unit_price * item.quantity,
                              shopCurrencyFor(item.shop_id, shopCurrencies, settlementCurrency),
                            )}
                          </Text>
                        </XStack>
                      ))}
                      <XStack justifyContent="flex-end">
                        <Text fontSize={12} color={c.secondary}>
                          Shop subtotal:{' '}
                          <Text fontWeight="700" color={c.text}>
                            {formatCheckoutMoney(shopSubtotal)}
                          </Text>
                        </Text>
                      </XStack>
                      <GiftToggle
                        active={!!giftByShop[shop.shopId]}
                        onToggle={() =>
                          setGiftByShop((current) => ({
                            ...current,
                            [shop.shopId]: !current[shop.shopId],
                          }))
                        }
                      />
                      <Field
                        label={
                          giftByShop[shop.shopId]
                            ? `Gift message for ${shop.shopName}`
                            : `Add a note to ${shop.shopName} (optional)`
                        }
                      >
                        <Input
                          value={notesByShop[shop.shopId] ?? ''}
                          placeholder={
                            giftByShop[shop.shopId]
                              ? 'Write your gift message…'
                              : 'Personalization, delivery instructions…'
                          }
                          onChangeText={(value) =>
                            setNotesByShop((current) => ({ ...current, [shop.shopId]: value }))
                          }
                        />
                      </Field>
                    </YStack>
                  )
                })}
              </SectionCard>

              {!isDesktop ? orderSummary : null}
            </YStack>

            {isDesktop ? (
              <StickyRail width={SUMMARY_WIDTH} maxWidth="100%">
                {orderSummary}
              </StickyRail>
            ) : null}
          </XStack>
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )

  if (!showMobileBar) return checkoutLayout

  return (
    <YStack flex={1} width="100%" position="relative">
      {checkoutLayout}
      <CommerceMobileCheckoutBar
        total={displayTotals.orderTotal}
        currency={preferredCurrency}
        formattedTotal={formatCheckoutMoney(displayTotals.orderTotal)}
        formattedSavings={displayTotals.promotion > 0 ? formatCheckoutMoney(displayTotals.promotion) : null}
        caption={`Order total · ${unitCount} ${unitCount === 1 ? 'item' : 'items'}`}
        savings={displayTotals.promotion > 0 ? displayTotals.promotion : null}
        label={isRedirectingToPayment ? 'Redirecting to payment…' : isSubmitting ? submittingLabel : placeLabel}
        disabled={!canPlace}
        isLoading={isSubmitting || isRedirectingToPayment}
        onPress={handlePlaceOrderPress}
      />
    </YStack>
  )
}

function SectionCard({
  step,
  title,
  children,
}: {
  step: number
  title: string
  children: ReactNode
}) {
  const c = useCommercePalette()
  const ui = useAppUi()
  return (
    <YStack
      backgroundColor={c.panel}
      borderColor={c.border}
      borderWidth={1}
      borderRadius={12}
      padding="$4"
      gap="$3"
    >
      <XStack alignItems="center" gap="$2">
        <Text
          width={22}
          height={22}
          borderRadius={11}
          backgroundColor={ui.brand}
          color={ui.onBrand}
          fontSize={13}
          fontWeight="700"
          textAlign="center"
          lineHeight={22}
        >
          {step}
        </Text>
        <Text fontSize={18} fontWeight="700" color={c.text}>
          {title}
        </Text>
      </XStack>
      {children}
    </YStack>
  )
}

function GiftToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const c = useCommercePalette()
  return (
    <XStack
      alignItems="center"
      gap="$2"
      alignSelf="flex-start"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius={999}
      borderWidth={1}
      borderColor={active ? c.brand : c.border}
      backgroundColor={active ? c.chip : c.panel}
      cursor="pointer"
      onPress={onToggle}
    >
      <Icons.Gift size={15} color={active ? c.brand : c.secondary} />
      <Text fontSize={13} fontWeight="600" color={active ? c.brand : c.text}>
        This is a gift
      </Text>
      {active ? <Icons.Check size={15} color={c.brand} /> : null}
    </XStack>
  )
}

function PaymentRouteRow({
  icon,
  title,
  detail,
}: {
  icon: ReactNode
  title: string
  detail: string
}) {
  const c = useCommercePalette()
  return (
    <XStack gap="$2" alignItems="flex-start" paddingLeft="$1">
      <YStack paddingTop={2}>{icon}</YStack>
      <YStack flex={1} minWidth={0}>
        <Text fontSize={12} fontWeight="600" color={c.text}>
          {title}
        </Text>
        <Text fontSize={11} color={c.secondary}>
          {detail}
        </Text>
      </YStack>
    </XStack>
  )
}

function PaymentOption({
  selected,
  title,
  subtitle,
  onPress,
}: {
  selected: boolean
  title: string
  subtitle: string
  onPress: () => void
}) {
  const c = useCommercePalette()
  return (
    <XStack
      gap="$3"
      alignItems="center"
      padding="$3"
      borderRadius={10}
      borderWidth={1}
      borderColor={selected ? c.brand : c.border}
      backgroundColor={selected ? c.chip : c.panel}
      cursor="pointer"
      onPress={onPress}
    >
      <CommerceRadio selected={selected} />
      <YStack flex={1} minWidth={0}>
        <Text fontSize={14} fontWeight="600" color={c.text}>
          {title}
        </Text>
        <Text fontSize={12} color={c.secondary}>
          {subtitle}
        </Text>
      </YStack>
    </XStack>
  )
}

function SummaryRow({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  const c = useCommercePalette()
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <Text fontSize={13} color={c.secondary}>
        {label}
      </Text>
      <Text fontSize={13} fontWeight="600" color={valueColor ?? c.text}>
        {value}
      </Text>
    </XStack>
  )
}
