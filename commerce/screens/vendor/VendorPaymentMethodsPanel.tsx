import { useCallback, useEffect, useMemo, useState } from 'react'

import { PaymentErrorBoundary } from '~/commerce/components/PaymentErrorBoundary'
import { ShepayEasyConnect } from '~/commerce/components/vendor/payment/ShepayEasyConnect'
import { fetchShepayHeldTotal } from '~/commerce/lib/shepay-held'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { PAYMENT_UI_COPY } from '~/lib/payment/payment-ui.copy'

import { toFriendlyPaymentError } from '~/lib/payment/payment.errors'
import {
  checkPaymentSetupStatus,
  initializePaymentSetup,
  loadPaymentAccounts,
  loadPaymentLogs,
  loadPaymentSettings,
  selectConnectedProviders,
  selectVendorPaymentAccounts,
  selectVendorPaymentError,
  selectVendorPaymentLoading,
  selectVendorPaymentLogs,
  setVendorPaymentShopId,
} from '~/lib/payment/payment.store'
import { PAYMENT_ACCOUNT_STATUS, PAYMENT_PROVIDERS } from '~/lib/payment/payment.constants'
import type { ShopPaymentAccount } from '~/lib/payment/payment.type'
import { isProviderConnected } from '~/lib/payment/payment.utils'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type VendorPaymentMethodsPanelProps = {
  ui: AppUiTokens
  shopId: string
  isDesktop: boolean
  safeBottom: number
}

type ShepayStatus = 'ready' | 'incomplete' | 'needed'

function readAccountMeta(account: ShopPaymentAccount | undefined): Record<string, unknown> {
  if (!account?.metadata || typeof account.metadata !== 'object') return {}
  return account.metadata as Record<string, unknown>
}

function resolveShepayStatus(
  accounts: ShopPaymentAccount[],
  connected: boolean,
): ShepayStatus {
  if (!connected) return 'needed'
  const account = accounts.find(
    (row) =>
      String(row.provider) === PAYMENT_PROVIDERS.PAYU &&
      row.status === PAYMENT_ACCOUNT_STATUS.CONNECTED,
  )
  const meta = readAccountMeta(account)
  const childKey =
    (typeof meta.child_merchant_key === 'string' && meta.child_merchant_key.trim()) ||
    (meta.onboarded_via === 'sheconomy' && typeof meta.merchant_key === 'string'
      ? meta.merchant_key.trim()
      : '')
  const childMid = typeof meta.child_mid === 'string' && meta.child_mid.trim()
  if (childKey && childMid) return 'ready'
  return 'incomplete'
}

export function VendorPaymentMethodsPanel({
  ui,
  shopId,
  isDesktop,
}: VendorPaymentMethodsPanelProps) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()

  const accounts = useAppSelector(selectVendorPaymentAccounts)
  const connectedProviders = useAppSelector(selectConnectedProviders)
  const loading = useAppSelector(selectVendorPaymentLoading)
  const storeError = useAppSelector(selectVendorPaymentError)

  const [initializedShopId, setInitializedShopId] = useState<string | null>(null)
  const [heldTotal, setHeldTotal] = useState(0)
  const [showUpdateForm, setShowUpdateForm] = useState(false)

  const refreshPaymentState = useCallback(async () => {
    await Promise.all([
      dispatch(loadPaymentAccounts({ shopId })),
      dispatch(loadPaymentSettings({ shopId })),
      dispatch(checkPaymentSetupStatus({ shopId })),
    ])
    const held = await fetchShepayHeldTotal(shopId)
    setHeldTotal(held)
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

  const connected = isProviderConnected(PAYMENT_PROVIDERS.PAYU, accounts, connectedProviders)
  const status = resolveShepayStatus(accounts, connected)

  const isInitialLoading =
    loading.accounts && loading.settings && accounts.length === 0 && !storeError

  if (isInitialLoading) {
    return (
      <XStack alignItems="center" gap="$2" paddingVertical="$6">
        <Spinner size="small" />
        <Text fontSize={13} color={ui.textMuted}>
          Loading payments…
        </Text>
      </XStack>
    )
  }

  const isReady = status === 'ready'

  return (
    <PaymentErrorBoundary
      scope="VendorPaymentMethods"
      title="Payment settings unavailable"
      onReset={() => void refreshPaymentState()}
    >
      <YStack gap="$4" width="100%" maxWidth={560} alignSelf="flex-start">
        {/* Status */}
        <YStack
          gap="$2"
          padding={isDesktop ? '$5' : '$4'}
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={isReady ? '#86EFAC' : status === 'incomplete' ? '#FCD34D' : ui.borderSubtle}
          backgroundColor={isReady ? '#F0FDF4' : status === 'incomplete' ? '#FFFBEB' : ui.surface}
          style={getShadowStyle('sm')}
        >
          <XStack alignItems="center" gap="$3">
            {isReady ? (
              <Icons.CheckCircle2 size={28} color="#16A34A" />
            ) : (
              <Icons.Wallet size={28} color={ui.brand} />
            )}
            <YStack flex={1} gap="$0.5" minWidth={0}>
              <Text fontSize={18} fontWeight="800" color={ui.text} letterSpacing={-0.3}>
                {isReady
                  ? 'You’re all set to get paid'
                  : status === 'incomplete'
                    ? 'Almost done'
                    : 'Get paid for your orders'}
              </Text>
              <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
                {isReady
                  ? 'Money from online orders goes to your PayU account after each sale.'
                  : 'Add your PayU merchant key and MID below. Buyers can already shop — payouts wait safely until you’re connected.'}
              </Text>
            </YStack>
          </XStack>

          {heldTotal > 0 ? (
            <YStack
              gap="$1"
              marginTop="$2"
              padding="$3"
              borderRadius={radius.card}
              backgroundColor={isReady ? '#FFFBEB' : ui.roseSurface}
            >
              <Text fontSize={12} fontWeight="700" color={ui.text}>
                Waiting for you
              </Text>
              <Text fontSize={22} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
                ₹
                {heldTotal.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Text fontSize={12} color={ui.textMuted} lineHeight={17}>
                {isReady
                  ? 'We’re sending this to your PayU account now.'
                  : 'This transfers automatically once you save your PayU details.'}
              </Text>
            </YStack>
          ) : null}
        </YStack>

        {/* Connect / update — inline, no drawer */}
        {!isReady || showUpdateForm ? (
          <YStack
            gap="$3"
            padding={isDesktop ? '$5' : '$4'}
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
            style={getShadowStyle('sm')}
          >
            <ShepayEasyConnect
              ui={ui}
              shopId={shopId}
              connected={isReady}
              embedded
              onConnected={() => {
                setShowUpdateForm(false)
                void refreshPaymentState()
              }}
            />
          </YStack>
        ) : (
          <YStack gap="$3">
            <Button
              size="$4"
              tone="outline"
              borderRadius={radius.chip}
              borderColor={ui.brand}
              color={ui.brand}
              fontWeight="700"
              onPress={() => setShowUpdateForm(true)}
            >
              Update PayU details
            </Button>

            <YStack
              gap="$3"
              padding={isDesktop ? '$5' : '$4'}
              borderRadius={radius.card}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
            >
              <Text fontSize={15} fontWeight="700" color={ui.text}>
                {PAYMENT_UI_COPY.settlementsTitle}
              </Text>
              <ShepaySettlementsStrip ui={ui} shopId={shopId} />
            </YStack>
          </YStack>
        )}
      </YStack>
    </PaymentErrorBoundary>
  )
}

function ShepaySettlementsStrip({ ui, shopId }: { ui: AppUiTokens; shopId: string }) {
  const dispatch = useAppDispatch()
  const logs = useAppSelector(selectVendorPaymentLogs)
  const loading = useAppSelector(selectVendorPaymentLoading)

  useEffect(() => {
    if (!shopId) return
    void dispatch(loadPaymentLogs({ shopId }))
  }, [dispatch, shopId])

  const settlements = useMemo(
    () =>
      (logs ?? [])
        .filter((log) => String(log.event_type ?? '').toLowerCase() === 'settlement')
        .slice(0, 5),
    [logs],
  )

  if (loading.logs && settlements.length === 0) {
    return (
      <XStack alignItems="center" gap="$2">
        <Spinner size="small" />
        <Text fontSize={12} color={ui.textMuted}>
          Loading…
        </Text>
      </XStack>
    )
  }

  if (!settlements.length) {
    return (
      <Text fontSize={13} color={ui.textMuted}>
        No payouts yet. They’ll show up here after a buyer pays.
      </Text>
    )
  }

  return (
    <YStack gap="$2">
      {settlements.map((log) => (
        <XStack
          key={String(log.id)}
          justifyContent="space-between"
          gap="$2"
          alignItems="center"
          paddingVertical="$2"
          borderBottomWidth={1}
          borderBottomColor={ui.borderSubtle}
        >
          <Text fontSize={13} color={ui.text} flex={1} numberOfLines={1}>
            {String(log.transaction_id ?? 'Payout')}
          </Text>
          <Text
            fontSize={12}
            fontWeight="700"
            color={String(log.status) === 'completed' ? ui.success : ui.danger}
          >
            {String(log.status ?? 'unknown')}
          </Text>
        </XStack>
      ))}
    </YStack>
  )
}
