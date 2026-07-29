import { useCallback, useEffect, useMemo, useState } from 'react'

import { PaymentErrorBoundary } from '~/commerce/components/PaymentErrorBoundary'
import { PaymentProviderCard } from '~/commerce/components/vendor/payment/PaymentProviderCard'
import { PaymentSummaryCards } from '~/commerce/components/vendor/payment/PaymentSummaryCards'
import { Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { radius } from '~/config/tokens'
import { PAYMENT_UI_COPY } from '~/lib/payment/payment-ui.copy'

import { toFriendlyPaymentError } from '~/lib/payment/payment.errors'
import {
  checkPaymentSetupStatus,
  initializePaymentSetup,
  loadPaymentAccounts,
  loadPaymentSettings,
  selectConnectedProviders,
  selectPaymentSetupStatus,
  selectVendorPaymentAccounts,
  selectVendorPaymentError,
  selectVendorPaymentLoading,
  selectVendorPaymentSettings,
  setVendorPaymentShopId,
} from '~/lib/payment/payment.store'
import { PAYMENT_ACCOUNT_STATUS, PAYMENT_PROVIDERS } from '~/lib/payment/payment.constants'
import type { PaymentProviderConfig } from '~/lib/payment/payment.type'
import { getFrontendVisibleProviders, sortProvidersForDisplay } from '~/lib/payment/payment.utils'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { VendorPaymentConnectDrawer } from '~/commerce/screens/vendor/VendorPaymentConnectDrawer'

type VendorPaymentMethodsPanelProps = {
  ui: AppUiTokens
  shopId: string
  isDesktop: boolean
  safeBottom: number
}

export function VendorPaymentMethodsPanel({
  ui,
  shopId,
  isDesktop,
  safeBottom,
}: VendorPaymentMethodsPanelProps) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()

  const accounts = useAppSelector(selectVendorPaymentAccounts)
  const connectedProviders = useAppSelector(selectConnectedProviders)
  const setupStatus = useAppSelector(selectPaymentSetupStatus)
  const paymentSettings = useAppSelector(selectVendorPaymentSettings)
  const loading = useAppSelector(selectVendorPaymentLoading)
  const storeError = useAppSelector(selectVendorPaymentError)

  const [selectedProvider, setSelectedProvider] = useState<PaymentProviderConfig | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [initializedShopId, setInitializedShopId] = useState<string | null>(null)

  const refreshPaymentState = useCallback(async () => {
    await Promise.all([
      dispatch(loadPaymentAccounts({ shopId })),
      dispatch(loadPaymentSettings({ shopId })),
      dispatch(checkPaymentSetupStatus({ shopId })),
    ])
  }, [dispatch, shopId])

  useEffect(() => {
    if (!shopId) return
    dispatch(setVendorPaymentShopId(shopId))

    let active = true
    void (async () => {
      try {
        if (initializedShopId !== shopId) {
          await dispatch(initializePaymentSetup({ shopId })).unwrap()
          if (active) setInitializedShopId(shopId)
        } else {
          await refreshPaymentState()
        }
      } catch (error) {
        if (active) {
          toast.show(PAYMENT_UI_COPY.loadError, {
            tone: 'danger',
            message: toFriendlyPaymentError(error),
          })
        }
      }
    })()

    return () => {
      active = false
    }
  }, [dispatch, initializedShopId, refreshPaymentState, shopId, toast])

  const connectedIds = useMemo(() => {
    const ids = new Set<string>()
    connectedProviders.forEach((row) => ids.add(row.provider))
    accounts
      .filter((account) => account.status === PAYMENT_ACCOUNT_STATUS.CONNECTED)
      .forEach((account) => ids.add(String(account.provider)))
    return ids
  }, [accounts, connectedProviders])

  // Only Razorpay is live for now — other providers will appear here once enabled.
  const providers = useMemo(
    () =>
      sortProvidersForDisplay(
        getFrontendVisibleProviders().filter((p) => p.id === PAYMENT_PROVIDERS.RAZORPAY),
        connectedIds,
      ),
    [connectedIds],
  )

  const connectedCount = connectedIds.size
  const isInitialLoading =
    loading.accounts && loading.settings && accounts.length === 0 && !storeError

  function openProvider(provider: PaymentProviderConfig) {
    setSelectedProvider(provider)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setSelectedProvider(null)
  }

  if (isInitialLoading) {
    return (
      <XStack alignItems="center" gap="$2" paddingVertical="$6">
        <Spinner size="small" />
        <Text fontSize={13} color={ui.textMuted}>
          Loading payment methods…
        </Text>
      </XStack>
    )
  }

  return (
    <PaymentErrorBoundary
      scope="VendorPaymentMethods"
      title="Payment settings unavailable"
      onReset={() => void refreshPaymentState()}
    >
      <YStack gap="$5" width="100%" maxWidth={1200} alignSelf="center">
        <PaymentSummaryCards
          ui={ui}
          connectedCount={connectedCount}
          setupStatus={setupStatus}
          isDesktop={isDesktop}
        />

        {connectedCount === 0 ? (
          <XStack
            gap="$2.5"
            padding="$3.5"
            borderRadius={radius.card}
            backgroundColor={ui.roseSurface}
            borderWidth={1}
            borderColor={`${ui.brand}55`}
            alignItems="flex-start"
          >
            <Icons.AlertTriangle size={18} color={ui.brand} />
            <Text flex={1} fontSize={13} color={ui.textSecondary} lineHeight={20}>
              {PAYMENT_UI_COPY.noProvidersWarning}
            </Text>
          </XStack>
        ) : null}

        <YStack gap="$3" width="100%">
          {providers.map((provider) => (
            <PaymentProviderCard
              key={provider.id}
              ui={ui}
              provider={provider}
              accounts={accounts}
              connectedProviders={connectedProviders}
              onPress={openProvider}
            />
          ))}
        </YStack>
      </YStack>

      <VendorPaymentConnectDrawer
        ui={ui}
        open={drawerOpen}
        isDesktop={isDesktop}
        shopId={shopId}
        provider={selectedProvider}
        accounts={accounts}
        connectedProviders={connectedProviders}
        webhookUrl={paymentSettings?.webhook_url}
        safeBottom={safeBottom}
        onClose={closeDrawer}
        onConnected={() => void refreshPaymentState()}
      />
    </PaymentErrorBoundary>
  )
}
