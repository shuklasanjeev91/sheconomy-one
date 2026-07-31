import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { Avatar, Button, Icons, Popover, PopoverContent, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { FULFILLMENT_STATUS, type FulfillmentStatus } from '~/lib/orders/order.constants'
import { formatOrderDate } from '~/lib/orders/order.utils'
import type { EnrichedFulfillment } from '~/lib/orders/fulfillment.type'
import {
  clearError as clearFulfillmentError,
  fetchFulfillmentDetails,
  fetchVendorFulfillments,
  selectCurrentFulfillment,
  selectFulfillmentError,
  selectFulfillmentLoading,
  selectFulfillments,
  selectFulfillmentsPagination,
  setCurrentFulfillment,
  updateFulfillmentStatus,
} from '~/lib/orders/fulfillment.store'
import {
  FULFILLMENT_PRIORITY_OPTIONS,
  fulfillmentStatusLabel,
  getFulfillmentStatusDisplay,
  isFulfillmentException,
  isOverdueFulfillment,
  outstandingQuantity,
  sortFulfillmentsByUrgency,
  summarizeFulfillmentQueue,
} from '~/lib/orders/fulfillment.utils'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import {
  FulfillmentPriorityBadge,
  FulfillmentStatusBadge,
} from '~/commerce/components/vendor/FulfillmentStatusBadge'
import { toneStyle } from '~/commerce/components/vendor/StatusPill'
import { VendorActionButton } from '~/commerce/components/vendor/VendorActionButton'
import {
  fulfillmentActionMetadata,
  getVendorFulfillmentActions,
  type VendorFulfillmentAction,
} from '~/commerce/components/vendor/vendor-fulfillment-actions'
import { VendorFulfillmentDetailDrawer } from '~/commerce/screens/vendor/VendorFulfillmentDetailDrawer'

const PAGE_SIZE = 10

type StatusFilter = FulfillmentStatus | 'all'
type PriorityFilter = number | 'all'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  ...Object.values(FULFILLMENT_STATUS).map((status) => ({
    value: status,
    label: fulfillmentStatusLabel(status),
  })),
]

const PRIORITY_OPTIONS: { value: PriorityFilter; label: string }[] = [
  { value: 'all', label: 'Any Priority' },
  ...FULFILLMENT_PRIORITY_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  })),
]

const QUICK_STATUS_CHIPS: FulfillmentStatus[] = [
  FULFILLMENT_STATUS.PENDING,
  FULFILLMENT_STATUS.PROCESSING,
  FULFILLMENT_STATUS.READY_TO_SHIP,
  FULFILLMENT_STATUS.SHIPPED,
  FULFILLMENT_STATUS.DELIVERED,
  FULFILLMENT_STATUS.EXCEPTION,
]

type VendorFulfillmentsPanelProps = {
  ui: AppUiTokens
  isDesktop: boolean
  shopId: string
  shopName: string | null
  tabs?: ReactNode
}

export function VendorFulfillmentsPanel({
  ui,
  isDesktop,
  shopId,
  shopName,
  tabs,
}: VendorFulfillmentsPanelProps) {
  const toast = useAppToast()
  const dispatch = useAppDispatch()
  const { safeBottom } = useAppLayout()

  const fulfillments = useAppSelector(selectFulfillments)
  const current = useAppSelector(selectCurrentFulfillment)
  const pagination = useAppSelector(selectFulfillmentsPagination)
  const loading = useAppSelector(selectFulfillmentLoading)
  const error = useAppSelector(selectFulfillmentError)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tracking, setTracking] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadPage = useCallback(() => {
    if (!shopId) return
    void dispatch(
      fetchVendorFulfillments({
        vendorId: shopId,
        options: {
          status: statusFilter === 'all' ? null : statusFilter,
          priority_level: priorityFilter === 'all' ? null : priorityFilter,
          page,
          limit: PAGE_SIZE,
          sort_by: 'created_at',
          sort_order: 'desc',
        },
      }),
    )
  }, [dispatch, shopId, statusFilter, priorityFilter, page])

  useEffect(() => { loadPage() }, [loadPage])

  useEffect(() => {
    if (error) {
      toast.show('Could not load fulfilments', { tone: 'danger', message: error })
      dispatch(clearFulfillmentError())
    }
  }, [error, toast, dispatch])

  const ordered = useMemo(() => sortFulfillmentsByUrgency(fulfillments), [fulfillments])
  const summary = useMemo(() => summarizeFulfillmentQueue(fulfillments), [fulfillments])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const fulfillment of fulfillments) {
      const status = fulfillment.fulfillment_status
      if (status) counts[status] = (counts[status] ?? 0) + 1
    }
    return counts
  }, [fulfillments])

  const selected = useMemo<EnrichedFulfillment | null>(() => {
    if (!selectedId) return null
    const row = ordered.find((fulfillment) => fulfillment.id === selectedId) ?? null
    if (current?.id !== selectedId) return row
    return row ? { ...row, ...current, order_items: current.order_items ?? row.order_items } : current
  }, [ordered, current, selectedId])

  const openDetail = (fulfillment: EnrichedFulfillment) => {
    setSelectedId(fulfillment.id)
    setTracking(fulfillment.tracking_number ?? '')
    setReason('')
    void dispatch(fetchFulfillmentDetails({ fulfillmentId: fulfillment.id }))
  }

  const closeDetail = () => {
    setSelectedId(null)
    setTracking('')
    setReason('')
    dispatch(setCurrentFulfillment(null))
  }

  const runAction = async (fulfillment: EnrichedFulfillment, action: VendorFulfillmentAction) => {
    setSubmitting(true)
    try {
      await dispatch(
        updateFulfillmentStatus({
          fulfillmentId: fulfillment.id,
          status: action.target,
          metadata: fulfillmentActionMetadata(action, { tracking, reason }),
        }),
      ).unwrap()

      toast.show('Fulfilment updated', {
        tone: 'success',
        message: `Moved to ${fulfillmentStatusLabel(action.target)}.`,
      })
      setReason('')
      if (selectedId === fulfillment.id) {
        void dispatch(fetchFulfillmentDetails({ fulfillmentId: fulfillment.id }))
      }
      loadPage()
    } catch (err) {
      toast.show('Could not update fulfilment', {
        tone: 'danger',
        message: typeof err === 'string' ? err : 'Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const hasFilters = statusFilter !== 'all' || priorityFilter !== 'all'

  const handleStatus = (value: StatusFilter) => {
    setStatusFilter(value)
    setPage(1)
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
                {shopName}
              </Text>
            </XStack>
            <XStack alignItems="center" gap="$2">
              <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
                Fulfilments
              </Text>
              <Text fontSize={isDesktop ? 20 : 17} fontWeight="700" color={ui.textMuted}>
                ({total})
              </Text>
            </XStack>
            <Text fontSize={13} color={ui.textSecondary} lineHeight={18} marginTop={2}>
              Pick, pack, and ship. Every step you record here updates the customer's tracking page.
            </Text>
          </YStack>

          <Button
            tone="outline"
            size="$3"
            borderRadius={999}
            icon={<Icons.RefreshCw size={15} />}
            disabled={loading.list}
            onPress={loadPage}
          >
            Refresh
          </Button>
        </XStack>

        {tabs}

        {/* Stat strip */}
        {fulfillments.length > 0 ? (
          <XStack gap="$3" flexWrap="wrap">
            {[
              { label: 'To pick & pack', value: summary.toPack, icon: Icons.Package, alert: summary.toPack > 0 },
              { label: 'Ready to ship', value: summary.readyToShip, icon: Icons.PackageCheck, alert: false },
              { label: 'In transit', value: summary.inTransit, icon: Icons.Truck, alert: false },
              { label: 'Exceptions', value: summary.exceptions, icon: Icons.AlertTriangle, alert: summary.exceptions > 0 },
              { label: 'Overdue', value: summary.overdue, icon: Icons.Clock, alert: summary.overdue > 0 },
            ].map((stat) => {
              const StatIcon = stat.icon
              return (
                <YStack
                  key={stat.label}
                  flex={1}
                  minWidth={isDesktop ? 140 : '45%'}
                  padding="$3"
                  borderRadius={radius.card}
                  borderWidth={1}
                  borderColor={stat.alert && stat.value > 0 ? ui.danger : ui.borderSubtle}
                  backgroundColor={stat.alert && stat.value > 0 ? toneStyle('red').bg : ui.surface}
                  style={getShadowStyle('sm')}
                  gap="$1"
                >
                  <StatIcon
                    size={16}
                    color={stat.alert && stat.value > 0 ? toneStyle('red').fg : ui.textMuted}
                  />
                  <Text
                    fontSize={22}
                    fontWeight="800"
                    color={stat.alert && stat.value > 0 ? toneStyle('red').fg : ui.text}
                  >
                    {stat.value}
                  </Text>
                  <Text
                    fontSize={11.5}
                    fontWeight="600"
                    color={stat.alert && stat.value > 0 ? toneStyle('red').fg : ui.textSecondary}
                    numberOfLines={2}
                  >
                    {stat.label}
                  </Text>
                </YStack>
              )
            })}
          </XStack>
        ) : null}

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
            <FulfillmentFilterDropdown
              ui={ui}
              icon={<Icons.SlidersHorizontal size={15} color={ui.textSecondary} />}
              label={STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? 'All Statuses'}
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(v) => handleStatus(v as StatusFilter)}
            />
            <FulfillmentFilterDropdown
              ui={ui}
              icon={<Icons.Flag size={15} color={ui.textSecondary} />}
              label={PRIORITY_OPTIONS.find((o) => o.value === priorityFilter)?.label ?? 'Any Priority'}
              options={PRIORITY_OPTIONS}
              value={priorityFilter}
              onChange={(v) => { setPriorityFilter(v === 'all' ? 'all' : Number(v)); setPage(1) }}
            />
          </XStack>

          {/* Quick chips */}
          <XStack gap="$2" flexWrap="wrap">
            <FulfillmentQuickChip
              ui={ui}
              label="All"
              active={statusFilter === 'all'}
              onPress={() => handleStatus('all')}
            />
            {QUICK_STATUS_CHIPS.map((status) => (
              <FulfillmentQuickChip
                key={status}
                ui={ui}
                label={fulfillmentStatusLabel(status)}
                count={statusCounts[status]}
                active={statusFilter === status}
                onPress={() => handleStatus(status)}
              />
            ))}
          </XStack>
        </YStack>

        {/* List */}
        {loading.list && fulfillments.length === 0 ? (
          <YStack alignItems="center" justifyContent="center" paddingVertical={64}>
            <Spinner size="large" />
          </YStack>
        ) : ordered.length === 0 ? (
          <FulfillmentsEmptyState ui={ui} hasFilters={hasFilters} />
        ) : isDesktop ? (
          <FulfillmentsTable
            ui={ui}
            fulfillments={ordered}
            submitting={submitting}
            onOpen={openDetail}
            onAction={runAction}
          />
        ) : (
          <YStack gap="$3">
            {ordered.map((fulfillment) => (
              <FulfillmentCard
                key={fulfillment.id}
                ui={ui}
                fulfillment={fulfillment}
                submitting={submitting}
                onOpen={openDetail}
                onAction={runAction}
              />
            ))}
          </YStack>
        )}

        {/* Pagination */}
        {ordered.length > 0 ? (
          <XStack alignItems="center" justifyContent="space-between" flexWrap="wrap" gap="$3" paddingTop="$1">
            <Text fontSize={12.5} color={ui.textMuted} fontWeight="600">
              Showing {rangeStart} to {rangeEnd} of {total} fulfilments
            </Text>
            <XStack alignItems="center" gap="$2">
              <FulfillmentPagerButton
                ui={ui}
                icon={Icons.ChevronLeft}
                disabled={pagination.page <= 1 || loading.list}
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
              <FulfillmentPagerButton
                ui={ui}
                icon={Icons.ChevronRight}
                disabled={pagination.page >= pagination.total_pages || loading.list}
                onPress={() => setPage((p) => p + 1)}
              />
            </XStack>
          </XStack>
        ) : null}
      </YStack>

      <VendorFulfillmentDetailDrawer
        ui={ui}
        open={selectedId !== null}
        isDesktop={isDesktop}
        fulfillment={selected}
        loading={loading.details && !selected}
        submitting={submitting || loading.updating}
        tracking={tracking}
        onTrackingChange={setTracking}
        reason={reason}
        onReasonChange={setReason}
        onClose={closeDetail}
        onAction={runAction}
      />
    </>
  )
}

// ============================================================================
// Desktop table
// ============================================================================

type TableProps = {
  ui: AppUiTokens
  fulfillments: EnrichedFulfillment[]
  submitting: boolean
  onOpen: (fulfillment: EnrichedFulfillment) => void
  onAction: (fulfillment: EnrichedFulfillment, action: VendorFulfillmentAction) => void
}

function FulfillmentsTable({ ui, fulfillments, submitting, onOpen, onAction }: TableProps) {
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
        <FulfillmentHeaderCell flex={2.6} label="Shipment" />
        <FulfillmentHeaderCell flex={1.6} label="Carrier / Tracking" />
        <FulfillmentHeaderCell flex={0.9} label="Priority" />
        <FulfillmentHeaderCell flex={1.3} label="Status" />
        <FulfillmentHeaderCell flex={1.1} label="Promised" />
        <FulfillmentHeaderCell flex={1.9} label="Actions" align="flex-end" />
      </XStack>

      {fulfillments.map((fulfillment, index) => (
        <FulfillmentRow
          key={fulfillment.id}
          ui={ui}
          fulfillment={fulfillment}
          submitting={submitting}
          isLast={index === fulfillments.length - 1}
          onOpen={onOpen}
          onAction={onAction}
        />
      ))}
    </YStack>
  )
}

function FulfillmentHeaderCell({
  flex,
  label,
  align = 'flex-start',
}: {
  flex: number
  label: string
  align?: 'flex-start' | 'flex-end'
}) {
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
  fulfillment: EnrichedFulfillment
  submitting: boolean
  isLast: boolean
  onOpen: (fulfillment: EnrichedFulfillment) => void
  onAction: (fulfillment: EnrichedFulfillment, action: VendorFulfillmentAction) => void
}

function FulfillmentRow({ ui, fulfillment, submitting, isLast, onOpen, onAction }: RowProps) {
  const item = fulfillment.order_items
  const actions = inlineActions(fulfillment)
  const overdue = isOverdueFulfillment(fulfillment)
  const exception = isFulfillmentException(fulfillment.fulfillment_status)
  const promised = fulfillment.estimated_ship_date ?? fulfillment.estimated_delivery_date
  const needsAction = exception || overdue

  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3.5"
      gap="$3"
      alignItems="center"
      borderBottomWidth={isLast ? 0 : 1}
      borderBottomColor={ui.borderSubtle}
      borderLeftWidth={needsAction ? 3 : 0}
      borderLeftColor={exception ? ui.danger : ui.brand}
      hoverStyle={{ backgroundColor: ui.surfaceMuted }}
      animation="quick"
    >
      {/* Shipment details */}
      <YStack flex={2.6} minWidth={0} gap={2} cursor="pointer" onPress={() => onOpen(fulfillment)}>
        <Text fontSize={12.5} fontWeight="800" color={ui.brand} numberOfLines={1}>
          #{item?.orders?.order_number ?? fulfillment.fulfillment_number ?? '—'}
        </Text>
        <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
          {item?.product_title ?? 'Product'}
        </Text>
        <Text fontSize={11.5} color={ui.textMuted} numberOfLines={1}>
          {outstandingQuantity(fulfillment)} of {fulfillment.quantity_to_fulfill ?? 0} outstanding
        </Text>
      </YStack>

      {/* Carrier / Tracking */}
      <YStack flex={1.6} minWidth={0} gap={1}>
        <Text fontSize={12.5} fontWeight="700" color={ui.text} numberOfLines={1}>
          {fulfillment.carrier_name ?? fulfillment.carrier_code ?? 'No carrier'}
        </Text>
        <Text fontSize={11.5} color={ui.textMuted} numberOfLines={1}>
          {fulfillment.tracking_number ?? 'No tracking yet'}
        </Text>
      </YStack>

      {/* Priority */}
      <XStack flex={0.9} minWidth={0}>
        <FulfillmentPriorityBadge level={fulfillment.priority_level} />
      </XStack>

      {/* Status */}
      <XStack flex={1.3} minWidth={0}>
        <FulfillmentStatusBadge status={fulfillment.fulfillment_status} size="sm" />
      </XStack>

      {/* Promised */}
      <YStack flex={1.1} minWidth={0} gap={1}>
        <Text fontSize={12} fontWeight="600" color={overdue ? ui.danger : ui.textSecondary}>
          {promised ? formatOrderDate(promised) : '—'}
        </Text>
        {overdue ? (
          <Text fontSize={10.5} fontWeight="700" color={ui.danger}>
            Overdue
          </Text>
        ) : null}
      </YStack>

      {/* Actions */}
      <XStack flex={1.9} minWidth={0} justifyContent="flex-end" gap="$1.5" flexWrap="wrap">
        {actions.map((action) => (
          <VendorActionButton
            key={action.key}
            ui={ui}
            action={action}
            disabled={submitting}
            onPress={() => onAction(fulfillment, action)}
          />
        ))}
        <Button tone="ghost" size="$2" borderRadius={999} onPress={() => onOpen(fulfillment)}>
          <Text fontSize={12} fontWeight="700" color={ui.brand}>
            Review
          </Text>
        </Button>
      </XStack>
    </XStack>
  )
}

// ============================================================================
// Mobile card
// ============================================================================

type CardProps = {
  ui: AppUiTokens
  fulfillment: EnrichedFulfillment
  submitting: boolean
  onOpen: (fulfillment: EnrichedFulfillment) => void
  onAction: (fulfillment: EnrichedFulfillment, action: VendorFulfillmentAction) => void
}

function FulfillmentCard({ ui, fulfillment, submitting, onOpen, onAction }: CardProps) {
  const item = fulfillment.order_items
  const actions = inlineActions(fulfillment)
  const overdue = isOverdueFulfillment(fulfillment)
  const exception = isFulfillmentException(fulfillment.fulfillment_status)
  const display = getFulfillmentStatusDisplay(fulfillment.fulfillment_status)

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
        <YStack flex={1} minWidth={0} gap={2} cursor="pointer" onPress={() => onOpen(fulfillment)}>
          <Text fontSize={12} fontWeight="800" color={ui.brand}>
            #{item?.orders?.order_number ?? fulfillment.fulfillment_number ?? '—'}
          </Text>
          <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={2}>
            {item?.product_title ?? 'Product'}
          </Text>
          <Text fontSize={11.5} color={ui.textMuted} numberOfLines={2}>
            {display.description}
          </Text>
        </YStack>
        <YStack gap="$1.5" alignItems="flex-end">
          <FulfillmentStatusBadge status={fulfillment.fulfillment_status} size="sm" />
          <FulfillmentPriorityBadge level={fulfillment.priority_level} />
        </YStack>
      </XStack>

      {(overdue || exception) ? (
        <XStack
          gap="$1.5"
          padding="$2.5"
          borderRadius={radius.chip}
          backgroundColor={toneStyle('red').bg}
          alignItems="center"
        >
          <Icons.Clock size={13} color={toneStyle('red').fg} />
          <Text fontSize={11.5} fontWeight="700" color={toneStyle('red').fg}>
            {exception ? 'Exception — requires attention' : 'Past the promised date — update this shipment'}
          </Text>
        </XStack>
      ) : null}

      <XStack alignItems="center" gap="$2" flexWrap="wrap">
        <Icons.Truck size={14} color={ui.textMuted} />
        <Text fontSize={12} color={ui.textSecondary}>
          {fulfillment.carrier_name ?? fulfillment.carrier_code ?? 'No carrier'}
        </Text>
        <Text fontSize={12} color={ui.textMuted}>
          {fulfillment.tracking_number ?? 'No tracking yet'}
        </Text>
      </XStack>

      <XStack gap="$2" flexWrap="wrap">
        {actions.map((action) => (
          <VendorActionButton
            key={action.key}
            ui={ui}
            action={action}
            flex={1}
            disabled={submitting}
            onPress={() => onAction(fulfillment, action)}
          />
        ))}
        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          flex={actions.length > 0 ? undefined : 1}
          onPress={() => onOpen(fulfillment)}
        >
          Review
        </Button>
      </XStack>
    </YStack>
  )
}

// ============================================================================
// Toolbar building blocks
// ============================================================================

type FulfillmentFilterDropdownProps = {
  ui: AppUiTokens
  icon: React.ReactNode
  label: string
  options: { value: string | number; label: string }[]
  value: string | number
  onChange: (value: string | number) => void
}

function FulfillmentFilterDropdown({ ui, icon, label, options, value, onChange }: FulfillmentFilterDropdownProps) {
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
                key={String(option.value)}
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

function FulfillmentQuickChip({
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

function FulfillmentPagerButton({
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

function FulfillmentsEmptyState({ ui, hasFilters }: { ui: AppUiTokens; hasFilters: boolean }) {
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
        <Icons.Truck size={30} color={ui.brand} />
      </YStack>
      <Text fontSize={18} fontWeight="800" color={ui.text}>
        {hasFilters ? 'No matching fulfilments' : 'Nothing to ship yet'}
      </Text>
      <Text fontSize={14} color={ui.textSecondary} textAlign="center" maxWidth={360} lineHeight={20}>
        {hasFilters
          ? 'Try clearing the filters to see the rest of your queue.'
          : 'Start a fulfilment from an order to track picking, packing, and delivery here.'}
      </Text>
    </YStack>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function inlineActions(fulfillment: EnrichedFulfillment): VendorFulfillmentAction[] {
  return getVendorFulfillmentActions(fulfillment).filter((action) => action.prompt === 'none')
}