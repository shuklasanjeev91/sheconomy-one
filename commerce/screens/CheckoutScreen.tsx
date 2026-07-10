import { Link, Redirect, useRouter } from 'one'
import { useEffect, useMemo, useState } from 'react'

import {
  Button,
  Field,
  Input,
  Paragraph,
  Spinner,
  Text,
  Theme,
  ValidatedTextField,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection } from '~/components/layout'
import { BRAND_THEME, radius, getShadowStyle } from '~/config/tokens'
import { useCart } from '~/commerce/hooks/useCart'
import { CommercePageHeader, CommercePanel } from '~/commerce/components'
import {
  createOrderFromCart,
  fetchUserAddresses,
  saveUserAddress,
  type CheckoutAddressInput,
  type UserAddress,
} from '~/commerce/lib/checkout'
import { cartRequiresShipping, fetchListingTypesByIds } from '~/commerce/lib/listing-fulfillment'
import { formatCurrency } from '~/lib/format'
import { useFormValidation } from '~/hooks/useFormValidation'
import { useProfile } from '~/hooks/useProfile'
import { openExternalUrl } from '~/lib/platform/openUrl'
import { commerceRoutes, routes } from '~/lib/routes'
import { maxLength, minLength, postalCodeIN, required } from '~/lib/validation'
import { useAppUi } from '~/lib/theme/useAppUi'

const EMPTY_ADDRESS: CheckoutAddressInput = {
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'IN',
  address_label: 'Home',
}

export function CheckoutScreen() {
  const ui = useAppUi()
  const { user, isAuthenticated } = useProfile()
  const { cart, items, isLoading, refresh } = useCart()
  const toast = useAppToast()
  const router = useRouter()
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [useNewAddress, setUseNewAddress] = useState(false)
  const addressForm = useFormValidation(
    useMemo(
      () => ({
        address_line_1: { validators: [required('Address line 1 is required.'), minLength(3)] },
        address_line_2: { validators: [maxLength(120)] },
        city: { validators: [required('City is required.'), minLength(2)] },
        state: { validators: [required('State is required.'), minLength(2)] },
        postal_code: { validators: [required('Postal code is required.'), postalCodeIN()] },
      }),
      [],
    ),
  )
  const [customerNotes, setCustomerNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true)
  const [listingTypes, setListingTypes] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    const ids = items.map((item) => item.listing_id)
    if (!ids.length) {
      setListingTypes(new Map())
      return
    }
    void fetchListingTypesByIds(ids).then(setListingTypes)
  }, [items])

  useEffect(() => {
    if (!isAuthenticated || !user) return

    setIsLoadingAddresses(true)
    fetchUserAddresses(user.id).then(({ addresses: rows, error }) => {
      setAddresses(rows)
      const defaultAddress = rows.find((row) => row.is_default) ?? rows[0]
      setSelectedAddressId(defaultAddress?.id ?? null)
      setUseNewAddress(rows.length === 0)
      if (error) {
        toast.show('Could not load addresses', { tone: 'danger', message: error })
      }
      setIsLoadingAddresses(false)
    })
  }, [isAuthenticated, toast, user])

  if (!isAuthenticated) {
    return <Redirect href={routes.signIn} />
  }

  if (isLoading || isLoadingAddresses) {
    return (
      <FullWidthLayout>
        <PageSection paddingVertical="$10" alignItems="center">
          <Spinner size="large" />
        </PageSection>
      </FullWidthLayout>
    )
  }

  if (!cart || items.length === 0) {
    return <Redirect href={commerceRoutes.cart} />
  }

  const currency = cart.currency ?? 'INR'
  const needsShipping = cartRequiresShipping(
    listingTypes,
    items.map((item) => item.listing_id),
  )
  const hasDigitalItems = items.some((item) => listingTypes.get(item.listing_id) === 'digital')

  async function handlePlaceOrder() {
    if (!cart || !user) return

    setIsSubmitting(true)

    let shippingAddressId = selectedAddressId

    try {
      if (needsShipping) {
        if (useNewAddress) {
          if (!addressForm.validateAll()) {
            setIsSubmitting(false)
            return
          }

          const newAddress: CheckoutAddressInput = {
            ...EMPTY_ADDRESS,
            address_line_1: addressForm.fields.address_line_1.value.trim(),
            address_line_2: addressForm.fields.address_line_2.value.trim(),
            city: addressForm.fields.city.value.trim(),
            state: addressForm.fields.state.value.trim(),
            postal_code: addressForm.fields.postal_code.value.trim(),
          }

          const { address, error } = await saveUserAddress(user.id, newAddress)
          if (error || !address) {
            toast.show('Could not save address', { tone: 'danger', message: error ?? undefined })
            setIsSubmitting(false)
            return
          }
          shippingAddressId = address.id
        }

        if (!shippingAddressId) {
          toast.show('Select a shipping address', { tone: 'danger' })
          setIsSubmitting(false)
          return
        }
      } else if (!shippingAddressId && addresses[0]?.id) {
        shippingAddressId = addresses[0].id
      }

      if (!shippingAddressId) {
        toast.show('Add an address for your order records', { tone: 'danger' })
        setIsSubmitting(false)
        return
      }

      const { data, error } = await createOrderFromCart({
        cartId: cart.id,
        shippingAddressId,
        customerNotes,
        paymentMethod: needsShipping ? paymentMethod : 'online',
      })

      if (error) {
        toast.show('Checkout failed', { tone: 'danger', message: error })
        setIsSubmitting(false)
        return
      }

      await refresh()

      if (data?.checkoutUrl && paymentMethod === 'online') {
        const opened = await openExternalUrl(data.checkoutUrl)
        if (opened) return
      }

      toast.show('Order placed', {
        tone: 'success',
        message: data?.orderNumber
          ? `Order ${data.orderNumber} has been created.`
          : 'Your order has been created.',
      })
      router.replace(commerceRoutes.home)
    } catch {
      toast.show('Checkout failed', { tone: 'danger', message: 'Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6" {...LAYOUT_STRETCH}>
          <YStack gap="$6" width="100%" {...LAYOUT_STRETCH}>
            <CommercePageHeader
              title="Checkout"
              subtitle={
                needsShipping
                  ? 'Review your order and shipping details'
                  : 'Review your order — digital items download instantly'
              }
            />

            <XStack gap="$5" flexWrap="wrap" alignItems="flex-start">
              <YStack flex={1} minWidth={300} gap="$4">
                {hasDigitalItems && !needsShipping ? (
                  <CommercePanel backgroundColor={ui.digitalBg}>
                    <Text fontWeight="700" fontSize={16} color={ui.text}>
                      Digital delivery
                    </Text>
                    <Text fontSize={13} color={ui.textSecondary} lineHeight={18} fontWeight="500">
                      Your digital files will be available to download right after purchase. No
                      shipping required.
                    </Text>
                  </CommercePanel>
                ) : null}

                {needsShipping ? (
                <CommercePanel>
                  <Text fontWeight="700" fontSize={16} color={ui.text}>
                    Shipping address
                  </Text>

                  {addresses.length > 0 ? (
                    <YStack gap="$2">
                      {addresses.map((address) => (
                        <XStack
                          key={address.id}
                          gap="$3"
                          padding="$3"
                          borderRadius={radius.chip}
                          borderWidth={1}
                          borderColor={
                            !useNewAddress && selectedAddressId === address.id
                              ? ui.brand
                              : ui.borderSubtle
                          }
                          cursor="pointer"
                          onPress={() => {
                            setUseNewAddress(false)
                            setSelectedAddressId(address.id)
                          }}
                        >
                          <YStack flex={1} gap={2}>
                            <Text fontWeight="500" fontSize={14}>
                              {address.address_label}
                            </Text>
                            <Paragraph fontSize={13} color={ui.textSecondary}>
                              {address.address_line_1}
                              {address.address_line_2 ? `, ${address.address_line_2}` : ''}
                              {'\n'}
                              {address.city}, {address.state} {address.postal_code}
                            </Paragraph>
                          </YStack>
                        </XStack>
                      ))}
                    </YStack>
                  ) : null}

                  <Button
                    tone={useNewAddress ? 'primary' : 'outline'}
                    size="$3"
                    borderRadius={999}
                    alignSelf="flex-start"
                    onPress={() => setUseNewAddress(true)}
                  >
                    {addresses.length ? 'Use a new address' : 'Add shipping address'}
                  </Button>

                  {useNewAddress ? (
                    <YStack gap="$3">
                      <ValidatedTextField
                        label="Address line 1"
                        field={addressForm.fields.address_line_1}
                        required
                      />
                      <ValidatedTextField label="Address line 2" field={addressForm.fields.address_line_2} />
                      <XStack gap="$3" flexWrap="wrap">
                        <ValidatedTextField label="City" field={addressForm.fields.city} flex={1} minWidth={140} required />
                        <ValidatedTextField label="State" field={addressForm.fields.state} flex={1} minWidth={140} required />
                      </XStack>
                      <ValidatedTextField
                        label="Postal code"
                        field={addressForm.fields.postal_code}
                        required
                      />
                    </YStack>
                  ) : null}
                </CommercePanel>
                ) : null}

                <CommercePanel>
                  <Text fontWeight="700" fontSize={16} color={ui.text}>
                    Payment
                  </Text>
                  <XStack gap="$2" flexWrap="wrap">
                    <Button
                      tone={paymentMethod === 'online' ? 'primary' : 'outline'}
                      size="$3"
                      borderRadius={999}
                      onPress={() => setPaymentMethod('online')}
                    >
                      Pay online
                    </Button>
                    {needsShipping ? (
                    <Button
                      tone={paymentMethod === 'cod' ? 'primary' : 'outline'}
                      size="$3"
                      borderRadius={999}
                      onPress={() => setPaymentMethod('cod')}
                    >
                      Cash on delivery
                    </Button>
                    ) : null}
                  </XStack>
                  <Field label="Order notes (optional)">
                    <Input value={customerNotes} onChangeText={setCustomerNotes} />
                  </Field>
                </CommercePanel>
              </YStack>

              <CommercePanel
                width="100%"
                maxWidth="100%"
                gap="$4"
                style={getShadowStyle('md')}
                $gtMd={{
                  width: 340,
                  position: 'sticky',
                  top: 80,
                  alignSelf: 'flex-start',
                }}
              >
                <Text fontWeight="700" fontSize={18} color={ui.text} letterSpacing={-0.2}>
                  Order summary
                </Text>
                {items.map((item) => (
                  <XStack key={item.id} justifyContent="space-between" gap="$3">
                    <Text flex={1} fontSize={13} numberOfLines={2}>
                      {item.title} × {item.quantity}
                    </Text>
                    <Text fontSize={13} fontWeight="500">
                      {formatCurrency(item.unit_price * item.quantity, currency)}
                    </Text>
                  </XStack>
                ))}
                <XStack
                  justifyContent="space-between"
                  paddingTop="$2"
                  borderTopWidth={1}
                  borderTopColor={ui.borderSubtle}
                >
                  <Text fontWeight="700">Total</Text>
                  <Text fontWeight="700">{formatCurrency(cart.total_amount, currency)}</Text>
                </XStack>
                <Theme name={BRAND_THEME}>
                  <Button
                    tone="primary"
                    size="$4"
                    borderRadius={999}
                    disabled={isSubmitting}
                    onPress={handlePlaceOrder}
                    icon={isSubmitting ? <Spinner size="small" color="white" /> : undefined}
                  >
                    {isSubmitting ? 'Placing order…' : 'Place order'}
                  </Button>
                </Theme>
                <Link href={commerceRoutes.cart} asChild>
                  <Button tone="outline" size="$3" borderRadius={999}>
                    Back to cart
                  </Button>
                </Link>
              </CommercePanel>
            </XStack>
          </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}