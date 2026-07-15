import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import {
  Avatar,
  Button,
  Icons,
  Input,
  Popover,
  PopoverContent,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useProfile } from '~/hooks/useProfile'
import { createTracking, selectDeliveryLoading } from '~/lib/orders/delivery.store'
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
import { commerceRoutes } from '~/lib/routes'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import { useAppUi } from '~/lib/theme/useAppUi'

import { OrderStatusBadge } from '~/commerce/components/vendor/OrderStatusBadge'
import { getVendorOrderActions, type VendorOrderAction } from '~/commerce/components/vendor/vendor-order-actions'
import { VendorAddTrackingDrawer, type TrackingFormValues } from './VendorAddTrackingDrawer'
import { ActionButton, VendorOrderDetailDrawer } from './VendorOrderDetailDrawer'

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 350

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

export function VendorOrdersScreen() {
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()
  const toast = useAppToast()
  const dispatch = useAppDispatch()
  const { profile } = useProfile()

  const shop = useAppSelector((s) => s.shop.currentShop)
  const isLoadingShops = useAppSelector((s) => s.shop.isLoadingShops)
  const listOrders = useAppSelector(selectVendorOrders)
  const listPagination = useAppSelector(selectVendorPagination)
  const loading = useAppSelector(selectVendorOrdersLoading)
  const error = useAppSelector(selectVendorOrdersError)
  const searchResults = useAppSelector((s) => s.vendorOrders.searchResults)
  const searchPagination = useAppSelector((s) => s.vendorOrders.searchPagination)
  const currentItem = useAppSelector(selectCurrentVendorOrderItem)
  const payments = useAppSelector(selectOrderPayments)
  const deliveryLoading = useAppSelector(selectDeliveryLoading)

  const shopId = shop?.id ?? null
  const role = profile?.role ?? null

  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [page, setPage] = useState(1)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [trackingItem, setTrackingItem] = useState<VendorOrderItem | null>(null)

  const isSearchMode = searchTerm.trim().length > 0
  const orders = isSearchMode ? searchResults : listOrders
  const pagination = isSearchMode ? searchPagination : listPagination
  const listLoading = isSearchMode ? loading.searching : loading.orders

  // Debounce the raw search box into the applied search term.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchTerm(searchInput)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchInput])

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
    void dispatch(loadVendorOrderItem({ orderItemId: item.id }))
    if (item.order_id) void dispatch(getOrderPayments({ orderId: item.order_id }))
  }

  const closeDetail = () => setSelectedItemId(null)

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
    const address =
      trackingItem.billing_address ?? trackingItem.orders?.billing_address ?? {}
    try {
      await dispatch(
        createTracking({
          input: {
            order_id: trackingItem.order_id,
            order_item_id: trackingItem.id,
            tracking_number: values.tracking_number,
            courier_slug: values.courier_slug,
            delivery_mode: values.delivery_mode,
            shipping_date: values.shipping_date,
            estimated_delivery_date: values.estimated_delivery_date,
            note: values.note,
            custom_tracking_url: values.custom_tracking_url,
            delivery_address: address as unknown as Json,
            notify_customer: values.notify_customer,
          },
        }),
      ).unwrap()
      toast.show('Shipment added', {
        tone: 'success',
        message: 'Tracking saved — the order is now marked as shipped.',
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

  if (!shop && isLoadingShops) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" minHeight={360}>
        <Spinner size="large" />
      </YStack>
    )
  }

  if (!shop) {
    return <NoShopState ui={ui} />
  }

  const total = pagination.total
  const rangeStart = total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1
  const rangeEnd = Math.min(pagination.page * pagination.limit, total)

  return (
    <>
      <YStack
        width="100%"
        maxWidth="100%"
        gap="$4"
        paddingHorizontal={isDesktop ? '$6' : '$4'}
        paddingTop={isDesktop ? '$6' : '$4'}
        paddingBottom={(isDesktop ? 32 : 24) + safeBottom}
      >
        {/* Header */}
        <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
          <YStack gap="$1" minWidth={0}>
            <XStack alignItems="center" gap="$1.5">
              <Icons.ShoppingBag size={14} color={ui.textMuted} />
              <Text fontSize={12} fontWeight="600" color={ui.textMuted} letterSpacing={0.2}>
                Vendor Console
              </Text>
              <Icons.ChevronRight size={13} color={ui.textMuted} />
              <Text fontSize={12} fontWeight="700" color={ui.brand} numberOfLines={1}>
                {shop.shop_name}
              </Text>
            </XStack>
            <XStack alignItems="center" gap="$2">
              <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
                Orders
              </Text>
              <Text fontSize={isDesktop ? 20 : 17} fontWeight="700" color={ui.textMuted}>
                ({total})
              </Text>
            </XStack>
          </YStack>

          <Button
            tone="outline"
            size="$3"
            borderRadius={999}
            icon={<Icons.RefreshCw size={15} />}
            disabled={listLoading}
            onPress={loadPage}
          >
            Refresh
          </Button>
        </XStack>

        {/* Toolbar */}
        <YStack
          gap="$3"
          padding="$4"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          style={getShadowStyle('sm')}
        >
          <XStack gap="$3" flexWrap="wrap" alignItems="center">
            <XStack
              flex={1}
              minWidth={220}
              alignItems="center"
              gap="$2"
              paddingHorizontal="$3"
              borderRadius={999}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surfaceMuted}
            >
              <Icons.Search size={16} color={ui.textMuted} />
              <Input
                flex={1}
                borderWidth={0}
                backgroundColor="transparent"
                paddingHorizontal={0}
                height="$4"
                placeholder="Search order number or customer…"
                value={searchInput}
                onChangeText={setSearchInput}
              />
              {searchInput ? (
                <YStack cursor="pointer" onPress={() => setSearchInput('')} pressStyle={{ opacity: 0.6 }}>
                  <Icons.X size={15} color={ui.textMuted} />
                </YStack>
              ) : null}
            </XStack>

            <FilterDropdown
              ui={ui}
              icon={<Icons.SlidersHorizontal size={15} color={ui.textSecondary} />}
              label={STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label ?? 'All Statuses'}
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(v) => handleSelectStatus(v as StatusFilter)}
            />

            <FilterDropdown
              ui={ui}
              icon={<Icons.Calendar size={15} color={ui.textSecondary} />}
              label={DATE_PRESET_OPTIONS.find((o) => o.value === datePreset)?.label ?? 'All Time'}
              options={DATE_PRESET_OPTIONS}
              value={datePreset}
              onChange={(v) => handleSelectPreset(v as DatePreset)}
            />
          </XStack>

          {/* Quick chips */}
          <XStack gap="$2" flexWrap="wrap">
            <QuickChip
              ui={ui}
              label="All"
              active={statusFilter === 'all'}
              onPress={() => handleSelectStatus('all')}
            />
            {QUICK_STATUS_CHIPS.map((status) => (
              <QuickChip
                key={status}
                ui={ui}
                label={ORDER_STATUS_DISPLAY[status].label}
                count={statusCounts[status]}
                active={statusFilter === status}
                onPress={() => handleSelectStatus(status)}
              />
            ))}
          </XStack>
        </YStack>

        {/* List */}
        {listLoading && orders.length === 0 ? (
          <YStack alignItems="center" justifyContent="center" paddingVertical={64}>
            <Spinner size="large" />
          </YStack>
        ) : orders.length === 0 ? (
          <EmptyState ui={ui} hasFilters={statusFilter !== 'all' || datePreset !== 'all' || isSearchMode} />
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

        {/* Pagination */}
        {orders.length > 0 ? (
          <XStack alignItems="center" justifyContent="space-between" flexWrap="wrap" gap="$3" paddingTop="$1">
            <Text fontSize={12.5} color={ui.textMuted} fontWeight="600">
              Showing {rangeStart} to {rangeEnd} of {total} orders
            </Text>
            <XStack alignItems="center" gap="$2">
              <PagerButton
                ui={ui}
                icon={Icons.ChevronLeft}
                disabled={pagination.page <= 1 || listLoading}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              />
              <XStack
                minWidth={34}
                height={34}
                paddingHorizontal="$2"
                borderRadius={999}
                backgroundColor={ui.brand}
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={13} fontWeight="800" color={ui.onBrand}>
                  {pagination.page}
                </Text>
              </XStack>
              <PagerButton
                ui={ui}
                icon={Icons.ChevronRight}
                disabled={pagination.page >= pagination.total_pages || listLoading}
                onPress={() => setPage((p) => p + 1)}
              />
            </XStack>
          </XStack>
        ) : null}
      </YStack>

      <VendorOrderDetailDrawer
        ui={ui}
        open={selectedItemId !== null}
        isDesktop={isDesktop}
        item={drawerItem}
        loading={loading.item}
        updating={loading.updatingStatus}
        payments={payments}
        role={role}
        onClose={closeDetail}
        onAdvance={handleAdvance}
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
    <YStack
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      overflow="hidden"
      style={getShadowStyle('sm')}
    >
      {/* Header row */}
      <XStack
        paddingHorizontal="$4"
        paddingVertical="$3"
        backgroundColor={ui.surfaceMuted}
        borderBottomWidth={1}
        borderBottomColor={ui.borderSubtle}
        gap="$3"
      >
        <HeaderCell flex={2.6} label="Order Details" />
        <HeaderCell flex={2} label="Customer" />
        <HeaderCell flex={1.3} label="Amount" />
        <HeaderCell flex={1.2} label="Status" />
        <HeaderCell flex={1.2} label="Date" />
        <HeaderCell flex={1.6} label="Actions" align="flex-end" />
      </XStack>

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
    </YStack>
  )
}

function HeaderCell({ flex, label, align = 'flex-start' }: { flex: number; label: string; align?: 'flex-start' | 'flex-end' }) {
  return (
    <XStack flex={flex} justifyContent={align}>
      <Text fontSize={11} fontWeight="700" color="$color10" letterSpacing={0.3} textTransform="uppercase">
        {label}
      </Text>
    </XStack>
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
  const currency = order?.currency ?? 'INR'
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
      {/* Order details */}
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

      {/* Customer */}
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

      {/* Amount */}
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

      {/* Status */}
      <XStack flex={1.2} minWidth={0}>
        <OrderStatusBadge status={item.item_status} size="sm" />
      </XStack>

      {/* Date */}
      <YStack flex={1.2} minWidth={0}>
        <Text fontSize={12} color={ui.textSecondary} fontWeight="600">
          {formatOrderDate(item.created_at)}
        </Text>
      </YStack>

      {/* Actions */}
      <XStack flex={1.6} minWidth={0} justifyContent="flex-end" gap="$1.5" flexWrap="wrap">
        {actions.length > 0 ? (
          actions.map((action) => (
            <ActionButton
              key={action.key}
              ui={ui}
              action={action}
              disabled={updating}
              onPress={() => onAdvance(item, action.target)}
            />
          ))
        ) : (
          <Button
            tone="ghost"
            size="$2"
            borderRadius={999}
            onPress={() => onOpen(item)}
          >
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
  const currency = order?.currency ?? 'INR'
  const customer = order?.profiles
  const actions = getVendorOrderActions(item.item_status, role)

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
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
          <ActionButton
            key={action.key}
            ui={ui}
            action={action}
            disabled={updating}
            flex={1}
            onPress={() => onAdvance(item, action.target)}
          />
        ))}
        <Button tone="outline" size="$3" borderRadius={999} flex={actions.length > 0 ? undefined : 1} onPress={() => onOpen(item)}>
          Details
        </Button>
      </XStack>
    </YStack>
  )
}

// ============================================================================
// Toolbar building blocks
// ============================================================================

type FilterDropdownProps = {
  ui: AppUiTokens
  icon: React.ReactNode
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}

function FilterDropdown({ ui, icon, label, options, value, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end" allowFlip>
      <Popover.Trigger asChild>
        <XStack
          alignItems="center"
          gap="$2"
          paddingHorizontal="$3"
          height={44}
          minWidth={150}
          borderRadius={999}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surfaceMuted}
          cursor="pointer"
          hoverStyle={{ borderColor: ui.brand }}
          pressStyle={{ opacity: 0.8 }}
        >
          {icon}
          <Text flex={1} fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
            {label}
          </Text>
          <Icons.ChevronDown size={15} color={ui.textMuted} />
        </XStack>
      </Popover.Trigger>
      <PopoverContent>
        <YStack minWidth={190} gap={2}>
          {options.map((option) => {
            const selected = option.value === value
            return (
              <XStack
                key={option.value}
                alignItems="center"
                justifyContent="space-between"
                gap="$2"
                paddingHorizontal="$3"
                paddingVertical="$2.5"
                borderRadius={radius.chip}
                cursor="pointer"
                backgroundColor={selected ? ui.roseSurface : 'transparent'}
                hoverStyle={{ backgroundColor: ui.surfaceMuted }}
                onPress={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <Text fontSize={13} fontWeight={selected ? '800' : '600'} color={selected ? ui.brand : ui.text}>
                  {option.label}
                </Text>
                {selected ? <Icons.Check size={15} color={ui.brand} /> : null}
              </XStack>
            )
          })}
        </YStack>
      </PopoverContent>
    </Popover>
  )
}

function QuickChip({
  ui,
  label,
  count,
  active,
  onPress,
}: {
  ui: AppUiTokens
  label: string
  count?: number
  active: boolean
  onPress: () => void
}) {
  return (
    <XStack
      alignItems="center"
      gap="$1.5"
      paddingHorizontal="$3"
      paddingVertical="$1.5"
      borderRadius={999}
      borderWidth={1}
      borderColor={active ? ui.brand : ui.borderSubtle}
      backgroundColor={active ? ui.roseSurface : ui.surface}
      cursor="pointer"
      hoverStyle={{ borderColor: ui.brand }}
      pressStyle={{ opacity: 0.8 }}
      onPress={onPress}
    >
      <Text fontSize={12.5} fontWeight="700" color={active ? ui.brand : ui.textSecondary}>
        {label}
      </Text>
      {typeof count === 'number' && count > 0 ? (
        <Text fontSize={12} fontWeight="700" color={active ? ui.brand : ui.textMuted}>
          ({count})
        </Text>
      ) : null}
    </XStack>
  )
}

function PagerButton({
  ui,
  icon,
  disabled,
  onPress,
}: {
  ui: AppUiTokens
  icon: (typeof Icons)[keyof typeof Icons]
  disabled?: boolean
  onPress: () => void
}) {
  const Icon = icon
  return (
    <YStack
      width={34}
      height={34}
      borderRadius={999}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      alignItems="center"
      justifyContent="center"
      backgroundColor={ui.surface}
      opacity={disabled ? 0.4 : 1}
      cursor={disabled ? 'default' : 'pointer'}
      hoverStyle={disabled ? undefined : { borderColor: ui.brand }}
      pressStyle={disabled ? undefined : { opacity: 0.7 }}
      onPress={disabled ? undefined : onPress}
    >
      <Icon size={16} color={ui.textSecondary} />
    </YStack>
  )
}

// ============================================================================
// States
// ============================================================================

function EmptyState({ ui, hasFilters }: { ui: AppUiTokens; hasFilters: boolean }) {
  return (
    <YStack alignItems="center" justifyContent="center" paddingVertical={72} gap="$3">
      <YStack
        width={68}
        height={68}
        borderRadius={999}
        backgroundColor={ui.roseSurface}
        alignItems="center"
        justifyContent="center"
      >
        <Icons.ShoppingBag size={30} color={ui.brand} />
      </YStack>
      <Text fontSize={18} fontWeight="800" color={ui.text}>
        {hasFilters ? 'No matching orders' : 'No orders yet'}
      </Text>
      <Text fontSize={14} color={ui.textSecondary} textAlign="center" maxWidth={360} lineHeight={20}>
        {hasFilters
          ? 'Try adjusting your search or filters to find what you are looking for.'
          : 'When shoppers buy from your store, their orders will appear here.'}
      </Text>
    </YStack>
  )
}

function NoShopState({ ui }: { ui: AppUiTokens }) {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$3" minHeight={360}>
      <YStack
        width={68}
        height={68}
        borderRadius={999}
        backgroundColor={ui.roseSurface}
        alignItems="center"
        justifyContent="center"
      >
        <Icons.Store size={30} color={ui.brand} />
      </YStack>
      <Text fontSize={18} fontWeight="800" color={ui.text} textAlign="center">
        No shop yet
      </Text>
      <Text fontSize={14} color={ui.textSecondary} textAlign="center" maxWidth={360} lineHeight={20}>
        Create your storefront to start receiving and managing orders.
      </Text>
      <AppLink href={commerceRoutes.myShops} asChild>
        <Button tone="primary" size="$4" borderRadius={999} marginTop="$2">
          Go to My Shops
        </Button>
      </AppLink>
    </YStack>
  )
}
