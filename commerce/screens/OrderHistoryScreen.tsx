import { useCallback, useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { CommercePageHeader, CommercePanel } from '~/commerce/components'
import { OrderStatusBadge } from '~/commerce/components/vendor/OrderStatusBadge'
import {
  fetchCustomerOrderHistory,
  type CustomerOrderHistoryRow,
} from '~/commerce/lib/buyer-account'
import { resumeOrderOnlinePayment } from '~/commerce/lib/resume-order-payment'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { FullWidthLayout, HorizontalScrollRow, PageSection } from '~/components/layout'
import { formatCurrency } from '~/lib/format'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { commerceRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'
import { useAppUi } from '~/lib/theme/useAppUi'
import { getOrderStatusDisplay } from '~/lib/orders/order.utils'
import { navigateApp } from '~/lib/platform/navigate'

type OrderStatusFilter = 'all' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

const ORDER_FILTERS: Array<{ id: OrderStatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
]

function matchesStatusFilter(status: string | null, filter: OrderStatusFilter) {
  if (filter === 'all') return true
  const normalized = (status ?? 'processing').toLowerCase()
  if (filter === 'processing') {
    return (
      normalized.includes('process') ||
      normalized.includes('pending') ||
      normalized.includes('paid') ||
      normalized.includes('confirm') ||
      normalized.includes('awaiting') ||
      normalized.includes('hold')
    )
  }
  return normalized.includes(filter)
}

function formatOrderDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function OrderHistoryScreen() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useProfile()
  const [orders, setOrders] = useState<CustomerOrderHistoryRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('all')
  const visibleOrders = orders.filter((order) => matchesStatusFilter(order.order_status, statusFilter))
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)

  async function handleCopyOrder(order: CustomerOrderHistoryRow) {
    const label = order.order_number ? `Order #${order.order_number}` : 'Order'
    const summary = [
      label,
      order.shop_names ?? 'Shop',
      getOrderStatusDisplay(order.order_status).label,
      formatOrderDate(order.created_at),
      formatCurrency(order.total_amount ?? 0, order.currency ?? 'INR'),
      order.item_count ? `${order.item_count} items` : null,
      order.tracking_numbers ? `Tracking ${order.tracking_numbers}` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    const copied = await copyToClipboard(summary)
    toast.show(copied ? 'Order details copied' : 'Could not copy order', {
      tone: copied ? 'success' : 'danger',
    })
  }

  async function handlePayNow(orderId: string) {
    setPayingOrderId(orderId)
    const result = await resumeOrderOnlinePayment(orderId)
    setPayingOrderId(null)
    if (!result.ok) {
      toast.show('Could not open payment', {
        tone: 'danger',
        message: result.error,
      })
      return
    }
    navigateApp(result.href as never)
  }

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
    <FullWidthLayout scroll onRefresh={load}>
      <PageSection paddingVertical="$6">
        <YStack gap="$5" width="100%">
          <CommercePageHeader
            title="Order history"
            subtitle="Track purchases, delivery status, and payments"
          />

          <HorizontalScrollRow gap="$2">
            {ORDER_FILTERS.map((filter) => {
              const active = statusFilter === filter.id
              return (
                <XStack
                  key={filter.id}
                  paddingHorizontal={12}
                  paddingVertical={7}
                  borderRadius={999}
                  borderWidth={1}
                  borderColor={active ? ui.brand : ui.borderSubtle}
                  backgroundColor={active ? ui.surfaceMuted : ui.surface}
                  cursor="pointer"
                  onPress={() => setStatusFilter(filter.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text fontSize={12} fontWeight="700" color={active ? ui.brand : ui.textMuted}>
                    {filter.label}
                  </Text>
                </XStack>
              )
            })}
          </HorizontalScrollRow>

          {isLoading ? (
            <YStack alignItems="center" paddingVertical="$8">
              <Spinner size="large" />
            </YStack>
          ) : error ? (
            <Text color={ui.danger} fontSize={14}>
              {error}
            </Text>
          ) : orders.length === 0 ? (
            <CommercePanel padding="$6" alignItems="center" gap="$3">
              <Text fontWeight="600" fontSize={16} color={ui.text}>
                No orders yet
              </Text>
              <Text color={ui.textSecondary} fontSize={14} textAlign="center">
                When you buy from a shop, your orders will show up here.
              </Text>
              <AppLink href={commerceRoutes.home} asChild>
                <Button tone="primary" size="$3" borderRadius={999}>
                  Start shopping
                </Button>
              </AppLink>
            </CommercePanel>
          ) : visibleOrders.length === 0 ? (
            <CommercePanel padding="$6" alignItems="center" gap="$2">
              <Text fontWeight="600" fontSize={16} color={ui.text}>
                No {statusFilter} orders
              </Text>
              <Text color={ui.textSecondary} fontSize={14} textAlign="center">
                Try another status filter or refresh.
              </Text>
            </CommercePanel>
          ) : (
            <YStack gap="$3" width="100%">
              {visibleOrders.map((order) => (
                <CommercePanel key={order.order_id} padding="$4" gap="$3">
                  <XStack justifyContent="space-between" alignItems="flex-start" gap="$3">
                    <YStack flex={1} gap={4}>
                      <Text fontWeight="700" fontSize={15} color={ui.text}>
                        {order.order_number ? `Order #${order.order_number}` : 'Order'}
                      </Text>
                      <Text fontSize={13} color={ui.textSecondary} numberOfLines={2}>
                        {order.shop_names ?? 'Sheconomy shop'}
                        {order.item_count ? ` · ${order.item_count} items` : ''}
                      </Text>
                      {order.tracking_numbers ? (
                        <Text fontSize={11} color={ui.textMuted} numberOfLines={1}>
                          Tracking: {order.tracking_numbers}
                        </Text>
                      ) : null}
                    </YStack>
                    <Text fontWeight="800" fontSize={15} color={ui.text}>
                      {formatCurrency(order.total_amount ?? 0, order.currency ?? 'INR')}
                    </Text>
                  </XStack>
                  <XStack justifyContent="space-between" alignItems="center" gap="$2" flexWrap="wrap">
                    <OrderStatusBadge status={order.order_status} size="sm" />
                    <Text fontSize={12} color={ui.textMuted}>
                      {formatOrderDate(order.created_at)}
                    </Text>
                  </XStack>
                  <XStack gap="$2" flexWrap="wrap">
                    {order.order_status === 'awaiting_payment' ? (
                      <Button
                        tone="primary"
                        size="$3"
                        borderRadius={999}
                        disabled={payingOrderId === order.order_id}
                        onPress={() => void handlePayNow(order.order_id)}
                      >
                        {payingOrderId === order.order_id ? 'Opening…' : 'Pay now'}
                      </Button>
                    ) : (
                      <Button
                        tone="primary"
                        size="$3"
                        borderRadius={999}
                        onPress={() => navigateApp(commerceRoutes.order(order.order_id))}
                      >
                        View order
                      </Button>
                    )}
                    <Button
                      tone="outline"
                      size="$3"
                      borderRadius={999}
                      onPress={() => navigateApp(commerceRoutes.order(order.order_id))}
                    >
                      Details
                    </Button>
                    <Button
                      tone="outline"
                      size="$3"
                      borderRadius={999}
                      icon={<Icons.Copy size={13} />}
                      onPress={() => void handleCopyOrder(order)}
                    >
                      Copy
                    </Button>
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
