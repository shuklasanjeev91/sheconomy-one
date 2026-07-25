import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

import { PaymentErrorBoundary } from '~/commerce/components/PaymentErrorBoundary'
import { PaymentProviderCard } from '~/commerce/components/vendor/payment/PaymentProviderCard'
import { PaymentProviderSearchField } from '~/commerce/components/vendor/payment/PaymentProviderSearchField'
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
import { PAYMENT_ACCOUNT_STATUS } from '~/lib/payment/payment.constants'
import type { PaymentProviderConfig } from '~/lib/payment/payment.type'
import { filterPaymentProvidersByQuery, getFrontendVisibleProviders, sortProvidersForDisplay } from '~/lib/payment/payment.utils'
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
  const [searchQuery, setSearchQuery] = useState('')

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

  const providers = useMemo(
    () => sortProvidersForDisplay(getFrontendVisibleProviders(), connectedIds),
    [connectedIds],
  )

  const filteredProviders = useMemo(
    () => filterPaymentProvidersByQuery(providers, searchQuery),
    [providers, searchQuery],
  )

  const hasSearchQuery = searchQuery.trim().length > 0

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

        <YStack gap="$3">
          <Text fontSize={18} fontWeight="800" color={ui.text} letterSpacing={-0.2}>
            {PAYMENT_UI_COPY.availableProviders}
          </Text>

          <PaymentProviderSearchField
            ui={ui}
            value={searchQuery}
            onChange={setSearchQuery}
            resultCount={filteredProviders.length}
            totalCount={providers.length}
          />

          {hasSearchQuery && filteredProviders.length === 0 ? (
            <YStack
              gap="$2"
              padding="$5"
              borderRadius={radius.card}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surfaceMuted}
              alignItems="center"
            >
              <Icons.Search size={28} color={ui.textMuted} />
              <Text fontSize={14} fontWeight="600" color={ui.textSecondary} textAlign="center">
                {PAYMENT_UI_COPY.noSearchResults}
              </Text>
            </YStack>
          ) : Platform.OS === 'web' ? (
            <YStack
              width="100%"
              style={{
                display: 'grid',
                gridTemplateColumns: isDesktop
                  ? 'repeat(2, minmax(280px, 1fr))'
                  : 'minmax(0, 1fr)',
                gap: 12,
                width: '100%',
              }}
            >
              {filteredProviders.map((provider) => (
                <YStack key={provider.id} width="100%" minWidth={0}>
                  <PaymentProviderCard
                    ui={ui}
                    provider={provider}
                    accounts={accounts}
                    connectedProviders={connectedProviders}
                    onPress={openProvider}
                  />
                </YStack>
              ))}
            </YStack>
          ) : (
            <XStack gap="$3" flexWrap="wrap" width="100%" alignItems="flex-start">
              {filteredProviders.map((provider) => (
                <XStack
                  key={provider.id}
                  flexBasis={isDesktop ? '47%' : '100%'}
                  flexGrow={isDesktop ? 1 : 0}
                  flexShrink={0}
                  minWidth={isDesktop ? 280 : undefined}
                  width={isDesktop ? undefined : '100%'}
                  alignSelf="stretch"
                >
                  <PaymentProviderCard
                    ui={ui}
                    provider={provider}
                    accounts={accounts}
                    connectedProviders={connectedProviders}
                    onPress={openProvider}
                  />
                </XStack>
              ))}
            </XStack>
          )}
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
