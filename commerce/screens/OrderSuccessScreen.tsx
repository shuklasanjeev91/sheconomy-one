import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'

import { CommercePageHeader, CommercePanel } from '~/commerce/components'
import { OrderStatusBadge } from '~/commerce/components/vendor/OrderStatusBadge'
import {
  clearPendingOrderSuccess,
  fetchCustomerOrdersByIds,
  loadPendingOrderSuccess,
  type CustomerOrderSummary,
} from '~/commerce/lib/customer-orders'
import { formatEstimatedDelivery } from '~/commerce/lib/customer-order-lifecycle'
import { Button, Icons, ScreenState, Text, XStack, YStack } from '~/components/ui'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { formatCurrency } from '~/lib/format'
import { formatOrderDate } from '~/lib/orders/order.utils'
import { commerceRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'
import { useAppUi } from '~/lib/theme/useAppUi'

function parseIdsFromSearch(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('ids') ?? ''
    return raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

export function OrderSuccessScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const { user } = useProfile()
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [awaitingPayment, setAwaitingPayment] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    let ids = parseIdsFromSearch()
    const pending = await loadPendingOrderSuccess()
    if (!ids.length && pending?.orderIds?.length) {
      ids = pending.orderIds
    }
    if (pending?.awaitingExternalPayment) setAwaitingPayment(true)

    if (!ids.length) {
      setOrders([])
      setError(null)
      setIsLoading(false)
      return
    }

    const result = await fetchCustomerOrdersByIds(ids, user.id)
    setOrders(result.orders)
    setError(result.error)
    setIsLoading(false)

    if (result.orders.length > 0) {
      await clearPendingOrderSuccess()
    }
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  const headline = useMemo(() => {
    if (awaitingPayment && orders.some((o) => o.payment_status !== 'completed')) {
      return 'Order placed — finish payment if needed'
    }
    return orders.length > 1 ? 'Your packages are confirmed' : 'Order confirmed'
  }, [awaitingPayment, orders])

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6">
        <YStack gap="$5" width="100%">
          <CommercePageHeader
            title={headline}
            subtitle="Save your order numbers. You can track every package from Your orders."
          />

          <ScreenState
            loading={isLoading}
            error={error}
            empty={!isLoading && !error && orders.length === 0}
            emptyTitle="No recent order found"
            emptyMessage="If you just paid in another tab, open Your orders — or place a new order from the cart."
            emptyActionLabel="View your orders"
            onEmptyAction={() => router.replace(commerceRoutes.orders)}
            onRetry={() => void load()}
          >
            <YStack gap="$3" width="100%">
              {orders.map((order) => {
                const eta = formatEstimatedDelivery(order.estimated_delivery_date)
                const paymentLine = [order.payment_mode, order.payment_status]
                  .filter(Boolean)
                  .join(' · ')

                return (
                  <CommercePanel key={order.id} padding="$4" gap="$3">
                    <XStack justifyContent="space-between" alignItems="flex-start" gap="$3">
                      <YStack flex={1} gap={4}>
                        <Text fontWeight="800" fontSize={16} color={ui.text}>
                          Order #{order.order_number}
                        </Text>
                        <Text fontSize={13} color={ui.textSecondary}>
                          {order.shop_name ?? 'Shop'}
                          {order.item_count ? ` · ${order.item_count} items` : ''}
                        </Text>
                        <Text fontSize={12} color={ui.textMuted}>
                          Placed {formatOrderDate(order.created_at, true)}
                        </Text>
                      </YStack>
                      <YStack alignItems="flex-end" gap="$2">
                        <OrderStatusBadge status={order.order_status} size="sm" />
                        <Text fontWeight="800" fontSize={15} color={ui.text}>
                          {formatCurrency(order.total_amount, order.currency)}
                        </Text>
                      </YStack>
                    </XStack>

                    {paymentLine || eta ? (
                      <YStack gap={2}>
                        {paymentLine ? (
                          <Text fontSize={12} color={ui.textSecondary} textTransform="capitalize">
                            Payment: {paymentLine}
                          </Text>
                        ) : null}
                        {eta ? (
                          <Text fontSize={12} color={ui.textSecondary}>
                            Estimated delivery: {eta}
                          </Text>
                        ) : null}
                      </YStack>
                    ) : null}

                    <XStack gap="$2" flexWrap="wrap">
                      <AppLink href={commerceRoutes.order(order.id)} asChild>
                        <Button tone="primary" size="$3" borderRadius={999}>
                          View order
                        </Button>
                      </AppLink>
                      <AppLink href={commerceRoutes.order(order.id)} asChild>
                        <Button
                          tone="outline"
                          size="$3"
                          borderRadius={999}
                          icon={<Icons.Truck size={14} />}
                        >
                          Track package
                        </Button>
                      </AppLink>
                    </XStack>
                  </CommercePanel>
                )
              })}
            </YStack>
          </ScreenState>

          <XStack gap="$2" flexWrap="wrap">
            <AppLink href={commerceRoutes.orders} asChild>
              <Button tone="outline" size="$3" borderRadius={999}>
                All orders
              </Button>
            </AppLink>
            <AppLink href={commerceRoutes.home} asChild>
              <Button tone="primary" size="$3" borderRadius={999}>
                Continue shopping
              </Button>
            </AppLink>
          </XStack>
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}
