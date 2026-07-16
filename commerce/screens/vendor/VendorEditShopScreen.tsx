import { useEffect } from 'react'
import { useRouter } from 'one'

import {
  Button,
  Field,
  Icons,
  Input,
  Spinner,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { PageCenter } from '~/components/layout'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { vendorRoutes } from '~/lib/routes'
import {
  loadFormFromShop,
  loadMyShops,
  updateShop,
  updateShopField,
  validateForm,
} from '~/lib/shop/shop.store'
import {
  COMMON_SHOP_CATEGORIES,
  DEFAULT_SHOP_CURRENCY,
  SUPPORTED_CURRENCIES,
  type ShopFormData,
  type ShopUpdate,
} from '~/lib/shop/shop.type'
import { shopToFormData } from '~/lib/shop/shop.utils'
import { validateShopData } from '~/lib/shop/shop.validation'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

export function VendorEditShopScreen() {
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()
  const router = useRouter()
  const toast = useAppToast()
  const dispatch = useAppDispatch()

  const shop = useAppSelector((s) => s.shop.currentShop)
  const form = useAppSelector((s) => s.shop.formData)
  const validation = useAppSelector((s) => s.shop.validation)
  const isUpdating = useAppSelector((s) => s.shop.isUpdating)
  const isLoadingShops = useAppSelector((s) => s.shop.isLoadingShops)

  useEffect(() => {
    if (!shop) void dispatch(loadMyShops(undefined))
  }, [dispatch, shop])

  useEffect(() => {
    if (shop) dispatch(loadFormFromShop(shopToFormData(shop)))
  }, [dispatch, shop?.id])

  function setField<K extends keyof ShopFormData>(field: K, value: ShopFormData[K]) {
    dispatch(updateShopField({ field, value }))
  }

  function toggleCategory(category: string) {
    const current = form.shop_categories ?? []
    const next = current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category]
    setField('shop_categories', next)
  }

  async function handleSave() {
    if (!shop) return

    dispatch(validateForm())
    const result = validateShopData(form)
    if (!result.isValid) {
      const firstError = Object.values(result.errors)[0]
      toast.show('Please fix the highlighted fields', {
        tone: 'danger',
        message: firstError,
      })
      return
    }

    const updates: ShopUpdate = {
      shop_name: form.shop_name.trim(),
      shop_description: form.shop_description.trim() || null,
      shop_email: form.shop_email.trim() || null,
      shop_phone_number: form.shop_phone_number.trim() || null,
      website_url: form.website_url.trim() || null,
      shop_currency: form.shop_currency || DEFAULT_SHOP_CURRENCY,
      shop_categories: form.shop_categories,
    }

    try {
      await dispatch(updateShop({ shopId: shop.id, updates })).unwrap()
      toast.show('Shop updated', { tone: 'success' })
      router.replace(vendorRoutes.myShop)
    } catch (error) {
      toast.show('Could not save changes', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Please try again.',
      })
    }
  }

  if (!shop && isLoadingShops) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (!shop) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$2" minHeight={320}>
        <Icons.Store size={30} color={ui.brand} />
        <Text fontSize={16} fontWeight="700" color={ui.text}>
          No shop to edit
        </Text>
      </YStack>
    )
  }

  const errors = validation.errors

  return (
    <YStack
      width="100%"
      maxWidth={720}
      gap="$5"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={(isDesktop ? 32 : 24) + safeBottom}
    >
      {/* Header */}
      <YStack gap="$1">
        <Text fontSize={isDesktop ? 24 : 20} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
          Edit Shop
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Update the details shoppers see on your storefront.
        </Text>
      </YStack>

      {/* Basics */}
      <YStack
        gap="$3.5"
        padding="$5"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        style={getShadowStyle('sm')}
      >
        <Text fontSize={15} fontWeight="800" color={ui.text}>
          Shop basics
        </Text>
        <Field label="Shop name" required error={errors.shop_name}>
          <Input
            value={form.shop_name}
            onChangeText={(value) => setField('shop_name', value)}
            placeholder="Your shop name"
          />
        </Field>
        <Field label="Description" error={errors.shop_description}>
          <TextArea
            value={form.shop_description}
            onChangeText={(value) => setField('shop_description', value)}
            minHeight={110}
            placeholder="Tell shoppers what your shop offers"
          />
        </Field>

        <YStack gap="$2">
          <Text fontSize={13} fontWeight="600" color={ui.text}>
            Currency
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            {SUPPORTED_CURRENCIES.map((currency) => {
              const active = (form.shop_currency || DEFAULT_SHOP_CURRENCY) === currency.code
              return (
                <XStack
                  key={currency.code}
                  alignItems="center"
                  gap="$1.5"
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderRadius={999}
                  borderWidth={1}
                  cursor="pointer"
                  animation="quick"
                  borderColor={active ? ui.brand : ui.borderSubtle}
                  backgroundColor={active ? ui.brand : ui.surfaceMuted}
                  pressStyle={{ opacity: 0.85 }}
                  onPress={() => setField('shop_currency', currency.code)}
                >
                  <Text fontSize={13} fontWeight="700" color={active ? ui.onBrand : ui.text}>
                    {currency.symbol} {currency.code}
                  </Text>
                </XStack>
              )
            })}
          </XStack>
        </YStack>
      </YStack>

      {/* Contact */}
      <YStack
        gap="$3.5"
        padding="$5"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        style={getShadowStyle('sm')}
      >
        <Text fontSize={15} fontWeight="800" color={ui.text}>
          Contact
        </Text>
        <Field label="Support email" error={errors.shop_email}>
          <Input
            value={form.shop_email}
            onChangeText={(value) => setField('shop_email', value)}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="support@yourshop.com"
          />
        </Field>
        <Field label="Phone" error={errors.shop_phone_number}>
          <Input
            value={form.shop_phone_number}
            onChangeText={(value) => setField('shop_phone_number', value)}
            keyboardType="phone-pad"
            placeholder="+91XXXXXXXXXX"
          />
        </Field>
        <Field label="Website" error={errors.website_url}>
          <Input
            value={form.website_url}
            onChangeText={(value) => setField('website_url', value)}
            autoCapitalize="none"
            placeholder="https://yourshop.com"
          />
        </Field>
      </YStack>

      {/* Categories */}
      <YStack
        gap="$3"
        padding="$5"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        style={getShadowStyle('sm')}
      >
        <Text fontSize={15} fontWeight="800" color={ui.text}>
          Categories
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          {COMMON_SHOP_CATEGORIES.map((category) => {
            const active = (form.shop_categories ?? []).includes(category)
            return (
              <XStack
                key={category}
                paddingHorizontal="$3"
                paddingVertical="$2"
                borderRadius={999}
                borderWidth={1}
                cursor="pointer"
                animation="quick"
                borderColor={active ? ui.brand : ui.borderSubtle}
                backgroundColor={active ? ui.brand : ui.surfaceMuted}
                pressStyle={{ opacity: 0.85 }}
                onPress={() => toggleCategory(category)}
              >
                <Text fontSize={12} fontWeight="600" color={active ? ui.onBrand : ui.text}>
                  {category}
                </Text>
              </XStack>
            )
          })}
        </XStack>
      </YStack>

      {/* Actions */}
      <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
        <Button
          tone="outline"
          size="$4"
          borderRadius={999}
          onPress={() => router.replace(vendorRoutes.myShop)}
        >
          Cancel
        </Button>
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          disabled={isUpdating}
          onPress={() => void handleSave()}
          icon={isUpdating ? <Spinner size="small" color="white" /> : <Icons.Check size={16} />}
        >
          {isUpdating ? 'Saving…' : 'Save changes'}
        </Button>
      </XStack>
    </YStack>
  )
}
