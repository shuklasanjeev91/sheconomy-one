import { useCallback, useEffect, useMemo, useState } from 'react'

import { PaymentErrorBoundary } from '~/commerce/components/PaymentErrorBoundary'
import { VendorPayuKycForm } from '~/commerce/components/vendor/payment/VendorPayuKycForm'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import type { PayuKycStatus, ShopPayuKycRow } from '~/lib/payment/payu-kyc'
import { PAYMENT_UI_COPY } from '~/lib/payment/payment-ui.copy'
import { toFriendlyPaymentError } from '~/lib/payment/payment.errors'
import {
  checkPaymentSetupStatus,
  initializePaymentSetup,
  loadPaymentAccounts,
  loadPaymentLogs,
  loadPaymentSettings,
  selectVendorPaymentError,
  selectVendorPaymentLoading,
  selectVendorPaymentLogs,
  setVendorPaymentShopId,
} from '~/lib/payment/payment.store'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { supabase } from '~/lib/supabase'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type VendorPaymentMethodsPanelProps = {
  ui: AppUiTokens
  shopId: string
  isDesktop: boolean
  safeBottom: number
}

const PAYU_STATUS_LABEL: Record<PayuKycStatus, string> = {
  draft: 'Not submitted',
  submitted: 'Under review',
  changes_requested: 'Changes requested',
  payu_pending: 'Verification in progress',
  payu_verified: 'Verified',
  rejected: 'Not approved',
}

type PayoutStatus = 'ready' | 'incomplete' | 'needed'

function resolvePayuStatus(row: ShopPayuKycRow | null): PayoutStatus {
  if (!row || row.status === 'draft') return 'needed'
  if (row.status === 'payu_verified') return 'ready'
  return 'incomplete'
}

export function VendorPaymentMethodsPanel({
  ui,
  shopId,
  isDesktop,
}: VendorPaymentMethodsPanelProps) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()

  const loading = useAppSelector(selectVendorPaymentLoading)
  const storeError = useAppSelector(selectVendorPaymentError)

  const [initializedShopId, setInitializedShopId] = useState<string | null>(null)
  const [kycRow, setKycRow] = useState<ShopPayuKycRow | null>(null)
  const [kycLoading, setKycLoading] = useState(true)
  const [showUpdateForm, setShowUpdateForm] = useState(false)

  const loadKyc = useCallback(async () => {
    setKycLoading(true)
    const { data, error } = await supabase
      .from('shop_payu_kyc')
      .select('*')
      .eq('shop_id', shopId)
      .maybeSingle()
    setKycLoading(false)
    if (error) {
      toast.show(PAYMENT_UI_COPY.loadError, {
        tone: 'danger',
        message: toFriendlyPaymentError(error),
      })
      return
    }
    setKycRow((data as ShopPayuKycRow | null) ?? null)
  }, [shopId, toast])

  const refreshPaymentState = useCallback(async () => {
    await Promise.all([
      dispatch(loadPaymentAccounts({ shopId })),
      dispatch(loadPaymentSettings({ shopId })),
      dispatch(checkPaymentSetupStatus({ shopId })),
      loadKyc(),
    ])
  }, [dispatch, loadKyc, shopId])

  useEffect(() => {
    if (!shopId) return
    dispatch(setVendorPaymentShopId(shopId))

    let active = true
    void (async () => {
      try {
        if (initializedShopId !== shopId) {
          await dispatch(initializePaymentSetup({ shopId })).unwrap()
          if (active) setInitializedShopId(shopId)
        }
        if (active) await refreshPaymentState()
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

  const status = resolvePayuStatus(kycRow)
  const isReady = status === 'ready'

  const isInitialLoading =
    (loading.accounts && loading.settings && !storeError) || (kycLoading && !kycRow && !storeError)

  if (isInitialLoading && initializedShopId !== shopId) {
    return (
      <XStack alignItems="center" gap="$2" paddingVertical="$6">
        <Spinner size="small" />
        <Text fontSize={13} color={ui.textMuted}>
          Loading payments…
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
      <YStack gap="$4" width="100%" maxWidth={560} alignSelf="flex-start">
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
                  ? PAYMENT_UI_COPY.statusReadyTitle
                  : status === 'incomplete'
                    ? PAYMENT_UI_COPY.statusIncompleteTitle
                    : PAYMENT_UI_COPY.statusNeededTitle}
              </Text>
              <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
                {isReady
                  ? PAYMENT_UI_COPY.statusReadyBody
                  : status === 'incomplete'
                    ? `${PAYMENT_UI_COPY.statusIncompleteBody}${
                        kycRow?.status
                          ? ` Current status: ${PAYU_STATUS_LABEL[kycRow.status]}.`
                          : ''
                      }`
                    : PAYMENT_UI_COPY.statusNeededBody}
              </Text>
            </YStack>
          </XStack>

          <YStack gap="$1.5" marginTop="$2">
            <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
              {PAYMENT_UI_COPY.howItWorksTitle}
            </Text>
            {PAYMENT_UI_COPY.howItWorksSteps.map((step) => (
              <Text key={step} fontSize={12} color={ui.textSecondary} lineHeight={17}>
                · {step}
              </Text>
            ))}
          </YStack>
        </YStack>

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
            <VendorPayuKycForm
              ui={ui}
              shopId={shopId}
              embedded
              onSubmitted={() => {
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
              Update payout details
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
              <SettlementsStrip ui={ui} shopId={shopId} />
            </YStack>
          </YStack>
        )}
      </YStack>
    </PaymentErrorBoundary>
  )
}

function SettlementsStrip({ ui, shopId }: { ui: AppUiTokens; shopId: string }) {
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
