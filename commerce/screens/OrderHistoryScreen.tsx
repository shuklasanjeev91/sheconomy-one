import { useCallback, useEffect, useState } from 'react'

import { CommercePageHeader, CommercePanel } from '~/commerce/components'
import {
  fetchCustomerOrderHistory,
  type CustomerOrderHistoryRow,
} from '~/commerce/lib/buyer-account'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { FullWidthLayout, HorizontalScrollRow, PageSection } from '~/components/layout'
import { radius } from '~/config/tokens'
import { formatCurrency } from '~/lib/format'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { commerceRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'
import { useAppUi } from '~/lib/theme/useAppUi'
import { Link } from 'one'

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
      normalized.includes('confirm')
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

function statusLabel(status: string | null) {
  if (!status) return 'Processing'
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
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

  async function handleCopyOrder(order: CustomerOrderHistoryRow) {
    const label = order.order_number ? `Order #${order.order_number}` : 'Order'
    const summary = [
      label,
      order.shop_names ?? 'Shop',
      statusLabel(order.order_status),
      formatOrderDate(order.created_at),
      formatCurrency(order.total_amount ?? 0, order.currency ?? 'INR'),
      order.item_count ? `${order.item_count} items` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    const copied = await copyToClipboard(summary)
    toast.show(copied ? 'Order details copied' : 'Could not copy order', {
      tone: copied ? 'success' : 'danger',
    })
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
    <FullWidthLayout scroll>
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
              <Link href={commerceRoutes.home} asChild>
                <Button tone="primary" size="$3" borderRadius={999}>
                  Start shopping
                </Button>
              </Link>
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
                    <XStack alignItems="center" gap="$3">
                      <Text fontSize={12} color={ui.textMuted}>
                        {formatOrderDate(order.created_at)}
                      </Text>
                      <XStack
                        onPress={() => void handleCopyOrder(order)}
                        cursor="pointer"
                        alignItems="center"
                        gap="$1"
                        pressStyle={{ opacity: 0.8 }}
                        hitSlop={8}
                      >
                        <Icons.Copy size={13} color={ui.brand} />
                        <Text fontSize={12} fontWeight="600" color={ui.brand}>
                          Copy
                        </Text>
                      </XStack>
                    </XStack>
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
