import { useCallback, useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import {
  CommercePageHeader,
  CommercePanel,
  MarketplaceEmptyState,
  MarketplacePage,
  MarketplacePrimaryButton,
} from '~/commerce/components'
import { OrderStatusBadge } from '~/commerce/components/vendor/OrderStatusBadge'
import {
  fetchCustomerOrderHistory,
  type CustomerOrderHistoryRow,
} from '~/commerce/lib/buyer-account'
import {
  buyerGroupOverallStatusLabel,
  fetchBuyerCheckoutGroupList,
  type BuyerCheckoutGroupListRow,
  type BuyerGroupOverallStatus,
} from '~/commerce/lib/buyer-checkout-groups'
import { resumeOrderOnlinePayment } from '~/commerce/lib/resume-order-payment'
import { cancelCustomerOrder } from '~/commerce/lib/customer-orders'
import { getCustomerOrderActionEligibility } from '~/commerce/lib/customer-order-lifecycle'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { FullWidthLayout, HorizontalScrollRow, LAYOUT_STRETCH, PageSection } from '~/components/layout'
import { formatCurrency } from '~/lib/format'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { commerceRoutes } from '~/lib/routes'
import { useAppLayout } from '~/hooks/useAppLayout'
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
      normalized.includes('hold') ||
      normalized === 'partially_refunded'
    )
  }
  if (filter === 'delivered') {
    return normalized.includes('delivered') || normalized === 'partially_delivered'
  }
  return normalized.includes(filter)
}

function cancelEligibility(order: CustomerOrderHistoryRow) {
  return getCustomerOrderActionEligibility({
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
  })
}

function formatOrderDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function OrderHistoryScreen() {
  const ui = useAppUi()
  const { hasSideRails } = useAppLayout()
  const toast = useAppToast()
  const { user } = useProfile()
  const [groups, setGroups] = useState<BuyerCheckoutGroupListRow[]>([])
  const [orphanOrders, setOrphanOrders] = useState<CustomerOrderHistoryRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('all')
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)

  const visibleGroups = groups.filter((g) =>
    matchesStatusFilter(g.overall_status, statusFilter),
  )
  const visibleOrphans = orphanOrders.filter((order) =>
    matchesStatusFilter(order.order_status, statusFilter),
  )
  const isEmpty = groups.length === 0 && orphanOrders.length === 0
  const visibleEmpty = visibleGroups.length === 0 && visibleOrphans.length === 0

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

  async function handleCopyGroup(group: BuyerCheckoutGroupListRow) {
    const summary = [
      `Checkout ${group.id.slice(0, 8)}`,
      group.shop_names,
      buyerGroupOverallStatusLabel(group.overall_status),
      formatOrderDate(group.created_at),
      formatCurrency(group.total_amount, group.currency || 'INR'),
      `${group.shop_count} sellers`,
    ].join(' · ')
    const copied = await copyToClipboard(summary)
    toast.show(copied ? 'Checkout details copied' : 'Could not copy', {
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

  async function handleCancelUnpaid(orderId: string) {
    setCancellingOrderId(orderId)
    const result = await cancelCustomerOrder(orderId)
    setCancellingOrderId(null)
    if (result.error) {
      toast.show('Could not cancel order', { tone: 'danger', message: result.error })
      return
    }
    toast.show('Order cancelled', {
      tone: 'success',
      message: 'Reserved stock has been released.',
    })
    await load()
  }

  const load = useCallback(async () => {
    if (!user?.id) {
      setGroups([])
      setOrphanOrders([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const [groupResult, historyResult] = await Promise.all([
      fetchBuyerCheckoutGroupList(user.id),
      fetchCustomerOrderHistory(user.id),
    ])

    const groupedOrderIds = new Set(
      groupResult.groups.flatMap((g) => g.order_ids).filter(Boolean),
    )
    const orphans = historyResult.orders.filter((o) => !groupedOrderIds.has(o.order_id))

    setGroups(groupResult.groups)
    setOrphanOrders(orphans)
    setError(groupResult.error ?? historyResult.error)
    setIsLoading(false)
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <FullWidthLayout scroll onRefresh={load}>
      <PageSection paddingVertical="$5" {...LAYOUT_STRETCH}>
        <MarketplacePage hasSideRails={hasSideRails}>
          <CommercePageHeader
            title="Purchases"
            subtitle="Track multi-seller checkouts, delivery, and payments"
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
                  backgroundColor={active ? ui.chip : ui.surface}
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
          ) : error && isEmpty ? (
            <Text color={ui.danger} fontSize={14}>
              {error}
            </Text>
          ) : isEmpty ? (
            <MarketplaceEmptyState
              hasSideRails={hasSideRails}
              icon={<Icons.Package size={48} color={ui.brand} />}
              title="No purchases yet"
              subtitle="When you buy from a shop, your orders will show up here."
              action={
                <YStack width={hasSideRails ? 280 : '100%'}>
                  <MarketplacePrimaryButton onPress={() => navigateApp(commerceRoutes.home)}>
                    Start shopping
                  </MarketplacePrimaryButton>
                </YStack>
              }
            />
          ) : visibleEmpty ? (
            <MarketplaceEmptyState
              hasSideRails={hasSideRails}
              icon={<Icons.Search size={40} color={ui.textMuted} />}
              title={`No ${statusFilter} orders`}
              subtitle="Try another status filter or refresh."
            />
          ) : (
            <YStack gap="$3" width="100%">
              {visibleGroups.map((group) => (
                <CommercePanel key={group.id} padding="$4" gap="$3">
                  <XStack justifyContent="space-between" alignItems="flex-start" gap="$3">
                    <YStack flex={1} gap={4}>
                      <Text fontWeight="700" fontSize={15} color={ui.text}>
                        {group.shop_count > 1
                          ? `Checkout · ${group.shop_count} sellers`
                          : group.shop_names || 'Checkout'}
                      </Text>
                      <Text fontSize={13} color={ui.textSecondary} numberOfLines={2}>
                        {group.shop_count > 1 ? group.shop_names : null}
                        {group.shop_count > 1 && group.item_count ? ' · ' : null}
                        {group.item_count
                          ? `${group.item_count} item${group.item_count === 1 ? '' : 's'}`
                          : group.shop_count > 1
                            ? null
                            : 'Single-seller checkout'}
                      </Text>
                      <Text fontSize={11} color={ui.textMuted}>
                        {buyerGroupOverallStatusLabel(
                          group.overall_status as BuyerGroupOverallStatus,
                        )}
                      </Text>
                    </YStack>
                    <Text fontWeight="800" fontSize={15} color={ui.text}>
                      {formatCurrency(group.total_amount, group.currency || 'INR')}
                    </Text>
                  </XStack>
                  <XStack justifyContent="space-between" alignItems="center" gap="$2" flexWrap="wrap">
                    <OrderStatusBadge status={group.overall_status} size="sm" />
                    <Text fontSize={12} color={ui.textMuted}>
                      {formatOrderDate(group.created_at)}
                    </Text>
                  </XStack>
                  <XStack gap="$2" flexWrap="wrap">
                    <AppLink href={commerceRoutes.checkoutGroup(group.id)} asChild>
                      <Button tone="primary" size="$3" borderRadius={999}>
                        Track sellers
                      </Button>
                    </AppLink>
                    {group.order_ids.length === 1 ? (
                      <AppLink href={commerceRoutes.order(group.order_ids[0])} asChild>
                        <Button tone="outline" size="$3" borderRadius={999}>
                          Order details
                        </Button>
                      </AppLink>
                    ) : null}
                    <Button
                      tone="outline"
                      size="$3"
                      borderRadius={999}
                      icon={<Icons.Copy size={13} />}
                      onPress={() => void handleCopyGroup(group)}
                    >
                      Copy
                    </Button>
                  </XStack>
                </CommercePanel>
              ))}

              {visibleOrphans.map((order) => (
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
                        disabled={
                          payingOrderId === order.order_id ||
                          cancellingOrderId === order.order_id
                        }
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
                    {cancelEligibility(order).canInstantCancel ? (
                      <Button
                        tone="outline"
                        size="$3"
                        borderRadius={999}
                        disabled={
                          payingOrderId === order.order_id ||
                          cancellingOrderId === order.order_id
                        }
                        onPress={() => void handleCancelUnpaid(order.order_id)}
                      >
                        {cancellingOrderId === order.order_id ? 'Cancelling…' : 'Cancel'}
                      </Button>
                    ) : cancelEligibility(order).canRequestCancel ? (
                      <Button
                        tone="outline"
                        size="$3"
                        borderRadius={999}
                        onPress={() => navigateApp(commerceRoutes.order(order.order_id))}
                      >
                        Request cancellation
                      </Button>
                    ) : null}
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
        </MarketplacePage>
      </PageSection>
    </FullWidthLayout>
  )
}
