import { useCallback, useEffect, useMemo } from 'react'
import { useWindowDimensions } from 'react-native'
import { useRouter } from 'one'

import { DeliveryErrorBoundary } from '~/commerce/components/DeliveryErrorBoundary'
import { CustomShippingPartnerPanel } from '~/commerce/components/vendor/delivery/CustomShippingPartnerPanel'
import { ShiprocketConnectionPanel } from '~/commerce/components/vendor/delivery/ShiprocketConnectionPanel'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { GETTING_STARTED_STEPS } from '~/lib/vendor-shipping/vendor-shipping.constants'
import { toFriendlyVendorShippingError } from '~/lib/vendor-shipping/vendor-shipping.errors'
import {
  clearVendorShippingError,
  loadCustomShippingPartners,
  loadShiprocketStatus,
  setVendorShippingShopId,
} from '~/lib/vendor-shipping/vendor-shipping.store'
import { VENDOR_SHIPPING_UI_COPY } from '~/lib/vendor-shipping/vendor-shipping-ui.copy'
import { vendorRoutes } from '~/lib/routes'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

export function VendorDeliveryScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const { isDesktop, safeBottom } = useAppLayout()
  const { width } = useWindowDimensions()
  const compact = width < 380

  const shop = useAppSelector((state) => state.shop.currentShop)
  const profile = useAppSelector((state) => state.profile.profile)
  const shiprocketStatus = useAppSelector((state) => state.vendorShipping.shiprocketStatus)
  const customPartners = useAppSelector((state) => state.vendorShipping.customPartners)
  const loadingStatus = useAppSelector((state) => state.vendorShipping.loadingStatus)
  const loadingPartners = useAppSelector((state) => state.vendorShipping.loadingPartners)
  const connecting = useAppSelector((state) => state.vendorShipping.connecting)
  const disconnecting = useAppSelector((state) => state.vendorShipping.disconnecting)
  const creatingPartner = useAppSelector((state) => state.vendorShipping.creatingPartner)
  const error = useAppSelector((state) => state.vendorShipping.error)

  const accessContext = useMemo(
    () => ({ userId: profile?.id, role: profile?.role }),
    [profile?.id, profile?.role],
  )

  const refreshAll = useCallback(async () => {
    if (!shop?.id) return
    await Promise.all([
      dispatch(loadShiprocketStatus({ shopId: shop.id, accessContext })).unwrap(),
      dispatch(loadCustomShippingPartners({ shopId: shop.id, accessContext })).unwrap(),
    ])
  }, [accessContext, dispatch, shop?.id])

  useEffect(() => {
    if (!shop?.id) return
    dispatch(setVendorShippingShopId(shop.id))
    void refreshAll().catch((err) => {
      toast.show('Could not load delivery settings', {
        tone: 'danger',
        message: toFriendlyVendorShippingError(err),
      })
    })
    return () => {
      dispatch(clearVendorShippingError())
    }
  }, [dispatch, refreshAll, shop?.id, toast])

  if (!shop) {
    return (
      <YStack padding="$6" alignItems="center" gap="$2">
        <Icons.Store size={30} color={ui.textMuted} />
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          {VENDOR_SHIPPING_UI_COPY.noShopTitle}
        </Text>
        <Text color={ui.textSecondary} textAlign="center">
          {VENDOR_SHIPPING_UI_COPY.noShopBody}
        </Text>
      </YStack>
    )
  }

  return (
    <DeliveryErrorBoundary scope="vendor-delivery" onReset={() => void refreshAll()}>
      <YStack
        width="100%"
        maxWidth={1120}
        alignSelf="center"
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
            <Button tone="primary" size="$3" icon={<Icons.Truck size={15} />}>
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

        <YStack gap="$2">
          <Text fontSize={18} fontWeight="800" color={ui.text}>
            {VENDOR_SHIPPING_UI_COPY.providersTitle}
          </Text>
          <Text fontSize={13} color={ui.textSecondary}>
            {compact
              ? VENDOR_SHIPPING_UI_COPY.providersSubtitleCompact
              : VENDOR_SHIPPING_UI_COPY.providersSubtitle}
          </Text>
        </YStack>

        <ShiprocketConnectionPanel
          ui={ui}
          shopId={shop.id}
          status={shiprocketStatus}
          loading={loadingStatus}
          connecting={connecting}
          disconnecting={disconnecting}
          compact={compact}
          accessContext={accessContext}
          onStatusChange={() => void refreshAll()}
        />

        <CustomShippingPartnerPanel
          ui={ui}
          shopId={shop.id}
          partners={customPartners}
          loading={loadingPartners}
          creating={creatingPartner}
          accessContext={accessContext}
          onRefresh={() => void refreshAll()}
        />

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

        {loadingStatus && loadingPartners ? (
          <YStack alignItems="center" padding="$4">
            <Spinner size="small" />
          </YStack>
        ) : null}
      </YStack>
    </DeliveryErrorBoundary>
  )
}
