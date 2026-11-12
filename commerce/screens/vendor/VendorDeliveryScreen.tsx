import { useEffect } from 'react'
import { useWindowDimensions } from 'react-native'
import { useRouter } from 'one'

import { DeliveryErrorBoundary } from '~/commerce/components/DeliveryErrorBoundary'
import { VendorNoShopState } from '~/commerce/components/vendor/VendorShopGate'
import { PageCenter } from '~/components/layout'
import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { GETTING_STARTED_STEPS } from '~/lib/vendor-shipping/vendor-shipping.constants'
import { clearVendorShippingError, setVendorShippingShopId } from '~/lib/vendor-shipping/vendor-shipping.store'
import { VENDOR_SHIPPING_UI_COPY } from '~/lib/vendor-shipping/vendor-shipping-ui.copy'
import { vendorRoutes } from '~/lib/routes'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

export function VendorDeliveryScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const dispatch = useAppDispatch()
  const { isDesktop, safeBottom } = useAppLayout()
  const { width } = useWindowDimensions()
  const compact = width < 380

  const shop = useAppSelector((state) => state.shop.currentShop)
  const isLoadingMyShops = useAppSelector((state) => state.shop.isLoadingMyShops)
  const myShopsLoaded = useAppSelector((state) => state.shop.myShopsLoaded)
  const error = useAppSelector((state) => state.vendorShipping.error)

  useEffect(() => {
    if (!shop?.id) return
    dispatch(setVendorShippingShopId(shop.id))
    return () => {
      dispatch(clearVendorShippingError())
    }
  }, [dispatch, shop?.id])

  if (!shop && (isLoadingMyShops || !myShopsLoaded)) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (!shop) {
    return (
      <VendorNoShopState
        ui={ui}
        title={VENDOR_SHIPPING_UI_COPY.noShopTitle}
        body={VENDOR_SHIPPING_UI_COPY.noShopBody}
      />
    )
  }

  return (
    <DeliveryErrorBoundary scope="vendor-delivery" onReset={() => undefined}>
      <YStack
        width="100%"
        maxWidth="100%"
        alignSelf="stretch"
        gap="$4"
        paddingHorizontal={isDesktop ? '$6' : '$4'}
        paddingTop={isDesktop ? '$6' : '$4'}
        paddingBottom={(isDesktop ? 32 : 24) + safeBottom}
      >
        <XStack alignItems="flex-start" justifyContent="space-between" gap="$3" flexWrap="wrap">
          <XStack gap="$3" flex={1} minWidth={220}>
            <YStack
              width={44}
              height={44}
              borderRadius={12}
              backgroundColor={ui.roseSurface}
              alignItems="center"
              justifyContent="center"
            >
              <Icons.Package size={22} color={ui.brand} />
            </YStack>
            <YStack gap="$1" flex={1}>
              <Text fontSize={isDesktop ? 28 : 22} fontWeight="800" color={ui.text}>
                {VENDOR_SHIPPING_UI_COPY.screenTitle}
              </Text>
              <Text fontSize={13} color={ui.textSecondary} maxWidth={640} lineHeight={20}>
                {compact
                  ? VENDOR_SHIPPING_UI_COPY.screenSubtitleCompact
                  : VENDOR_SHIPPING_UI_COPY.screenSubtitle}
              </Text>
            </YStack>
          </XStack>
          {compact ? (
            <Button
              tone="primary"
              size="$3"
              icon={<Icons.Truck size={15} />}
              onPress={() => router.push(vendorRoutes.wallet)}
            >
              {VENDOR_SHIPPING_UI_COPY.getStartedAction}
            </Button>
          ) : null}
        </XStack>

        <YStack
          padding="$4"
          borderRadius={radius.chip}
          borderWidth={1}
          borderColor="#BFDBFE"
          backgroundColor="#EFF6FF"
          gap="$2"
        >
          <XStack gap="$2" alignItems="flex-start">
            <Icons.Truck size={16} color="#2563EB" />
            <Text fontSize={13} color="#1D4ED8" lineHeight={20} flex={1}>
              {compact
                ? VENDOR_SHIPPING_UI_COPY.infoBannerCompact
                : VENDOR_SHIPPING_UI_COPY.infoBanner}
            </Text>
          </XStack>
        </YStack>

        {error ? (
          <Text fontSize={13} color={ui.danger}>
            {error}
          </Text>
        ) : null}

        <YStack
          gap="$3"
          padding="$4"
          borderRadius={radius.card}
          borderWidth={1.5}
          borderColor={ui.brand}
          backgroundColor={ui.chip}
        >
          <Text fontSize={16} fontWeight="800" color={ui.text}>
            {VENDOR_SHIPPING_UI_COPY.providersTitle}
          </Text>
          <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
            {compact
              ? VENDOR_SHIPPING_UI_COPY.providersSubtitleCompact
              : VENDOR_SHIPPING_UI_COPY.providersSubtitle}
          </Text>
          <Button
            tone="primary"
            size="$3"
            alignSelf="flex-start"
            borderRadius={999}
            onPress={() => router.push(vendorRoutes.wallet)}
          >
            Open shipping credit
          </Button>
        </YStack>

        <YStack
          gap="$4"
          padding="$5"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor="#BFDBFE"
          backgroundColor="#EFF6FF"
          style={getShadowStyle('sm')}
        >
          <XStack gap="$3" alignItems="flex-start">
            <YStack
              width={40}
              height={40}
              borderRadius={10}
              backgroundColor="#DBEAFE"
              alignItems="center"
              justifyContent="center"
            >
              <Icons.Truck size={18} color="#2563EB" />
            </YStack>
            <YStack gap={2}>
              <Text fontSize={16} fontWeight="800" color={ui.text}>
                {VENDOR_SHIPPING_UI_COPY.gettingStartedTitle}
              </Text>
              <Text fontSize={13} color={ui.textSecondary}>
                {VENDOR_SHIPPING_UI_COPY.gettingStartedSubtitle}
              </Text>
            </YStack>
          </XStack>
          <XStack gap="$3" flexWrap="wrap">
            {GETTING_STARTED_STEPS.map((step, index) => (
              <YStack
                key={step.id}
                flex={1}
                minWidth={220}
                gap="$2"
                padding="$3"
                borderRadius={14}
                backgroundColor="rgba(255,255,255,0.65)"
              >
                <XStack gap="$2" alignItems="center">
                  <YStack
                    width={24}
                    height={24}
                    borderRadius={999}
                    backgroundColor={ui.roseSurface}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text fontSize={12} fontWeight="800" color={ui.brand}>
                      {index + 1}
                    </Text>
                  </YStack>
                  <Text fontSize={13} fontWeight="800" color={ui.text}>
                    {step.title}
                  </Text>
                </XStack>
                <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
                  {compact ? step.compactDescription : step.description}
                </Text>
                {step.id === 'configure-rates' ? (
                  <Button
                    tone="outline"
                    size="$2"
                    alignSelf="flex-start"
                    onPress={() => router.push(vendorRoutes.settingsSection('shipping'))}
                  >
                    Open shipping settings
                  </Button>
                ) : null}
                {step.id === 'fund-easyship' ? (
                  <Button
                    tone="outline"
                    size="$2"
                    alignSelf="flex-start"
                    onPress={() => router.push(vendorRoutes.wallet)}
                  >
                    Open shipping credit
                  </Button>
                ) : null}
              </YStack>
            ))}
          </XStack>
        </YStack>

        <YStack
          gap="$4"
          padding="$5"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          style={getShadowStyle('sm')}
        >
          <XStack gap="$3" alignItems="flex-start" flexWrap="wrap">
            <YStack
              width={40}
              height={40}
              borderRadius={10}
              backgroundColor={ui.surfaceMuted}
              alignItems="center"
              justifyContent="center"
            >
              <Icons.HelpCircle size={18} color={ui.textSecondary} />
            </YStack>
            <YStack flex={1} minWidth={220} gap={2}>
              <Text fontSize={16} fontWeight="800" color={ui.text}>
                {VENDOR_SHIPPING_UI_COPY.supportTitle}
              </Text>
              <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
                {compact ? VENDOR_SHIPPING_UI_COPY.supportBodyCompact : VENDOR_SHIPPING_UI_COPY.supportBody}
              </Text>
            </YStack>
            <XStack gap="$2" flexWrap="wrap">
              <Button tone="outline" size="$3" icon={<Icons.HelpCircle size={15} />}>
                {compact ? VENDOR_SHIPPING_UI_COPY.supportActionCompact : VENDOR_SHIPPING_UI_COPY.supportAction}
              </Button>
              <Button tone="outline" size="$3" icon={<Icons.BookOpen size={15} />}>
                {compact ? VENDOR_SHIPPING_UI_COPY.docsActionCompact : VENDOR_SHIPPING_UI_COPY.docsAction}
              </Button>
            </XStack>
          </XStack>
        </YStack>

      </YStack>
    </DeliveryErrorBoundary>
  )
}
