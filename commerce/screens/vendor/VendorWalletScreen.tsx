import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'one'

import {
  Button,
  Icons,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { formatOrderAmount, formatOrderDate } from '~/lib/orders/order.utils'
import { useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'
import {
  EASYSHIP_SELLER_RECHARGE_PATH,
  fetchEasyshipShippingCredit,
  type EasyshipShippingCreditStatus,
} from '~/lib/vendor-shipping/easyship-shipping-credit'
import { VENDOR_SHIPPING_UI_COPY } from '~/lib/vendor-shipping/vendor-shipping-ui.copy'

export function VendorWalletScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const { isDesktop, safeBottom } = useAppLayout()
  const toast = useAppToast()
  const shop = useAppSelector((s) => s.shop.currentShop)
  const isLoadingMyShops = useAppSelector((s) => s.shop.isLoadingMyShops)
  const myShopsLoaded = useAppSelector((s) => s.shop.myShopsLoaded)

  const shopId = shop?.id ?? null

  const [refreshing, setRefreshing] = useState(false)
  const [status, setStatus] = useState<EasyshipShippingCreditStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!shopId) {
      setStatus(null)
      return
    }
    setLoading(true)
    try {
      const next = await fetchEasyshipShippingCredit(shopId)
      setStatus(next)
      if (!next) {
        toast.show('Could not load shipping credit', {
          tone: 'danger',
          message: 'Try refreshing in a moment.',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [shopId, toast])

  useEffect(() => {
    void load()
  }, [load])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await load()
      toast.show('Shipping credit refreshed', { tone: 'success' })
    } finally {
      setRefreshing(false)
    }
  }

  if (!shop && (isLoadingMyShops || !myShopsLoaded)) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" minHeight={360}>
        <Spinner size="large" />
      </YStack>
    )
  }

  if (!shop) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$3">
        <Icons.Store size={28} color={ui.textMuted} />
        <Text fontSize={16} fontWeight="700" color={ui.text}>
          {VENDOR_SHIPPING_UI_COPY.noShopTitle}
        </Text>
        <Text fontSize={13} color={ui.textSecondary} textAlign="center">
          {VENDOR_SHIPPING_UI_COPY.noShopBody}
        </Text>
      </YStack>
    )
  }

  const lowBalance = Boolean(status?.lowBalance)
  const balance = status?.balance
  const currency = status?.currency ?? 'INR'
  const ledger = status?.ledger ?? []

  return (
    <YStack
      width="100%"
      maxWidth="100%"
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={(isDesktop ? 32 : 24) + safeBottom}
    >
      <YStack gap="$1">
        <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
          Shipping credit
        </Text>
        <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
          0% commission — you fund this wallet. Every shipping label, return, and RTO charge is
          auto-debited here. Top up before processing orders.
        </Text>
      </YStack>

      {lowBalance ? (
        <YStack
          gap="$2"
          padding="$4"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.danger}
          backgroundColor={ui.roseSurface}
        >
          <Text fontSize={14} fontWeight="700" color={ui.text}>
            Shipping credit is low
          </Text>
          <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
            Add funds before processing more shipping labels. Contact support or finance to top up
            if self-serve recharge is not enabled yet.
          </Text>
          <Button tone="primary" onPress={() => router.push(EASYSHIP_SELLER_RECHARGE_PATH as never)}>
            View credit details
          </Button>
        </YStack>
      ) : null}

      <YStack
        gap="$4"
        padding="$5"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        style={getShadowStyle('sm')}
      >
        <XStack justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
          <YStack gap="$1">
            <Text fontSize={12} color={ui.textMuted}>
              Available credit
            </Text>
            <Text fontSize={28} fontWeight="800" color={ui.text}>
              {loading && !status
                ? '…'
                : status
                  ? `${currency} ${Number(balance ?? 0).toFixed(2)}`
                  : '—'}
            </Text>
            {status?.updatedAt ? (
              <Text fontSize={12} color={ui.textMuted}>
                Updated {formatOrderDate(status.updatedAt, true)}
              </Text>
            ) : null}
          </YStack>
          <Button
            tone="outline"
            disabled={refreshing || loading}
            icon={<Icons.RefreshCw size={15} />}
            onPress={() => void handleRefresh()}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </XStack>

        <YStack
          gap="$1"
          padding="$4"
          borderRadius={14}
          backgroundColor={lowBalance ? ui.roseSurface : ui.surfaceMuted}
          borderWidth={1}
          borderColor={lowBalance ? ui.danger : ui.borderSubtle}
        >
          <Text fontSize={12} color={ui.textMuted}>
            Projected pending freight
          </Text>
          <Text fontSize={20} fontWeight="800" color={ui.text}>
            {loading ? '…' : formatOrderAmount(status?.pendingCost ?? 0, currency)}
          </Text>
          <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
            Open order freight you should keep funded in this wallet
            {status && status.pendingOrderCount > 0
              ? ` · ${status.pendingOrderCount} open order${status.pendingOrderCount === 1 ? '' : 's'}`
              : ''}
          </Text>
        </YStack>
      </YStack>

      <YStack
        gap="$3"
        padding="$5"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        style={getShadowStyle('sm')}
      >
        <Text fontSize={14} fontWeight="800" color={ui.text}>
          Recent credit activity
        </Text>
        {loading && !ledger.length ? (
          <Spinner />
        ) : ledger.length === 0 ? (
          <Text fontSize={13} color={ui.textMuted}>
            No credits or label debits yet.
          </Text>
        ) : (
          ledger.map((row) => (
            <XStack
              key={row.id}
              justifyContent="space-between"
              gap="$3"
              paddingVertical="$2"
              borderBottomWidth={1}
              borderBottomColor={ui.borderSubtle}
            >
              <YStack flex={1} minWidth={0} gap={2}>
                <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
                  {row.entry_type === 'debit_label'
                    ? row.easyship_shipment_id
                      ? `Label ${row.easyship_shipment_id}`
                      : 'Label debit'
                    : row.entry_type === 'credit_from_order'
                      ? 'Order shipping credit'
                      : row.entry_type === 'topup'
                        ? 'Top-up'
                        : row.entry_type}
                </Text>
                <Text fontSize={11} color={ui.textMuted}>
                  {formatOrderDate(row.created_at, true)}
                </Text>
              </YStack>
              <Text
                fontSize={13}
                fontWeight="800"
                color={row.entry_type === 'debit_label' ? ui.danger : ui.text}
              >
                {row.entry_type === 'debit_label' ? '−' : '+'}
                {formatOrderAmount(row.amount, row.currency || currency)}
              </Text>
            </XStack>
          ))
        )}
      </YStack>
    </YStack>
  )
}
