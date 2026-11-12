import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Href } from 'one'

import { PaymentErrorBoundary } from '~/commerce/components/PaymentErrorBoundary'
import { AppLink } from '~/components/navigation/AppLink'
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
import { vendorRoutes } from '~/lib/routes'
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
          Loading payouts…
        </Text>
      </XStack>
    )
  }

  return (
    <PaymentErrorBoundary
      scope="VendorPaymentMethods"
      title="Payout settings unavailable"
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
              <Icons.Banknote size={28} color={ui.brand} />
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
                    : 'Complete Verification first. Upload KYC documents; after admin approval PayU creates your payout account.'}
              </Text>
            </YStack>
          </XStack>

          {!isReady ? (
            <AppLink href={vendorRoutes.settingsSection('verification') as Href} asChild>
              <Button size="$3" tone="primary" borderRadius={999} alignSelf="flex-start" marginTop="$2">
                Go to Verification
              </Button>
            </AppLink>
          ) : null}
        </YStack>

        {isReady ? (
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
            <AppLink href={vendorRoutes.settingsSection('verification') as Href} asChild>
              <Button size="$3" tone="outline" borderRadius={999} alignSelf="flex-start">
                View verification details
              </Button>
            </AppLink>
          </YStack>
        ) : null}
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
