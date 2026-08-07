import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  Avatar,
  Button,
  Icons,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { ScreenSearchField } from '~/components/search'
import { useProfile } from '~/hooks/useProfile'
import { useScreenSearch } from '~/hooks/useScreenSearch'
import { useVendorCurrency } from '~/hooks/useVendorCurrency'
import { createTracking, selectDeliveryLoading } from '~/lib/orders/delivery.store'
import { getIssuesByOrder } from '~/lib/orders/order-issue.service'
import type { EnrichedOrderIssue } from '~/lib/orders/order-issue.type'
import { ORDER_STATUS, ORDER_STATUS_DISPLAY, type OrderStatus } from '~/lib/orders/order.constants'
import { formatOrderAmount, formatOrderDate } from '~/lib/orders/order.utils'
import { selectOrderPayments, getOrderPayments } from '~/lib/orders/payment.store'
import type { Json } from '~/lib/supabase'
import {
  clearError,
  loadVendorOrderItem,
  loadVendorOrders,
  searchVendorOrders,
  selectCurrentVendorOrderItem,
  selectVendorOrders,
  selectVendorOrdersError,
  selectVendorOrdersLoading,
  selectVendorPagination,
  updateOrderItemStatus,
} from '~/lib/orders/vendor-orders.store'
import type { VendorOrderItem } from '~/lib/orders/vendor-orders.type'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { OrderStatusBadge } from '~/commerce/components/vendor/OrderStatusBadge'
import { VendorActionButton } from '~/commerce/components/vendor/VendorActionButton'
import {
  VendorEmptyState,
  VendorFilterDropdown,
  VendorPager,
  VendorPanelCard,
  VendorPanelHeader,
  VendorQuickChip,
  VendorTableHeaderCell,
  VendorTableHeaderRow,
} from '~/commerce/components/vendor/VendorPanelParts'
import { getVendorOrderActions, type VendorOrderAction } from '~/commerce/components/vendor/vendor-order-actions'
import { VendorAddTrackingDrawer, type TrackingFormValues } from '~/commerce/screens/vendor/VendorAddTrackingDrawer'
import { VendorOrderDetailDrawer } from '~/commerce/screens/vendor/VendorOrderDetailDrawer'

const PAGE_SIZE = 10

type StatusFilter = OrderStatus | 'all'
type DatePreset = 'all' | '7d' | '30d'

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: ORDER_STATUS.PENDING, label: ORDER_STATUS_DISPLAY[ORDER_STATUS.PENDING].label },
  { value: ORDER_STATUS.CONFIRMED, label: ORDER_STATUS_DISPLAY[ORDER_STATUS.CONFIRMED].label },
  { value: ORDER_STATUS.PROCESSING, label: ORDER_STATUS_DISPLAY[ORDER_STATUS.PROCESSING].label },
  { value: ORDER_STATUS.SHIPPED, label: ORDER_STATUS_DISPLAY[ORDER_STATUS.SHIPPED].label },
  { value: ORDER_STATUS.DELIVERED, label: ORDER_STATUS_DISPLAY[ORDER_STATUS.DELIVERED].label },
  { value: ORDER_STATUS.CANCELLED, label: ORDER_STATUS_DISPLAY[ORDER_STATUS.CANCELLED].label },
]

const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
]

const QUICK_STATUS_CHIPS: OrderStatus[] = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
]

function presetDateFrom(preset: DatePreset): string | null {
  if (preset === 'all') return null
  const days = preset === '7d' ? 7 : 30
  const from = new Date()
  from.setDate(from.getDate() - days)
  return from.toISOString()
}

type VendorOrderListPanelProps = {
  ui: AppUiTokens
  isDesktop: boolean
  shopId: string
  shopName: string | null
  /** Section tab row rendered under the header. */
  tabs?: ReactNode
}

/** Every line item sold by the shop, with status + fulfilment actions. */
export function VendorOrderListPanel({
  ui,
  isDesktop,
  shopId,
  shopName,
  tabs,
}: VendorOrderListPanelProps) {
  const toast = useAppToast()
  const dispatch = useAppDispatch()
  const { profile } = useProfile()

  const listOrders = useAppSelector(selectVendorOrders)
  const listPagination = useAppSelector(selectVendorPagination)
  const loading = useAppSelector(selectVendorOrdersLoading)
  const error = useAppSelector(selectVendorOrdersError)
  const searchResults = useAppSelector((s) => s.vendorOrders.searchResults)
  const searchPagination = useAppSelector((s) => s.vendorOrders.searchPagination)
  const currentItem = useAppSelector(selectCurrentVendorOrderItem)
  const payments = useAppSelector(selectOrderPayments)
  const deliveryLoading = useAppSelector(selectDeliveryLoading)

  const role = profile?.role ?? null

  const { input: searchInput, setInput: setSearchInput, debounced: searchTerm } = useScreenSearch()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [page, setPage] = useState(1)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [trackingItem, setTrackingItem] = useState<VendorOrderItem | null>(null)
  const [orderIssues, setOrderIssues] = useState<EnrichedOrderIssue[]>([])

  const isSearchMode = searchTerm.trim().length > 0
  const orders = isSearchMode ? searchResults : listOrders
  const pagination = isSearchMode ? searchPagination : listPagination
  const listLoading = isSearchMode ? loading.searching : loading.orders

  useEffect(() => {
    setPage(1)
  }, [searchTerm])

  const loadPage = useCallback(() => {
    if (!shopId) return
    const dateFrom = presetDateFrom(datePreset)
    const status = statusFilter === 'all' ? undefined : statusFilter
    if (isSearchMode) {
      void dispatch(
        searchVendorOrders({
          vendorId: shopId,
          params: {
            query: searchTerm.trim(),
            status,
            date_from: dateFrom ?? undefined,
            page,
            limit: PAGE_SIZE,
          },
        }),
      )
    } else {
      void dispatch(
        loadVendorOrders({
          vendorId: shopId,
          filters: { status: status ?? null, date_from: dateFrom },
          pagination: { page, limit: PAGE_SIZE },
        }),
      )
    }
  }, [dispatch, shopId, isSearchMode, searchTerm, statusFilter, datePreset, page])

  useEffect(() => {
    loadPage()
  }, [loadPage])

  useEffect(() => {
    if (error) {
      toast.show('Could not load orders', { tone: 'danger', message: error })
      dispatch(clearError())
    }
  }, [error, toast, dispatch])

  // Local counts (over the loaded page) for the quick-filter chips.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of orders) {
      const status = item.item_status
      if (status) counts[status] = (counts[status] ?? 0) + 1
    }
    return counts
  }, [orders])

  const handleSelectStatus = (value: StatusFilter) => {
    setStatusFilter(value)
    setPage(1)
  }

  const handleSelectPreset = (value: DatePreset) => {
    setDatePreset(value)
    setPage(1)
  }

  const openDetail = (item: VendorOrderItem) => {
    setSelectedItemId(item.id)
    setOrderIssues([])
    void dispatch(loadVendorOrderItem({ orderItemId: item.id }))
    if (item.order_id) {
      void dispatch(getOrderPayments({ orderId: item.order_id }))
      void getIssuesByOrder(item.order_id).then((response) => {
        if (response.success && response.data) setOrderIssues(response.data)
        else setOrderIssues([])
      })
    }
  }

  const closeDetail = () => {
    setSelectedItemId(null)
    setOrderIssues([])
  }

  const handleAdvance = async (item: VendorOrderItem, target: VendorOrderAction['target']) => {
    // Shipping requires tracking info: open the Add-Tracking drawer instead of
    // advancing straight to "shipped". The item is only marked shipped once a
    // delivery record (with a valid tracking number) is created.
    if (target === ORDER_STATUS.SHIPPED) {
      setTrackingItem(item)
      return
    }

    try {
      await dispatch(updateOrderItemStatus({ orderItemId: item.id, newStatus: target })).unwrap()
      toast.show('Order updated', {
        tone: 'success',
        message: `Marked as ${ORDER_STATUS_DISPLAY[target]?.label ?? target}.`,
      })
    } catch (err) {
      toast.show('Update failed', {
        tone: 'danger',
        message: typeof err === 'string' ? err : 'Please try again.',
      })
    }
  }

  const handleSubmitTracking = async (values: TrackingFormValues) => {
    if (!trackingItem) return
    const address = trackingItem.billing_address ?? trackingItem.orders?.billing_address ?? {}
    try {
      await dispatch(
        createTracking({
          input: {
            order_id: trackingItem.order_id,
            order_item_id: trackingItem.id,
            tracking_number: values.tracking_number,
            courier_slug: values.courier_slug,
            custom_tracking_url: values.custom_tracking_url,
            delivery_address: address as unknown as Json,
            notify_customer: values.notify_customer,
          },
        }),
      ).unwrap()
      toast.show('Shipment added', {
        tone: 'success',
        message: 'Tracking saved. Status will update automatically from the courier.',
      })
      setTrackingItem(null)
      loadPage()
      if (selectedItemId) void dispatch(loadVendorOrderItem({ orderItemId: selectedItemId }))
    } catch (err) {
      toast.show('Could not add tracking', {
        tone: 'danger',
        message: typeof err === 'string' ? err : 'Please try again.',
      })
    }
  }

  const drawerItem =
    selectedItemId && currentItem?.id === selectedItemId
      ? currentItem
      : orders.find((item) => item.id === selectedItemId) ?? null

  const hasFilters = statusFilter !== 'all' || datePreset !== 'all' || isSearchMode

  return (
    <>
      <VendorPanelHeader
        ui={ui}
        isDesktop={isDesktop}
        shopName={shopName}
        title="Orders"
        count={pagination.total}
        onRefresh={loadPage}
        refreshing={listLoading}
      />

      {tabs}

      {/* Toolbar */}
      <VendorPanelCard ui={ui}>
        <XStack gap="$3" flexWrap="wrap" alignItems="center">
          <YStack flex={1} minWidth={220}>
            <ScreenSearchField
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search order number or customer…"
            />
          </YStack>

          <VendorFilterDropdown
            ui={ui}
            icon={<Icons.SlidersHorizontal size={15} color={ui.textSecondary} />}
            label={STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label ?? 'All Statuses'}
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(v) => handleSelectStatus(v as StatusFilter)}
          />

          <VendorFilterDropdown
            ui={ui}
            icon={<Icons.Calendar size={15} color={ui.textSecondary} />}
            label={DATE_PRESET_OPTIONS.find((o) => o.value === datePreset)?.label ?? 'All Time'}
            options={DATE_PRESET_OPTIONS}
            value={datePreset}
            onChange={(v) => handleSelectPreset(v as DatePreset)}
          />
        </XStack>

        <XStack gap="$2" flexWrap="wrap">
          <VendorQuickChip
            ui={ui}
            label="All"
            active={statusFilter === 'all'}
            onPress={() => handleSelectStatus('all')}
          />
          {QUICK_STATUS_CHIPS.map((status) => (
            <VendorQuickChip
              key={status}
              ui={ui}
              label={ORDER_STATUS_DISPLAY[status].label}
              count={statusCounts[status]}
              active={statusFilter === status}
              onPress={() => handleSelectStatus(status)}
            />
          ))}
        </XStack>
      </VendorPanelCard>

      {/* List */}
      {listLoading && orders.length === 0 ? (
        <YStack alignItems="center" justifyContent="center" paddingVertical={64}>
          <Spinner size="large" />
        </YStack>
      ) : orders.length === 0 ? (
        <VendorEmptyState
          ui={ui}
          icon={Icons.ShoppingBag}
          title={hasFilters ? 'No matching orders' : 'No orders yet'}
          description={
            hasFilters
              ? 'Try adjusting your search or filters to find what you are looking for.'
              : 'When shoppers buy from your store, their orders will appear here.'
          }
        />
      ) : isDesktop ? (
        <OrdersTable
          ui={ui}
          orders={orders}
          role={role}
          updating={loading.updatingStatus}
          onOpen={openDetail}
          onAdvance={handleAdvance}
        />
      ) : (
        <YStack gap="$3">
          {orders.map((item) => (
            <OrderCard
              key={item.id}
              ui={ui}
              item={item}
              role={role}
              updating={loading.updatingStatus}
              onOpen={openDetail}
              onAdvance={handleAdvance}
            />
          ))}
        </YStack>
      )}

      {orders.length > 0 ? (
        <VendorPager
          ui={ui}
          page={pagination.page}
          limit={pagination.limit}
          total={pagination.total}
          totalPages={pagination.total_pages}
          unitLabel="orders"
          loading={listLoading}
          onPageChange={setPage}
        />
      ) : null}

      <VendorOrderDetailDrawer
        ui={ui}
        open={selectedItemId !== null}
        isDesktop={isDesktop}
        item={drawerItem}
        loading={loading.item}
        updating={loading.updatingStatus}
        payments={payments}
        issues={orderIssues}
        role={role}
        onClose={closeDetail}
        onAdvance={handleAdvance}
        onIssuesChanged={() => {
          if (drawerItem) openDetail(drawerItem)
          loadPage()
        }}
      />

      <VendorAddTrackingDrawer
        ui={ui}
        open={trackingItem !== null}
        isDesktop={isDesktop}
        item={trackingItem}
        submitting={deliveryLoading.creating}
        onClose={() => setTrackingItem(null)}
        onSubmit={handleSubmitTracking}
      />
    </>
  )
}

// ============================================================================
// Desktop table
// ============================================================================

type TableProps = {
  ui: AppUiTokens
  orders: VendorOrderItem[]
  role: string | null
  updating: boolean
  onOpen: (item: VendorOrderItem) => void
  onAdvance: (item: VendorOrderItem, target: VendorOrderAction['target']) => void
}

function OrdersTable({ ui, orders, role, updating, onOpen, onAdvance }: TableProps) {
  return (
    <VendorPanelCard ui={ui} padded={false}>
      <VendorTableHeaderRow ui={ui}>
        <VendorTableHeaderCell flex={2.6} label="Order Details" />
        <VendorTableHeaderCell flex={2} label="Customer" />
        <VendorTableHeaderCell flex={1.3} label="Amount" />
        <VendorTableHeaderCell flex={1.2} label="Status" />
        <VendorTableHeaderCell flex={1.2} label="Date" />
        <VendorTableHeaderCell flex={1.6} label="Actions" align="flex-end" />
      </VendorTableHeaderRow>

      {orders.map((item, index) => (
        <OrderRow
          key={item.id}
          ui={ui}
          item={item}
          role={role}
          updating={updating}
          isLast={index === orders.length - 1}
          onOpen={onOpen}
          onAdvance={onAdvance}
        />
      ))}
    </VendorPanelCard>
  )
}

type RowProps = {
  ui: AppUiTokens
  item: VendorOrderItem
  role: string | null
  updating: boolean
  isLast: boolean
  onOpen: (item: VendorOrderItem) => void
  onAdvance: (item: VendorOrderItem, target: VendorOrderAction['target']) => void
}

function OrderRow({ ui, item, role, updating, isLast, onOpen, onAdvance }: RowProps) {
  const order = item.orders
  const { resolveCurrency } = useVendorCurrency()
  const currency = resolveCurrency(order?.currency)
  const customer = order?.profiles
  const actions = getVendorOrderActions(item.item_status, role)
  const discount = Number(item.item_discount_amount) || 0

  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3.5"
      gap="$3"
      alignItems="center"
      borderBottomWidth={isLast ? 0 : 1}
      borderBottomColor={ui.borderSubtle}
      hoverStyle={{ backgroundColor: ui.surfaceMuted }}
      animation="quick"
    >
      <YStack flex={2.6} minWidth={0} gap={2} cursor="pointer" onPress={() => onOpen(item)}>
        <Text fontSize={12.5} fontWeight="800" color={ui.brand} numberOfLines={1}>
          #{order?.order_number ?? '—'}
        </Text>
        <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
          {item.product_title ?? item.listing?.title ?? 'Product'}
        </Text>
        <Text fontSize={11.5} color={ui.textMuted} numberOfLines={1}>
          {item.product_sku ? `SKU: ${item.product_sku} · ` : ''}Qty: {item.quantity ?? 1}
        </Text>
      </YStack>

      <XStack flex={2} minWidth={0} gap="$2" alignItems="center">
        <Avatar size="$2" name={customer?.full_name ?? 'Customer'} />
        <YStack flex={1} minWidth={0} gap={1}>
          <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
            {customer?.full_name ?? 'Customer'}
          </Text>
          <Text fontSize={11.5} color={ui.textMuted} numberOfLines={1}>
            {customer?.email ?? customer?.phone ?? '—'}
          </Text>
        </YStack>
      </XStack>

      <YStack flex={1.3} minWidth={0} gap={1}>
        <Text fontSize={13.5} fontWeight="800" color={ui.text}>
          {formatOrderAmount(item.total_price, currency)}
        </Text>
        <Text fontSize={11} color={ui.textMuted}>
          {formatOrderAmount(item.unit_price, currency)}/ea
        </Text>
        {discount > 0 ? (
          <Text fontSize={11} fontWeight="700" color={ui.success}>
            −{formatOrderAmount(discount, currency)}
          </Text>
        ) : null}
      </YStack>

      <XStack flex={1.2} minWidth={0}>
        <OrderStatusBadge status={item.item_status} size="sm" />
      </XStack>

      <YStack flex={1.2} minWidth={0}>
        <Text fontSize={12} color={ui.textSecondary} fontWeight="600">
          {formatOrderDate(item.created_at)}
        </Text>
      </YStack>

      <XStack flex={1.6} minWidth={0} justifyContent="flex-end" gap="$1.5" flexWrap="wrap">
        {actions.length > 0 ? (
          actions.map((action) => (
            <VendorActionButton
              key={action.key}
              ui={ui}
              action={action}
              disabled={updating}
              onPress={() => onAdvance(item, action.target)}
            />
          ))
        ) : (
          <Button tone="ghost" size="$2" borderRadius={999} onPress={() => onOpen(item)}>
            <Text fontSize={12} fontWeight="700" color={ui.brand}>
              View Details
            </Text>
          </Button>
        )}
      </XStack>
    </XStack>
  )
}

// ============================================================================
// Mobile card
// ============================================================================

type CardProps = {
  ui: AppUiTokens
  item: VendorOrderItem
  role: string | null
  updating: boolean
  onOpen: (item: VendorOrderItem) => void
  onAdvance: (item: VendorOrderItem, target: VendorOrderAction['target']) => void
}

function OrderCard({ ui, item, role, updating, onOpen, onAdvance }: CardProps) {
  const order = item.orders
  const { resolveCurrency } = useVendorCurrency()
  const currency = resolveCurrency(order?.currency)
  const customer = order?.profiles
  const actions = getVendorOrderActions(item.item_status, role)

  return (
    <VendorPanelCard ui={ui}>
      <XStack alignItems="flex-start" justifyContent="space-between" gap="$2">
        <YStack flex={1} minWidth={0} gap={2} cursor="pointer" onPress={() => onOpen(item)}>
          <Text fontSize={12} fontWeight="800" color={ui.brand}>
            #{order?.order_number ?? '—'}
          </Text>
          <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={2}>
            {item.product_title ?? item.listing?.title ?? 'Product'}
          </Text>
          <Text fontSize={11.5} color={ui.textMuted}>
            {item.product_sku ? `SKU: ${item.product_sku} · ` : ''}Qty: {item.quantity ?? 1}
          </Text>
        </YStack>
        <OrderStatusBadge status={item.item_status} size="sm" />
      </XStack>

      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
          <Avatar size="$2" name={customer?.full_name ?? 'Customer'} />
          <YStack flex={1} minWidth={0}>
            <Text fontSize={12.5} fontWeight="700" color={ui.text} numberOfLines={1}>
              {customer?.full_name ?? 'Customer'}
            </Text>
            <Text fontSize={11} color={ui.textMuted} numberOfLines={1}>
              {formatOrderDate(item.created_at)}
            </Text>
          </YStack>
        </XStack>
        <Text fontSize={15} fontWeight="800" color={ui.text}>
          {formatOrderAmount(item.total_price, currency)}
        </Text>
      </XStack>

      <XStack gap="$2" flexWrap="wrap">
        {actions.map((action) => (
          <VendorActionButton
            key={action.key}
            ui={ui}
            action={action}
            disabled={updating}
            flex={1}
            onPress={() => onAdvance(item, action.target)}
          />
        ))}
        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          flex={actions.length > 0 ? undefined : 1}
          onPress={() => onOpen(item)}
        >
          Details
        </Button>
      </XStack>
    </VendorPanelCard>
  )
}
