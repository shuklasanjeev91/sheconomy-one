import { useCallback, useEffect, useState } from 'react'

import { CommercePageHeader, CommercePanel } from '~/commerce/components'
import {
  fetchCustomerOrderHistory,
  type CustomerOrderHistoryRow,
} from '~/commerce/lib/buyer-account'
import { Spinner, Text, XStack, YStack } from '~/components/ui'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { radius } from '~/config/tokens'
import { formatCurrency } from '~/lib/format'
import { useProfile } from '~/hooks/useProfile'
import { useAppUi } from '~/lib/theme/useAppUi'

function formatOrderDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusLabel(status: string | null) {
  if (!status) return 'Processing'
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function OrderHistoryScreen() {
  const ui = useAppUi()
  const { user } = useProfile()
  const [orders, setOrders] = useState<CustomerOrderHistoryRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) {
      setOrders([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const result = await fetchCustomerOrderHistory(user.id)
    setOrders(result.orders)
    setError(result.error)
    setIsLoading(false)
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6">
        <YStack gap="$5" width="100%">
          <CommercePageHeader
            title="Order history"
            subtitle="Track purchases, delivery status, and payments"
          />

          {isLoading ? (
            <YStack alignItems="center" paddingVertical="$8">
              <Spinner size="large" />
            </YStack>
          ) : error ? (
            <Text color={ui.danger} fontSize={14}>
              {error}
            </Text>
          ) : orders.length === 0 ? (
            <CommercePanel padding="$6" alignItems="center" gap="$2">
              <Text fontWeight="600" fontSize={16} color={ui.text}>
                No orders yet
              </Text>
              <Text color={ui.textSecondary} fontSize={14} textAlign="center">
                When you buy from a shop, your orders will show up here.
              </Text>
            </CommercePanel>
          ) : (
            <YStack gap="$3" width="100%">
              {orders.map((order) => (
                <CommercePanel key={order.order_id} padding="$4" gap="$2">
                  <XStack justifyContent="space-between" alignItems="flex-start" gap="$3">
                    <YStack flex={1} gap={4}>
                      <Text fontWeight="700" fontSize={15} color={ui.text}>
                        {order.order_number ? `Order #${order.order_number}` : 'Order'}
                      </Text>
                      <Text fontSize={13} color={ui.textSecondary} numberOfLines={2}>
                        {order.shop_names ?? 'Sheconomy shop'}
                        {order.item_count ? ` · ${order.item_count} items` : ''}
                      </Text>
                    </YStack>
                    <Text fontWeight="800" fontSize={15} color={ui.text}>
                      {formatCurrency(order.total_amount ?? 0, order.currency ?? 'INR')}
                    </Text>
                  </XStack>
                  <XStack justifyContent="space-between" alignItems="center" gap="$2" flexWrap="wrap">
                    <XStack
                      paddingHorizontal="$2.5"
                      paddingVertical="$1"
                      borderRadius={radius.pill}
                      backgroundColor={ui.chip}
                    >
                      <Text fontSize={12} fontWeight="600" color={ui.text}>
                        {statusLabel(order.order_status)}
                      </Text>
                    </XStack>
                    <Text fontSize={12} color={ui.textMuted}>
                      {formatOrderDate(order.created_at)}
                    </Text>
                  </XStack>
                </CommercePanel>
              ))}
            </YStack>
          )}
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}
