import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { radius } from '~/config/tokens'
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
  VendorEmptyState,
  VendorFilterDropdown,
  VendorPager,
  VendorPanelCard,
  VendorPanelHeader,
  VendorQuickChip,
  VendorStatStrip,
  VendorTableHeaderCell,
  VendorTableHeaderRow,
  type VendorStat,
} from '~/commerce/components/vendor/VendorPanelParts'
import {
  fulfillmentActionMetadata,
  getVendorFulfillmentActions,
  type VendorFulfillmentAction,
} from '~/commerce/components/vendor/vendor-fulfillment-actions'
import { VendorFulfillmentDetailDrawer } from '~/commerce/screens/vendor/VendorFulfillmentDetailDrawer'

const PAGE_SIZE = 10

type StatusFilter = FulfillmentStatus | 'all'
type PriorityFilter = number | 'all'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  ...Object.values(FULFILLMENT_STATUS).map((status) => ({
    value: status,
    label: fulfillmentStatusLabel(status),
  })),
]

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Any Priority' },
  ...FULFILLMENT_PRIORITY_OPTIONS.map((option) => ({
    value: String(option.value),
    label: option.label,
  })),
]

/** Statuses a vendor jumps between most often, surfaced as one-tap chips. */
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

/**
 * The vendor's pick-pack-ship queue: every shipment for this shop's items with
 * the next logistics step one tap away, plus the carrier scan history.
 */
export function VendorFulfillmentsPanel({
  ui,
  isDesktop,
  shopId,
  shopName,
  tabs,
}: VendorFulfillmentsPanelProps) {
  const toast = useAppToast()
  const dispatch = useAppDispatch()

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

  useEffect(() => {
    loadPage()
  }, [loadPage])

  useEffect(() => {
    if (error) {
      toast.show('Could not load fulfilments', { tone: 'danger', message: error })
      dispatch(clearFulfillmentError())
    }
  }, [error, toast, dispatch])

  // Exceptions and overdue shipments float to the top of the queue.
  const ordered = useMemo(() => sortFulfillmentsByUrgency(fulfillments), [fulfillments])
  const summary = useMemo(() => summarizeFulfillmentQueue(fulfillments), [fulfillments])

  const stats: VendorStat[] = [
    { key: 'toPack', label: 'To pick & pack', value: summary.toPack, icon: Icons.Package, alert: true },
    { key: 'ready', label: 'Ready to ship', value: summary.readyToShip, icon: Icons.PackageCheck },
    { key: 'transit', label: 'In transit', value: summary.inTransit, icon: Icons.Truck },
    {
      key: 'exceptions',
      label: 'Exceptions',
      value: summary.exceptions,
      icon: Icons.AlertTriangle,
      alert: true,
    },
    { key: 'overdue', label: 'Overdue', value: summary.overdue, icon: Icons.Clock, alert: true },
  ]

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const fulfillment of fulfillments) {
      const status = fulfillment.fulfillment_status
      if (status) counts[status] = (counts[status] ?? 0) + 1
    }
    return counts
  }, [fulfillments])

  /**
   * The list row is the source of truth for the fields the table shows, while
   * the detail fetch adds the event timeline — prefer whichever we have.
   */
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

  return (
    <>
      <VendorPanelHeader
        ui={ui}
        isDesktop={isDesktop}
        shopName={shopName}
        title="Fulfilments"
        count={pagination.total}
        subtitle="Pick, pack, and ship. Every step you record here updates the customer's tracking page."
        onRefresh={loadPage}
        refreshing={loading.list}
      />

      {tabs}

      {fulfillments.length > 0 ? <VendorStatStrip ui={ui} stats={stats} /> : null}

      <VendorPanelCard ui={ui}>
        <XStack gap="$3" flexWrap="wrap" alignItems="center">
          <VendorFilterDropdown
            ui={ui}
            icon={<Icons.SlidersHorizontal size={15} color={ui.textSecondary} />}
            label={STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? 'All Statuses'}
            options={STATUS_OPTIONS}
            value={String(statusFilter)}
            onChange={(v) => handleStatus(v as StatusFilter)}
          />
          <VendorFilterDropdown
            ui={ui}
            icon={<Icons.Flag size={15} color={ui.textSecondary} />}
            label={
              PRIORITY_OPTIONS.find((o) => o.value === String(priorityFilter))?.label ?? 'Any Priority'
            }
            options={PRIORITY_OPTIONS}
            value={String(priorityFilter)}
            onChange={(v) => {
              setPriorityFilter(v === 'all' ? 'all' : Number(v))
              setPage(1)
            }}
          />
        </XStack>

        <XStack gap="$2" flexWrap="wrap">
          <VendorQuickChip
            ui={ui}
            label="All"
            active={statusFilter === 'all'}
            onPress={() => handleStatus('all')}
          />
          {QUICK_STATUS_CHIPS.map((status) => (
            <VendorQuickChip
              key={status}
              ui={ui}
              label={fulfillmentStatusLabel(status)}
              count={statusCounts[status]}
              active={statusFilter === status}
              onPress={() => handleStatus(status)}
            />
          ))}
        </XStack>
      </VendorPanelCard>

      {loading.list && fulfillments.length === 0 ? (
        <YStack alignItems="center" justifyContent="center" paddingVertical={64}>
          <Spinner size="large" />
        </YStack>
      ) : ordered.length === 0 ? (
        <VendorEmptyState
          ui={ui}
          icon={Icons.Truck}
          title={hasFilters ? 'No matching fulfilments' : 'Nothing to ship yet'}
          description={
            hasFilters
              ? 'Try clearing the filters to see the rest of your queue.'
              : 'Start a fulfilment from an order to track picking, packing, and delivery here.'
          }
        />
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

      {ordered.length > 0 ? (
        <VendorPager
          ui={ui}
          page={pagination.page}
          limit={pagination.limit}
          total={pagination.total}
          totalPages={pagination.total_pages}
          unitLabel="fulfilments"
          loading={loading.list}
          onPageChange={setPage}
        />
      ) : null}

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

/**
 * Steps safe to fire straight from a row: anything needing a tracking number or
 * a written reason only appears in the drawer, where there is somewhere to type.
 */
function inlineActions(fulfillment: EnrichedFulfillment): VendorFulfillmentAction[] {
  return getVendorFulfillmentActions(fulfillment).filter((action) => action.prompt === 'none')
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
    <VendorPanelCard ui={ui} padded={false}>
      <VendorTableHeaderRow ui={ui}>
        <VendorTableHeaderCell flex={2.6} label="Shipment" />
        <VendorTableHeaderCell flex={1.6} label="Carrier / Tracking" />
        <VendorTableHeaderCell flex={0.9} label="Priority" />
        <VendorTableHeaderCell flex={1.3} label="Status" />
        <VendorTableHeaderCell flex={1.1} label="Promised" />
        <VendorTableHeaderCell flex={1.9} label="Next step" align="flex-end" />
      </VendorTableHeaderRow>

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
    </VendorPanelCard>
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

  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3.5"
      gap="$3"
      alignItems="center"
      borderBottomWidth={isLast ? 0 : 1}
      borderBottomColor={ui.borderSubtle}
      borderLeftWidth={exception || overdue ? 3 : 0}
      borderLeftColor={exception ? ui.danger : ui.brand}
      hoverStyle={{ backgroundColor: ui.surfaceMuted }}
      animation="quick"
    >
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

      <YStack flex={1.6} minWidth={0} gap={1}>
        <Text fontSize={12.5} fontWeight="700" color={ui.text} numberOfLines={1}>
          {fulfillment.carrier_name ?? fulfillment.carrier_code ?? 'No carrier'}
        </Text>
        <Text fontSize={11.5} color={ui.textMuted} numberOfLines={1}>
          {fulfillment.tracking_number ?? 'No tracking yet'}
        </Text>
      </YStack>

      <XStack flex={0.9} minWidth={0}>
        <FulfillmentPriorityBadge level={fulfillment.priority_level} />
      </XStack>

      <XStack flex={1.3} minWidth={0}>
        <FulfillmentStatusBadge status={fulfillment.fulfillment_status} size="sm" />
      </XStack>

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
            Open
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
  const display = getFulfillmentStatusDisplay(fulfillment.fulfillment_status)

  return (
    <VendorPanelCard ui={ui}>
      <XStack alignItems="flex-start" justifyContent="space-between" gap="$2">
        <YStack flex={1} minWidth={0} gap={2} cursor="pointer" onPress={() => onOpen(fulfillment)}>
          <Text fontSize={12} fontWeight="800" color={ui.brand}>
            #{item?.orders?.order_number ?? fulfillment.fulfillment_number ?? '—'}
          </Text>
          <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={2}>
            {item?.product_title ?? 'Product'}
          </Text>
          <Text fontSize={11.5} color={ui.textMuted} numberOfLines={1}>
            {display.description}
          </Text>
        </YStack>
        <YStack gap="$1.5" alignItems="flex-end">
          <FulfillmentStatusBadge status={fulfillment.fulfillment_status} size="sm" />
          <FulfillmentPriorityBadge level={fulfillment.priority_level} />
        </YStack>
      </XStack>

      {overdue ? (
        <XStack
          gap="$1.5"
          padding="$2.5"
          borderRadius={radius.chip}
          backgroundColor={toneStyle('red').bg}
          alignItems="center"
        >
          <Icons.Clock size={13} color={toneStyle('red').fg} />
          <Text fontSize={11.5} fontWeight="700" color={toneStyle('red').fg}>
            Past the promised date — update this shipment
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
          Open
        </Button>
      </XStack>
    </VendorPanelCard>
  )
}
