import { useRouter } from 'one'
import { Platform } from 'react-native'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'
import { AppLink } from '~/components/navigation/AppLink'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  Button,
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
import { SafeIcon } from '~/commerce/components/SafeIcon'
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
  ListingQuantityStepper,
  ShopPartnerChips,
  ShopRatingBadge,
  useCommercePalette,
} from '~/commerce/components'
import { CheckoutPayuPanel, type CheckoutPayuSession } from '~/commerce/components/CheckoutPayuPanel'
import {
  checkCartStock,
  cancelCheckoutPayment,
  createAtomicMarketplaceCheckout,
  type CheckoutPaymentMode,
} from '~/commerce/lib/checkout'
import {
  checkoutShippingLabel,
  resolvePostCheckoutNext,
  toInAppPayUHref,
} from '~/commerce/lib/checkout-payment-route'
import { parsePayuBridgeParams, savePayuBridgeSession, submitPayuFormPost } from '~/commerce/lib/payu-bridge'
import { savePendingOrderSuccess } from '~/commerce/lib/customer-orders'
import {
  computeCheckoutShippingQuote,
  fetchDeliveryProfilesByShopIds,
} from '~/commerce/lib/checkout-shipping'
import type { ShippingPolicy } from '~/lib/shipping-policy/shipping-policy.type'
import { computeSelectedTotals, useCartSelection } from '~/commerce/lib/cart-selection'
import { ensureCartDiscountValidForCheckout, toCartOfferItems } from '~/commerce/lib/discounts'
import {
  cartRequiresShipping,
  fetchListingStockByIds,
  fetchListingTypesByIds,
} from '~/commerce/lib/listing-fulfillment'
import { deliveryEstimateLabel } from '~/commerce/lib/delivery-estimate'
import {
  buildCustomerAmountsByShop,
  computeCheckoutDisplayTotals,
  computeShopDisplaySubtotal,
  shopCurrencyFor,
} from '~/commerce/lib/checkout-display-pricing'
import { useFormatCurrency } from '~/hooks/useFormatCurrency'
import { useProfile } from '~/hooks/useProfile'
import { openExternalUrl } from '~/lib/platform/openUrl'
import { commerceRoutes } from '~/lib/routes'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { AddressDeleteDrawer } from '~/commerce/components/address/AddressDeleteDrawer'
import { AddressFormDrawer } from '~/commerce/components/address/AddressFormDrawer'
import {
  createUserAddress,
  deleteUserAddress,
  fetchUserAddressRows,
  setDefaultUserAddress,
  updateUserAddress,
} from '~/commerce/lib/addresses'
import type { Address, AddressFormData } from '~/lib/address/address.type'
import { ADDRESS_TYPE } from '~/lib/address/address.type'
import { createEmptyAddressFormData } from '~/lib/address/address.utils'
import { DeliveryPinCheck } from '~/components/location'
import {
  readRecentAddresses,
  rememberRecentAddress,
  type RecentAddressSnapshot,
} from '~/lib/location'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'
import { resolveCheckoutContact } from '~/features/auth/services/account-contact'
import { trackCommerceEvent } from '~/lib/analytics'
import { navigateApp, replaceApp } from '~/lib/platform/navigate'

const SUMMARY_WIDTH = 320

export function CheckoutScreen() {
  const c = useCommercePalette()
  const ui = useAppUi()
  const { hasSideRails, mobileTabBarOffset } = useAppLayout()
  const { user, isAuthenticated, profile } = useProfile()
  const { formatMoney, convertMoney, preferredCurrency } = useFormatCurrency()
  const { cart, items: cartItems, isLoading, refresh, error: cartError, updateQuantity, removeItem } =
    useCart()
  const { items, hasChecked } = useStorefrontCartItems(cartItems)
  const toast = useAppToast()

  const [checkoutBarHeight, setCheckoutBarHeight] = useState(COMMERCE_MOBILE_CHECKOUT_BAR_HEIGHT)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [recentAddresses, setRecentAddresses] = useState<RecentAddressSnapshot[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [addressFormOpen, setAddressFormOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [addressPrefill, setAddressPrefill] = useState<AddressFormData | null>(null)
  const [addressDeleteTarget, setAddressDeleteTarget] = useState<Address | null>(null)
  const [isSavingAddress, setIsSavingAddress] = useState(false)
  const [isDeletingAddress, setIsDeletingAddress] = useState(false)
  const [notesByShop, setNotesByShop] = useState<Record<string, string>>({})
  const [giftByShop, setGiftByShop] = useState<Record<string, boolean>>({})
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMode>('online')
  const [payuSession, setPayuSession] = useState<CheckoutPayuSession | null>(null)
  const [payuCheckoutMeta, setPayuCheckoutMeta] = useState<{
    orderIds: string[]
    orderNumbers: string[]
    checkoutGroupId: string | null
  } | null>(null)
  const [payuAuthActive, setPayuAuthActive] = useState(false)
  const payuCheckoutMetaRef = useRef(payuCheckoutMeta)
  payuCheckoutMetaRef.current = payuCheckoutMeta
  const ensurePayuInFlight = useRef<Promise<CheckoutPayuSession | null> | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRedirectingToPayment, setIsRedirectingToPayment] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true)
  const [listingTypes, setListingTypes] = useState<Map<string, string>>(new Map())
  const [listingStock, setListingStock] = useState<Map<string, number | null>>(new Map())
  const [deliveryProfilesByShop, setDeliveryProfilesByShop] = useState(
    () => new Map<string, ShippingPolicy[]>(),
  )
  const checkoutAttemptKey = useRef<string | null>(null)
  const [contactCheckoutReady, setContactCheckoutReady] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)

  const checkoutContact = useMemo(
    () => resolveCheckoutContact({ user, profile }),
    [user, profile],
  )

  useEffect(() => {
    setContactCheckoutReady(checkoutContact.checkoutReady)
  }, [checkoutContact.checkoutReady])

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

  const selectedAddress = useMemo(
    () => addresses.find((row) => row.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  )

  // Addresses are always persisted before placing an order, so selection is the only gate.
  const addressReady = needsShipping ? Boolean(selectedAddressId) : true

  const addressRequirementMessage = useMemo(() => {
    if (!needsShipping || addressReady) return null
    return addresses.length > 0
      ? 'Select a delivery address to continue.'
      : 'Add a delivery address to continue.'
  }, [addressReady, addresses.length, needsShipping])

  const deliveryAddressNotice = addressError ?? addressRequirementMessage

  useEffect(() => {
    if (addressReady) setAddressError(null)
  }, [addressReady])

  useEffect(() => {
    setAddressError(null)
  }, [selectedAddressId])

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

  useEffect(() => {
    const ids = items.map((item) => item.listing_id)
    if (!ids.length) {
      setListingTypes(new Map())
      setListingStock(new Map())
      return
    }
    void fetchListingTypesByIds(ids).then(setListingTypes)
    void fetchListingStockByIds(ids).then(setListingStock)
  }, [items])

  useEffect(() => {
    void readRecentAddresses().then(setRecentAddresses)
  }, [])

  const userId = user?.id ?? null

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoadingAddresses(false)
      return
    }
    if (!userId) {
      // Profile still hydrating — keep the gate until we have an id, but never forever.
      setIsLoadingAddresses(true)
      const hydrateTimeout = setTimeout(() => setIsLoadingAddresses(false), 8_000)
      return () => clearTimeout(hydrateTimeout)
    }

    let cancelled = false
    setIsLoadingAddresses(true)
    const fetchTimeout = setTimeout(() => {
      if (cancelled) return
      setIsLoadingAddresses(false)
      toast.show('Could not load addresses', {
        tone: 'danger',
        message: 'Taking too long. You can still enter a new address.',
      })
    }, 12_000)

    fetchUserAddressRows(userId)
      .then(({ addresses: rows, error }) => {
        if (cancelled) return
        setAddresses(rows)
        const defaultAddress = rows.find((row) => row.is_default) ?? rows[0]
        setSelectedAddressId(defaultAddress?.id ?? null)
        if (error) toast.show('Could not load addresses', { tone: 'danger', message: error })
      })
      .catch(() => {
        if (cancelled) return
        toast.show('Could not load addresses', { tone: 'danger' })
      })
      .finally(() => {
        clearTimeout(fetchTimeout)
        if (!cancelled) setIsLoadingAddresses(false)
      })

    return () => {
      cancelled = true
      clearTimeout(fetchTimeout)
    }
  }, [isAuthenticated, toast, userId])

  const reloadAddresses = useCallback(
    async (preferAddressId?: string | null) => {
      if (!userId) return
      const { addresses: rows, error } = await fetchUserAddressRows(userId)
      setAddresses(rows)
      setSelectedAddressId((current) => {
        if (preferAddressId && rows.some((row) => row.id === preferAddressId)) {
          return preferAddressId
        }
        if (current && rows.some((row) => row.id === current)) return current
        return (rows.find((row) => row.is_default) ?? rows[0])?.id ?? null
      })
      if (error) toast.show('Could not load addresses', { tone: 'danger', message: error })
    },
    [toast, userId],
  )

  function openAddressCreate(seed?: AddressFormData | null) {
    setEditingAddress(null)
    setAddressPrefill(
      seed ?? { ...createEmptyAddressFormData(), address_type: ADDRESS_TYPE.SHIPPING },
    )
    setAddressFormOpen(true)
  }

  function openAddressEdit(address: Address) {
    setEditingAddress(address)
    setAddressPrefill(null)
    setAddressFormOpen(true)
  }

  function closeAddressForm() {
    setAddressFormOpen(false)
    setEditingAddress(null)
    setAddressPrefill(null)
  }

  async function handleSaveAddress(formData: AddressFormData) {
    if (!userId) return
    setIsSavingAddress(true)
    try {
      if (editingAddress) {
        const { address, error } = await updateUserAddress(userId, editingAddress.id, formData)
        if (error || !address) {
          toast.show('Could not update address', { tone: 'danger', message: error ?? undefined })
          return
        }
        // `updateUserAddress` leaves the default flag alone — it has its own RPC.
        if (formData.is_default && !editingAddress.is_default) {
          const { error: defaultError } = await setDefaultUserAddress(userId, editingAddress.id)
          if (defaultError) {
            toast.show('Could not set default', { tone: 'danger', message: defaultError })
          }
        }
        await reloadAddresses(address.id)
        toast.show('Address updated', { tone: 'success' })
      } else {
        const { address, error } = await createUserAddress(userId, formData, {
          isDefault: formData.is_default || addresses.length === 0,
        })
        if (error || !address) {
          toast.show('Could not save address', { tone: 'danger', message: error ?? undefined })
          return
        }
        await reloadAddresses(address.id)
        toast.show('Address saved', { tone: 'success', message: 'Selected for this delivery.' })
      }
      setAddressError(null)
      closeAddressForm()
    } finally {
      setIsSavingAddress(false)
    }
  }

  async function handleSetDefaultAddress(address: Address) {
    if (!userId) return
    const { error } = await setDefaultUserAddress(userId, address.id)
    if (error) {
      toast.show('Could not set default', { tone: 'danger', message: error })
      return
    }
    await reloadAddresses(address.id)
    toast.show('Default address updated', { tone: 'success' })
  }

  async function handleDeleteAddress() {
    if (!userId || !addressDeleteTarget) return
    setIsDeletingAddress(true)
    try {
      const { error } = await deleteUserAddress(userId, addressDeleteTarget.id)
      if (error) {
        toast.show('Could not delete address', { tone: 'danger', message: error })
        return
      }
      const removedId = addressDeleteTarget.id
      setAddressDeleteTarget(null)
      if (selectedAddressId === removedId) setSelectedAddressId(null)
      await reloadAddresses()
      toast.show('Address deleted', { tone: 'success' })
    } finally {
      setIsDeletingAddress(false)
    }
  }

  if (!isAuthenticated) {
    return <SpaRedirect href={buildSignInUrl(String(commerceRoutes.checkout))} />
  }

  // Only block the full page on first paint — background cart/address refreshes must not remount.
  // If cart load failed, fail open instead of spinning forever (App Store 2.1 purchase completeness).
  const showInitialSpinner =
    (isLoading && cartItems.length === 0 && !cartError) ||
    isLoadingAddresses ||
    (cartItems.length > 0 && !hasChecked)

  if (showInitialSpinner) {
    return (
      <FullWidthLayout>
        <PageSection paddingVertical="$10" alignItems="center">
          <Spinner size="large" />
        </PageSection>
      </FullWidthLayout>
    )
  }

  if (!orderPlaced && hasChecked && !isLoading && (!cart || items.length === 0)) {
    return <SpaRedirect href={commerceRoutes.cart} />
  }
  if (!cart) {
    return <SpaRedirect href={commerceRoutes.home} />
  }

  const showSettlementCurrencyNote = preferredCurrency !== settlementCurrency

  // Online: PayU merchant-hosted S2S accordion on this screen (no PayU redirect CTA).
  const placeLabel = 'Place your order'
  const submittingLabel = 'Placing…'
  const usesInlinePayu = paymentMethod === 'online'

  const canPlace =
    !usesInlinePayu &&
    !payuSession &&
    !noneSelected &&
    !isSubmitting &&
    !isRedirectingToPayment &&
    !isLoadingAddresses &&
    contactCheckoutReady &&
    addressReady
  const showMobileBar = !hasSideRails && !orderPlaced && !usesInlinePayu && !payuSession

  const payuPanelSession: CheckoutPayuSession =
    payuSession ??
    ({
      provider: 'shepay',
      actionUrl: '',
      fields: {},
      txnid: '',
    } satisfies CheckoutPayuSession)

  function clearPayuCheckoutState() {
    checkoutAttemptKey.current = null
    ensurePayuInFlight.current = null
    setPayuAuthActive(false)
    setPayuSession(null)
    setPayuCheckoutMeta(null)
  }

  async function handleCheckoutQuantityChange(itemId: string, nextQuantity: number) {
    const { error } = await updateQuantity(itemId, nextQuantity)
    if (error) {
      toast.show('Could not update quantity', { tone: 'danger', message: error })
      return
    }
    await refresh()
  }

  async function handleCheckoutRemoveItem(itemId: string) {
    const remaining = selectedItems.filter((item) => item.id !== itemId).length
    const { error } = await removeItem(itemId)
    if (error) {
      toast.show('Could not remove item', { tone: 'danger', message: error })
      return
    }
    await refresh()
    if (remaining === 0) {
      toast.show('Cart is empty', {
        tone: 'default',
        message: 'Add items to continue checkout.',
      })
      navigateApp(commerceRoutes.cart)
    }
  }


  /** Place order + create SHEPay step; PayU S2S charge runs inside CheckoutPayuPanel. */
  async function ensureShepayPayuSession(): Promise<CheckoutPayuSession | null> {
    if (payuSession?.paymentStepId) return payuSession
    if (ensurePayuInFlight.current) return ensurePayuInFlight.current

    const run = (async (): Promise<CheckoutPayuSession | null> => {
      if (!cart || !user || noneSelected || !contactCheckoutReady) {
        if (!contactCheckoutReady) {
          toast.show('Verify your mobile', {
            tone: 'warning',
            message: 'Add and verify a mobile number before paying.',
          })
        }
        return null
      }
      if (needsShipping && !addressReady) {
        const message = addressRequirementMessage ?? 'Add a delivery address to continue.'
        setAddressError(message)
        toast.show('Delivery address required', { tone: 'warning', message })
        return null
      }

      let shippingAddressId = selectedAddressId
      try {
        const { issues, error: stockError } = await checkCartStock(
          selectedItems.map((item) => ({ listingId: item.listing_id, quantity: item.quantity })),
        )
        if (stockError) {
          toast.show('Could not verify stock', { tone: 'danger', message: stockError })
          return null
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
          return null
        }

        if (needsShipping) {
          if (!shippingAddressId) {
            toast.show('Select a delivery address', { tone: 'danger' })
            return null
          }
        } else if (!shippingAddressId && addresses[0]?.id) {
          shippingAddressId = addresses[0].id
        }
        if (!shippingAddressId) {
          toast.show('Add an address for your order records', { tone: 'danger' })
          return null
        }

        const selectionKey = selectedItems
          .map((item) => item.id)
          .sort()
          .join(',')
        if (!selectionKey) {
          toast.show('Cart is empty', {
            tone: 'danger',
            message: 'Refresh the page or return to your cart and try again.',
          })
          return null
        }

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
            return null
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
          paymentMode: 'online',
          idempotencyKey: checkoutAttemptKey.current,
          notesByShop,
          giftShopIds: Object.entries(giftByShop)
            .filter(([, enabled]) => enabled)
            .map(([shopId]) => shopId),
          customerCurrency: preferredCurrency,
          customerAmountsByShop: customerAmountsByShop,
          skipShepayFinalize: false,
        })
        if (result.error || !result.data) {
          const msg = result.error ?? 'Please try again.'
          if (/cart item|cart not found|unavailable|cancelled|invalid/i.test(msg)) {
            checkoutAttemptKey.current = null
            await refresh()
          }
          toast.show('Checkout failed', { tone: 'danger', message: msg })
          return null
        }

        const { orderIds, orderNumbers, checkoutGroupId } = result.data
        const shepayStep = result.data.paymentSteps.find((step) => step.collection === 'shepay')
        if (!shepayStep?.id) {
          if (checkoutGroupId) await cancelCheckoutPayment(checkoutGroupId)
          checkoutAttemptKey.current = null
          toast.show('Payment setup incomplete', {
            tone: 'danger',
            message: 'PayU split checkout is not ready for these shops. Please try again.',
          })
          return null
        }

        const usedAddressEarly = addresses.find((row) => row.id === shippingAddressId)
        if (usedAddressEarly) {
          void rememberRecentAddress(usedAddressEarly).then(setRecentAddresses)
        }

        await savePendingOrderSuccess({
          orderIds,
          orderNumbers,
          createdAt: Date.now(),
          paymentMode: 'online',
          awaitingExternalPayment: true,
          checkoutGroupId,
          checkoutUrl: null,
        })

        const nextSession: CheckoutPayuSession = {
          provider: 'shepay',
          paymentStepId: shepayStep.id,
          actionUrl: '',
          fields: {},
          txnid: '',
        }
        setPayuCheckoutMeta({ orderIds, orderNumbers, checkoutGroupId })
        setPayuSession(nextSession)
        return nextSession
      } catch (err) {
        toast.show('Checkout failed', {
          tone: 'danger',
          message: err instanceof Error ? err.message : 'Please try again.',
        })
        return null
      }
    })()

    ensurePayuInFlight.current = run
    try {
      return await run
    } finally {
      if (ensurePayuInFlight.current === run) ensurePayuInFlight.current = null
    }
  }

  function handlePlaceOrderPress() {
    if (usesInlinePayu) {
      toast.show('Pay in the payment section', {
        tone: 'default',
        message: 'Choose UPI, card or net banking below — your order is placed when payment succeeds.',
      })
      return
    }
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
      if (mode === 'online') {
        toast.show('Pay in the payment section', {
          tone: 'default',
          message: 'Choose UPI, card or net banking below to complete payment on this page.',
        })
        return
      }
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
      const checkoutUrl =
        result.data.paymentSteps.find((step) => step.checkoutUrl)?.checkoutUrl ?? null
      const hasShepaySteps = result.data.paymentSteps.some((step) => step.collection === 'shepay')

      const usedAddress = addresses.find((row) => row.id === shippingAddressId)
      if (usedAddress) {
        void rememberRecentAddress(usedAddress).then(setRecentAddresses)
      }

      const next = resolvePostCheckoutNext({
        mode,
        checkoutUrl,
        shepayError: null,
        hasShepaySteps,
        payuInline: null,
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

      const awaitingExternalPayment =
        next.kind === 'payu_bridge' || next.kind === 'external_pay' || next.kind === 'payu_inline'
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

      if (next.kind === 'payu_inline') {
        // Should not happen for SHEPay hosted — fall through to bridge if fields exist.
        if (next.actionUrl && Object.keys(next.fields).length) {
          savePayuBridgeSession(next.actionUrl, next.fields)
          if (Platform.OS === 'web') {
            submitPayuFormPost(next.actionUrl, next.fields)
            return
          }
        }
        setIsSubmitting(false)
        toast.show('Payment setup incomplete', {
          tone: 'danger',
          message: 'Could not open the payment page. Please try again.',
        })
        return
      }

      if (next.kind === 'payu_bridge') {
        // Stash action+fields so native bridge does not rely only on huge query strings.
        try {
          const parsed = new URL(next.href, 'https://sheconomy.local')
          const stashed = parsePayuBridgeParams(
            parsed.searchParams.get('action') ?? '',
            parsed.searchParams.get('payload') ?? '',
          )
          if (stashed.action && stashed.fields) {
            savePayuBridgeSession(stashed.action, stashed.fields)
          }
        } catch {
          // keep navigating; bridge may still read query params
        }
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

  const placeButton = usesInlinePayu || payuSession ? (
    <YStack
      gap="$2"
      width="100%"
      padding="$3"
      borderRadius={10}
      backgroundColor={c.chip}
      borderWidth={1}
      borderColor={c.border}
    >
      <Text fontSize={13} fontWeight="600" color={c.text}>
        Pay below to place your order
      </Text>
      <Text fontSize={12} color={c.secondary} lineHeight={17}>
        Expand a payment option, enter details if needed, then tap Pay. Your order is confirmed after
        successful payment.
      </Text>
    </YStack>
  ) : (
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
          <SafeIcon icon={Icons.Info} size={14} color={ui.error} />
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
      {!hasSideRails ? null : placeButton}
      {hasSideRails ? (
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
          label={`Promotion${cart?.applied_discount_name ? ` (${cart.applied_discount_name})` : ''}`}
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
          One PayU payment · funds split to each of {orderShops.length} shops after confirmation
        </Text>
      ) : null}
      {hasSideRails ? null : (
        <Text fontSize={11} color={c.secondary} textAlign="center" lineHeight={15}>
          By placing your order, you agree to SHEconomy&apos;s privacy notice and conditions of use.
        </Text>
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
          padding={hasSideRails ? '$4' : '$2'}
          borderRadius={12}
          paddingBottom={showMobileBar ? checkoutBarHeight + mobileTabBarOffset + 24 : undefined}
        >
          <XStack alignItems="center" gap="$2" paddingHorizontal="$1">
            <SafeIcon icon={Icons.Lock} size={16} color={c.brand} />
            <Text fontSize={22} fontWeight="600" color={c.text}>
              Secure checkout
            </Text>
          </XStack>

          <XStack
            width="100%"
            alignSelf="stretch"
            flexDirection={hasSideRails ? 'row' : 'column'}
            alignItems="flex-start"
            gap="$4"
          >
            <YStack flex={1} minWidth={0} width="100%" gap="$4" flexShrink={0}>
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
                      <SafeIcon icon={Icons.Info} size={14} color={ui.badgeAccentText} />
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
                                setSelectedAddressId(match.id)
                                setAddressError(null)
                                return
                              }
                              setAddressError(null)
                              openAddressCreate({
                                ...createEmptyAddressFormData(),
                                address_line_1: recent.address_line_1,
                                address_line_2: recent.address_line_2 ?? '',
                                city: recent.city,
                                state: recent.state,
                                postal_code: recent.postal_code,
                                country: recent.country,
                                address_label: recent.address_label ?? '',
                                address_type: ADDRESS_TYPE.SHIPPING,
                              })
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
                        const selected = selectedAddressId === address.id
                        return (
                          <YStack
                            key={address.id}
                            gap="$2"
                            padding="$3"
                            borderRadius={10}
                            borderWidth={1}
                            borderColor={selected ? c.brand : c.border}
                            backgroundColor={selected ? c.chip : c.panel}
                          >
                            <XStack
                              gap="$3"
                              cursor="pointer"
                              onPress={() => {
                                setSelectedAddressId(address.id)
                                setAddressError(null)
                              }}
                            >
                              <YStack paddingTop="$1">
                                <CommerceRadio selected={selected} />
                              </YStack>
                              <YStack flex={1} gap={2}>
                                <XStack gap="$2" alignItems="center" flexWrap="wrap">
                                  <Text fontWeight="700" fontSize={14} color={c.text}>
                                    {address.address_label || 'Delivery address'}
                                  </Text>
                                  {address.is_default ? (
                                    <XStack
                                      paddingHorizontal="$2"
                                      paddingVertical={2}
                                      borderRadius={999}
                                      backgroundColor={ui.roseSurface}
                                    >
                                      <Text fontSize={10} fontWeight="700" color={c.brand}>
                                        Default
                                      </Text>
                                    </XStack>
                                  ) : null}
                                </XStack>
                                <Paragraph fontSize={13} color={c.secondary}>
                                  {address.address_line_1}
                                  {address.address_line_2 ? `, ${address.address_line_2}` : ''}
                                  {'\n'}
                                  {address.city}, {address.state} {address.postal_code}
                                </Paragraph>
                              </YStack>
                            </XStack>
                            <XStack gap="$2" flexWrap="wrap" paddingLeft={32}>
                              <Button
                                tone="outline"
                                size="$2"
                                borderRadius={999}
                                disabled={isSavingAddress || isDeletingAddress}
                                onPress={() => openAddressEdit(address)}
                              >
                                Edit
                              </Button>
                              {!address.is_default ? (
                                <Button
                                  tone="outline"
                                  size="$2"
                                  borderRadius={999}
                                  disabled={isSavingAddress || isDeletingAddress}
                                  onPress={() => void handleSetDefaultAddress(address)}
                                >
                                  Set default
                                </Button>
                              ) : null}
                              <Button
                                tone="outline"
                                size="$2"
                                borderRadius={999}
                                disabled={isSavingAddress || isDeletingAddress}
                                onPress={() => setAddressDeleteTarget(address)}
                              >
                                Delete
                              </Button>
                            </XStack>
                          </YStack>
                        )
                      })}
                    </YStack>
                  ) : null}

                  <XStack gap="$3" alignItems="center" flexWrap="wrap">
                    <CommerceLink
                      onPress={() => {
                        setAddressError(null)
                        openAddressCreate()
                      }}
                    >
                      {addresses.length ? '+ Add a new delivery address' : '+ Add a delivery address'}
                    </CommerceLink>
                    <AppLink href={commerceRoutes.addresses} asChild>
                      <Text fontSize={13} color={c.link} cursor="pointer">
                        Manage addresses
                      </Text>
                    </AppLink>
                  </XStack>

                  <DeliveryPinCheck
                    country={selectedAddress?.country ?? 'IN'}
                    state={selectedAddress?.state}
                    initialPostal={selectedAddress?.postal_code ?? ''}
                    listingType={needsShipping ? 'physical' : 'digital'}
                    compact
                  />
                  {deliveryAddressNotice ? (
                    <XStack alignItems="center" gap="$2" paddingTop="$1">
                      <SafeIcon icon={Icons.Info} size={14} color={ui.error} />
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
                <YStack gap="$3" width="100%" flexShrink={0}>
                  <CheckoutPayuPanel
                    embedded
                    ui={ui}
                    brandColor={c.brand}
                    borderColor={c.border}
                    chipColor={c.chip}
                    secondaryColor={c.secondary}
                    initialMode="upi_intent"
                    amount={displayTotals.orderTotal}
                    amountLabel={formatCheckoutMoney(displayTotals.orderTotal)}
                    session={payuPanelSession}
                    onEnsureSession={ensureShepayPayuSession}
                    onAuthActiveChange={setPayuAuthActive}
                    collapsed={paymentMethod === 'cod'}
                    onSelectOnline={() => setPaymentMethod('online')}
                    cod={
                      needsShipping
                        ? {
                            selected: paymentMethod === 'cod',
                            title: 'Cash on delivery / Pay on delivery',
                            subtitle: 'Pay with cash, UPI or card when your order arrives',
                            onSelect: () => {
                              void (async () => {
                                if (payuCheckoutMeta?.checkoutGroupId) {
                                  await cancelCheckoutPayment(payuCheckoutMeta.checkoutGroupId)
                                }
                                clearPayuCheckoutState()
                                setPaymentMethod('cod')
                              })()
                            },
                          }
                        : null
                    }
                    onPaid={() => {
                      const meta = payuCheckoutMetaRef.current
                      trackCommerceEvent('purchase', {
                        currency: settlementCurrency,
                        value: orderTotal,
                        transactionId:
                          meta?.orderNumbers[0] ?? meta?.orderIds[0] ?? cart?.id ?? '',
                        items: selectedItems.map((item) => ({
                          id: item.listing_id,
                          name: item.listing_id,
                          price: item.unit_price ?? undefined,
                          quantity: item.quantity,
                        })),
                      })
                      toast.show('Payment received', {
                        tone: 'success',
                        message: 'Your order is confirmed.',
                      })
                      if (meta?.orderIds?.length) {
                        replaceApp(commerceRoutes.orderSuccess(meta.orderIds) as never)
                      } else {
                        replaceApp(commerceRoutes.orders as never)
                      }
                      void refresh()
                    }}
                    onFailed={(message) => {
                      toast.show('Payment failed', { tone: 'danger', message })
                    }}
                    onCancel={async () => {
                      if (payuCheckoutMeta?.checkoutGroupId) {
                        await cancelCheckoutPayment(payuCheckoutMeta.checkoutGroupId)
                      }
                      clearPayuCheckoutState()
                      await refresh()
                      toast.show('Payment cancelled', {
                        tone: 'default',
                        message: 'Your order was not charged. You can try again.',
                      })
                    }}
                  />
                </YStack>
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
                        <SafeIcon icon={Icons.Store} size={14} color={c.secondary} />
                        <Text fontSize={13} color={c.text} fontWeight="600">
                          {shop.shopName}
                        </Text>
                      </XStack>
                      <ShopRatingBadge info={shopHeaders.get(shop.shopId)} />
                      <XStack alignItems="center" gap="$1.5" flexWrap="wrap">
                        <SafeIcon icon={Icons.Truck} size={13} color={c.inStock} />
                        <Text fontSize={12} color={c.inStock} fontWeight="600">
                          {deliveryEstimateLabel()}
                          {' · '}
                          {checkoutShippingLabel(shopPartners.get(shop.shopId))}
                        </Text>
                      </XStack>
                      <ShopPartnerChips info={shopPartners.get(shop.shopId)} />
                      {shopItems.map((item) => {
                        const stock = listingStock.get(item.listing_id)
                        const maxQuantity = typeof stock === 'number' ? stock : null
                        const atMax =
                          typeof maxQuantity === 'number' && item.quantity >= maxQuantity
                        return (
                          <YStack key={item.id} gap="$2">
                            <XStack gap="$3" alignItems="center">
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
                            <XStack gap="$3" alignItems="center" flexWrap="wrap">
                              <ListingQuantityStepper
                                size="sm"
                                quantity={item.quantity}
                                maxQuantity={maxQuantity}
                                onDecrease={() => {
                                  if (item.quantity <= 1) {
                                    void handleCheckoutRemoveItem(item.id)
                                    return
                                  }
                                  void handleCheckoutQuantityChange(item.id, item.quantity - 1)
                                }}
                                onIncrease={() => {
                                  if (atMax) return
                                  void handleCheckoutQuantityChange(item.id, item.quantity + 1)
                                }}
                              />
                              <YStack height={16} width={1} backgroundColor={c.border} />
                              <CommerceLink onPress={() => void handleCheckoutRemoveItem(item.id)}>
                                Remove
                              </CommerceLink>
                            </XStack>
                          </YStack>
                        )
                      })}
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

              {!hasSideRails ? orderSummary : null}
            </YStack>

            {hasSideRails ? (
              <StickyRail width={SUMMARY_WIDTH} maxWidth="100%">
                {orderSummary}
              </StickyRail>
            ) : null}
          </XStack>
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )

  const addressDrawers = (
    <>
      <AddressFormDrawer
        ui={ui}
        open={addressFormOpen}
        isDesktop={hasSideRails}
        editingAddress={editingAddress}
        initialFormData={addressPrefill}
        submitting={isSavingAddress}
        onClose={closeAddressForm}
        onSubmit={(formData) => void handleSaveAddress(formData)}
      />
      <AddressDeleteDrawer
        ui={ui}
        open={Boolean(addressDeleteTarget)}
        isDesktop={hasSideRails}
        address={addressDeleteTarget}
        submitting={isDeletingAddress}
        onClose={() => setAddressDeleteTarget(null)}
        onConfirm={() => void handleDeleteAddress()}
      />
    </>
  )

  if (!showMobileBar) {
    return (
      <>
        {checkoutLayout}
        {addressDrawers}
      </>
    )
  }

  return (
    <YStack flex={1} width="100%" position="relative">
      {checkoutLayout}
      {addressDrawers}
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
        onHeightChange={setCheckoutBarHeight}
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
      width="100%"
      flexShrink={0}
      position="relative"
      overflow="visible"
      zIndex={1}
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
      <SafeIcon icon={Icons.Gift} size={15} color={active ? c.brand : c.secondary} />
      <Text fontSize={13} fontWeight="600" color={active ? c.brand : c.text}>
        This is a gift
      </Text>
      {active ? <SafeIcon icon={Icons.Check} size={15} color={c.brand} /> : null}
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
  disabled = false,
}: {
  selected: boolean
  title: string
  subtitle: string
  onPress: () => void
  disabled?: boolean
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
      cursor={disabled ? 'not-allowed' : 'pointer'}
      opacity={disabled ? 0.45 : 1}
      onPress={disabled ? undefined : onPress}
      pointerEvents={disabled ? 'none' : 'auto'}
      accessibilityState={{ selected, disabled }}
    >
      <CommerceRadio selected={selected} />
      <YStack flex={1} minWidth={0}>
        <Text fontSize={14} fontWeight="600" color={c.text}>
          {title}
        </Text>
        <Text fontSize={12} color={c.secondary}>
          {disabled && !selected ? 'Unavailable while OTP is in progress' : subtitle}
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
