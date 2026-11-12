import { useCallback, useEffect, useState } from 'react'

import { adminListSellers } from '~/lib/admin/ops'
import { Button, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'
import { formatCurrency } from '~/lib/format'

type SellerRow = Awaited<ReturnType<typeof adminListSellers>>['data'] extends {
  sellers: infer S
}
  ? S extends Array<infer R>
    ? R
    : never
  : never

export default function AdminSellersOpsPage() {
  const ui = useAppUi()
  const toast = useAppToast()
  const [rows, setRows] = useState<SellerRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await adminListSellers(80)
    setLoading(false)
    if (result.error) {
      toast.show('Could not load sellers', { tone: 'danger', message: result.error })
      return
    }
    setRows(result.data?.sellers ?? [])
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <YStack gap="$4" padding="$4" width="100%">
      <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
        <YStack gap={4}>
          <Text fontSize={22} fontWeight="800" color={ui.text}>
            Sellers ops
          </Text>
          <Text fontSize={13} color={ui.textSecondary}>
            KYC, PayU child, Easyship shipping credit, open disputes
          </Text>
        </YStack>
        <Button tone="outline" size="$3" borderRadius={999} onPress={() => void load()}>
          Refresh
        </Button>
      </XStack>

      {loading ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" />
        </YStack>
      ) : (
        <YStack gap="$3" width="100%">
          {rows.map((shop) => (
            <YStack
              key={shop.id}
              padding="$4"
              gap="$2"
              borderWidth={1}
              borderColor={ui.borderSubtle}
              borderRadius={12}
              backgroundColor={ui.surface}
            >
              <XStack justifyContent="space-between" gap="$3" flexWrap="wrap">
                <Text fontWeight="800" fontSize={15} color={ui.text}>
                  {shop.shop_name ?? 'Shop'}
                </Text>
                <Text fontSize={12} color={ui.textMuted}>
                  {shop.verified ? 'Verified' : 'Unverified'}
                  {shop.payment_connected ? ' · Pay connected' : ''}
                </Text>
              </XStack>
              <Text fontSize={12} color={ui.textSecondary}>
                PayU KYC: {shop.payu_kyc?.status ?? '—'}
                {shop.payu_kyc?.payu_mid ? ` · MID ${shop.payu_kyc.payu_mid}` : ''}
              </Text>
              <Text fontSize={12} color={ui.textSecondary}>
                Easyship credit:{' '}
                {shop.easyship_shipping_credit?.balance_amount != null
                  ? formatCurrency(
                      Number(shop.easyship_shipping_credit.balance_amount),
                      shop.easyship_shipping_credit.currency ?? 'INR',
                    )
                  : '—'}
              </Text>
              <Text fontSize={12} fontWeight="700" color={ui.text}>
                Open disputes: {shop.open_dispute_count}
              </Text>
            </YStack>
          ))}
          {!rows.length ? (
            <Text color={ui.textMuted}>No shops found.</Text>
          ) : null}
        </YStack>
      )}
    </YStack>
  )
}
