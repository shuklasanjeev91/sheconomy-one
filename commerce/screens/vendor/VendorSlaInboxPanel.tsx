import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Share } from 'react-native'

import { Button, Icons, Spinner, Text, TextArea, XStack, YStack, useAppToast } from '~/components/ui'
import {
  canBulkAcknowledgeInboxRows,
  type VendorSlaFilter,
  type VendorSlaInboxRow,
  buildVendorSlaInboxData,
  filterVendorSlaRows,
  vendorSlaRowsToCsv,
} from '~/commerce/lib/vendor-sla-inbox'
import { assignReturnTracking, confirmOrderReturnReceived, resolveOrderIssueRequest } from '~/commerce/lib/customer-order-trust'
import { autoBookReturnPickup } from '~/commerce/lib/vendor-return-pickup'
import { OrderStatusBadge } from '~/commerce/components/vendor/OrderStatusBadge'
import {
  VendorEmptyState,
  VendorPanelCard,
  VendorPanelHeader,
  VendorPanelShell,
  VendorQuickChip,
  VendorStatStrip,
} from '~/commerce/components/vendor/VendorPanelParts'
import {
  getVendorIssueActions,
  type VendorIssueAction,
} from '~/commerce/components/vendor/vendor-issue-actions'
import { VendorOrderDetailDrawer } from '~/commerce/screens/vendor/VendorOrderDetailDrawer'
import { VendorAddTrackingDrawer, type TrackingFormValues } from '~/commerce/screens/vendor/VendorAddTrackingDrawer'
import { VendorOrderIssueDetailDrawer } from '~/commerce/screens/vendor/VendorOrderIssueDetailDrawer'
import { getIssuesByOrder, getVendorIssues, updateIssueStatus } from '~/lib/orders/order-issue.service'
import type { EnrichedOrderIssue } from '~/lib/orders/order-issue.type'
import { ISSUE_STATUS, ORDER_STATUS, type Json } from '~/lib/orders/order.constants'
import { createTracking } from '~/lib/orders/delivery.store'
import { getOrderPayments, selectOrderPayments } from '~/lib/orders/payment.store'
import { formatOrderDate } from '~/lib/orders/order.utils'
import { getVendorOrderItem, getVendorOrders } from '~/lib/orders/vendor-orders.service'
import type { VendorOrderItem } from '~/lib/orders/vendor-orders.type'
import { resolveVendorShippingAddress } from '~/lib/orders/vendor-orders.utils'
import { supabase } from '~/lib/supabase'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import { toneStyle } from '~/commerce/components/vendor/StatusPill'
import {
  isExchangeIssueType,
  isReturnIssueType,
} from '~/lib/orders/order-issue.utils'

type VendorSlaInboxPanelProps = {
  ui: AppUiTokens
  isDesktop: boolean
  shopId: string
  shopName: string | null
  tabs?: ReactNode
}

function severityLabel(row: VendorSlaInboxRow) {
  return row.severity.charAt(0).toUpperCase() + row.severity.slice(1)
}

function severityTone(row: VendorSlaInboxRow) {
  switch (row.severity) {
    case 'critical':
      return toneStyle('red')
    case 'high':
      return toneStyle('orange')
    case 'medium':
      return toneStyle('yellow')
    case 'low':
    default:
      return toneStyle('blue')
  }
}

async function findReplacementItemId(originalItemId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('order_items')
    .select('id')
    .eq('exchanged_from_item_id', originalItemId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data?.id) return null
  return data.id
}

export function VendorSlaInboxPanel({
  ui,
  isDesktop,
  shopId,
  shopName,
  tabs,
}: VendorSlaInboxPanelProps) {
  const toast = useAppToast()
  const dispatch = useAppDispatch()
  const payments = useAppSelector(selectOrderPayments)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [orders, setOrders] = useState<VendorOrderItem[]>([])
  const [issues, setIssues] = useState<EnrichedOrderIssue[]>([])
  const [activeFilter, setActiveFilter] = useState<VendorSlaFilter>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [batchNote, setBatchNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [rejectReasonCode, setRejectReasonCode] = useState<string | null>(null)
  const [trackingItem, setTrackingItem] = useState<VendorOrderItem | null>(null)
  const [trackingMode, setTrackingMode] = useState<'outbound' | 'return'>('outbound')
  const [trackingSubmitting, setTrackingSubmitting] = useState(false)
  const [detailItem, setDetailItem] = useState<VendorOrderItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailIssues, setDetailIssues] = useState<EnrichedOrderIssue[]>([])
  const [detailUpdating, setDetailUpdating] = useState(false)

  const load = useCallback(async () => {
    if (!shopId) return
    setRefreshing(true)
    try {
      const [ordersResult, issuesResult] = await Promise.all([
        getVendorOrders(shopId, {}, { page: 1, limit: 100, order_by: 'created_at', order_direction: 'desc' }),
        getVendorIssues(shopId, { page: 1, limit: 100, sort_by: 'created_at', sort_order: 'desc' }),
      ])
      if (ordersResult.error) throw new Error(ordersResult.error)
      if (issuesResult.error) throw new Error(issuesResult.error)
      setOrders(ordersResult.data?.items ?? [])
      setIssues(issuesResult.data?.issues ?? [])
    } catch (error) {
      toast.show('Could not load SLA inbox', {
        tone: 'danger',
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [shopId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const inbox = useMemo(() => buildVendorSlaInboxData({ orders, issues }), [orders, issues])
  const filteredRows = useMemo(
    () => filterVendorSlaRows(inbox.rows, activeFilter),
    [inbox.rows, activeFilter],
  )
  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selectedIds.includes(row.id)),
    [filteredRows, selectedIds],
  )
  const selectedIssue = useMemo(
    () => issues.find((issue) => issue.id === selectedIssueId) ?? null,
    [issues, selectedIssueId],
  )
  const canAcknowledgeSelected = canBulkAcknowledgeInboxRows(selectedRows)

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => filteredRows.some((row) => row.id === id)))
  }, [filteredRows])

  async function exportRows(rows: VendorSlaInboxRow[]) {
    const csv = vendorSlaRowsToCsv(rows)
    if (!csv) {
      toast.show('No rows to export', { tone: 'info' })
      return
    }
    await Share.share({
      title: activeFilter === 'ship_now' || activeFilter === 'pickup_issues' ? 'Manifest export' : 'SLA inbox export',
      message: csv,
    })
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  async function openTrackingForItem(orderItemId: string, mode: 'outbound' | 'return') {
    const result = await getVendorOrderItem(orderItemId)
    if (result.error || !result.data) {
      toast.show('Could not open tracking', {
        tone: 'danger',
        message: result.error ?? 'Item not found.',
      })
      return
    }
    setTrackingMode(mode)
    setTrackingItem(result.data)
  }

  async function openOrderDetail(orderItemId: string) {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const result = await getVendorOrderItem(orderItemId)
      if (result.error || !result.data) throw new Error(result.error ?? 'Item not found.')
      setDetailItem(result.data)
      if (result.data.order_id) {
        void dispatch(getOrderPayments({ orderId: result.data.order_id }))
        const issueResult = await getIssuesByOrder(result.data.order_id)
        setDetailIssues(issueResult.data ?? [])
      } else {
        setDetailIssues([])
      }
    } catch (error) {
      toast.show('Could not open order', {
        tone: 'danger',
        message: error instanceof Error ? error.message : String(error),
      })
      setDetailOpen(false)
      setDetailItem(null)
    } finally {
      setDetailLoading(false)
    }
  }

  async function runIssueAction(issue: EnrichedOrderIssue, action: VendorIssueAction) {
    if (action.kind === 'assign-return-tracking') {
      if (!issue.order_item_id) {
        toast.show('Could not arrange pickup', {
          tone: 'danger',
          message: 'This request is not linked to an item.',
        })
        return
      }
      await openTrackingForItem(issue.order_item_id, 'return')
      return
    }

    if (action.kind === 'ship-replacement') {
      if (!issue.order_item_id) {
        toast.show('Could not ship replacement', {
          tone: 'danger',
          message: 'This request is not linked to an item.',
        })
        return
      }
      const replacementId = await findReplacementItemId(issue.order_item_id)
      if (!replacementId) {
        toast.show('Replacement item not found', {
          tone: 'danger',
          message: 'Confirm the return was received so a replacement line is created.',
        })
        return
      }
      await openTrackingForItem(replacementId, 'outbound')
      return
    }

    setSubmitting(true)
    try {
      if (action.kind === 'decision') {
        const needsRejectReason =
          action.decision === 'reject' &&
          (isReturnIssueType(issue.issue_type) || isExchangeIssueType(issue.issue_type))
        if (needsRejectReason && !rejectReasonCode) {
          throw new Error('Pick a decline reason before rejecting this request.')
        }
        const result = await resolveOrderIssueRequest({
          issueId: issue.id,
          decision: action.decision,
          resolutionNote: note,
          rejectReasonCode: action.decision === 'reject' ? rejectReasonCode : null,
        })
        if (result.error) throw new Error(result.error)

        const isReturnOrExchange =
          isReturnIssueType(issue.issue_type) || isExchangeIssueType(issue.issue_type)
        if (action.decision === 'accept' && isReturnOrExchange && issue.order_item_id) {
          const pickup = await autoBookReturnPickup(issue.order_item_id)
          toast.show('Request approved', {
            tone: 'success',
            message:
              pickup.status === 'booked'
                ? `Reverse pickup booked automatically — AWB ${pickup.awb}.`
                : 'Approved. Auto-pickup was unavailable, so arrange the return pickup manually.',
          })
        } else {
          toast.show(action.decision === 'accept' ? 'Request approved' : 'Request declined', {
            tone: 'success',
          })
        }
      } else if (action.kind === 'return-received') {
        if (!issue.order_item_id) throw new Error('This request is not linked to an item.')
        const result = await confirmOrderReturnReceived({ orderItemId: issue.order_item_id, note })
        if (result.error) throw new Error(result.error)
        toast.show(
          result.data?.replacementItemId
            ? 'Exchange received — replacement ready to ship'
            : 'Return received — refund started',
          { tone: 'success' },
        )
      } else {
        const result = await updateIssueStatus(issue.id, action.target, {
          resolution_note: note.trim() || undefined,
          resolution_action: action.target === ISSUE_STATUS.RESOLVED ? 'vendor_resolved' : undefined,
        })
        if (result.error) throw new Error(result.error)
        toast.show('Request updated', { tone: 'success' })
      }

      setNote('')
      setRejectReasonCode(null)
      await load()
    } catch (error) {
      toast.show('Could not update request', {
        tone: 'danger',
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleTrackingSubmit(values: TrackingFormValues) {
    if (!trackingItem) return
    setTrackingSubmitting(true)
    try {
      if (trackingMode === 'return') {
        const result = await assignReturnTracking({
          orderItemId: trackingItem.id,
          trackingNumber: values.tracking_number,
          courierSlug: values.courier_slug,
          customTrackingUrl: values.custom_tracking_url,
        })
        if (result.error) throw new Error(result.error)
        toast.show('Return pickup assigned', { tone: 'success' })
      } else {
        const address = resolveVendorShippingAddress(trackingItem) ?? {}
        await dispatch(
          createTracking({
            input: {
              order_id: trackingItem.order_id,
              order_item_id: trackingItem.id,
              tracking_number: values.tracking_number,
              courier_slug: values.courier_slug,
              custom_tracking_url: values.custom_tracking_url,
              delivery_address: address as Json,
              notify_customer: values.notify_customer,
            },
          }),
        ).unwrap()
        toast.show('Tracking saved', { tone: 'success' })
      }
      setTrackingItem(null)
      await load()
    } catch (error) {
      toast.show('Could not save tracking', {
        tone: 'danger',
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setTrackingSubmitting(false)
    }
  }

  async function acknowledgeSelected() {
    if (!canAcknowledgeSelected) return
    setSubmitting(true)
    try {
      for (const row of selectedRows) {
        if (!row.issueId) continue
        const result = await updateIssueStatus(row.issueId, ISSUE_STATUS.IN_PROGRESS, {
          resolution_note: batchNote.trim() || 'Acknowledged from the SLA inbox.',
        })
        if (result.error) throw new Error(result.error)
      }
      toast.show('Requests acknowledged', {
        tone: 'success',
        message: `${selectedRows.length} request${selectedRows.length === 1 ? '' : 's'} moved to In Progress.`,
      })
      setSelectedIds([])
      setBatchNote('')
      await load()
    } catch (error) {
      toast.show('Could not acknowledge selected rows', {
        tone: 'danger',
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAdvance(item: VendorOrderItem, target: string) {
    if (target === ORDER_STATUS.SHIPPED) {
      await openTrackingForItem(item.id, 'outbound')
      return
    }
    setDetailUpdating(true)
    try {
      const result = await dispatch(
        createTracking as never,
      )
      void result
    } finally {
      setDetailUpdating(false)
    }
  }

  const headerActions = (
    <XStack gap="$2" flexWrap="wrap">
      {selectedRows.length > 0 && canAcknowledgeSelected ? (
        <Button
          tone="primary"
          size="$3"
          borderRadius={999}
          disabled={submitting}
          icon={<Icons.CheckCircle size={14} />}
          onPress={() => void acknowledgeSelected()}
        >
          {submitting ? 'Updating…' : `Acknowledge (${selectedRows.length})`}
        </Button>
      ) : null}
      <Button
        tone="outline"
        size="$3"
        borderRadius={999}
        icon={<Icons.Download size={14} />}
        onPress={() => void exportRows(filteredRows)}
      >
        {activeFilter === 'ship_now' || activeFilter === 'pickup_issues' ? 'Export manifest' : 'Export CSV'}
      </Button>
    </XStack>
  )

  const statItems = [
    { key: 'critical', label: 'Critical now', value: inbox.summary.critical, icon: Icons.AlertTriangle, alert: true },
    { key: 'ship', label: 'Ship now', value: inbox.summary.shipNow, icon: Icons.Truck, alert: true },
    { key: 'returns', label: 'Return approvals', value: inbox.summary.approveReturns, icon: Icons.Undo2, alert: true },
    { key: 'pickup', label: 'Pickup blocked', value: inbox.summary.pickupIssues, icon: Icons.PackageSearch, alert: true },
  ]

  return (
    <>
      <VendorPanelShell isDesktop={isDesktop} safeBottom={0}>
        <VendorPanelHeader
          ui={ui}
          isDesktop={isDesktop}
          shopName={shopName}
          title="SLA Inbox"
          count={filteredRows.length}
          subtitle="Prioritized operations queue for shipments, returns, pickup exceptions, and high-risk issues."
          onRefresh={() => void load()}
          refreshing={refreshing}
          actions={headerActions}
        />

        {tabs}

        {inbox.rows.length > 0 ? <VendorStatStrip ui={ui} stats={statItems} /> : null}

        {canAcknowledgeSelected ? (
          <VendorPanelCard ui={ui}>
            <YStack gap="$2">
              <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
                Batch note
              </Text>
              <TextArea
                value={batchNote}
                onChangeText={setBatchNote}
                placeholder="Optional internal note for the selected acknowledgements…"
                numberOfLines={3}
              />
            </YStack>
          </VendorPanelCard>
        ) : null}

        <VendorPanelCard ui={ui}>
          <XStack gap="$2" flexWrap="wrap">
            <VendorQuickChip ui={ui} label="All" count={inbox.counts.all} active={activeFilter === 'all'} onPress={() => setActiveFilter('all')} />
            <VendorQuickChip ui={ui} label="Critical" count={inbox.counts.critical} active={activeFilter === 'critical'} onPress={() => setActiveFilter('critical')} />
            <VendorQuickChip ui={ui} label="Ship now" count={inbox.counts.ship_now} active={activeFilter === 'ship_now'} onPress={() => setActiveFilter('ship_now')} />
            <VendorQuickChip ui={ui} label="Approve returns" count={inbox.counts.approve_returns} active={activeFilter === 'approve_returns'} onPress={() => setActiveFilter('approve_returns')} />
            <VendorQuickChip ui={ui} label="Pickup issues" count={inbox.counts.pickup_issues} active={activeFilter === 'pickup_issues'} onPress={() => setActiveFilter('pickup_issues')} />
            <VendorQuickChip ui={ui} label="Exchange blocked" count={inbox.counts.exchange_blocked} active={activeFilter === 'exchange_blocked'} onPress={() => setActiveFilter('exchange_blocked')} />
          </XStack>
        </VendorPanelCard>

        {loading ? (
          <YStack minHeight={280} alignItems="center" justifyContent="center">
            <Spinner size="large" />
          </YStack>
        ) : filteredRows.length === 0 ? (
          <VendorEmptyState
            ui={ui}
            icon={Icons.Inbox}
            title="Inbox clear"
            description="No SLA rows match the current filter."
          />
        ) : (
          <YStack gap="$3">
            {filteredRows.map((row) => {
              const tone = severityTone(row)
              const selected = selectedIds.includes(row.id)
              return (
                <VendorPanelCard ui={ui} key={row.id}>
                  <YStack gap="$3">
                    <XStack justifyContent="space-between" gap="$3" alignItems="flex-start">
                      <XStack gap="$2.5" flex={1} minWidth={0}>
                        <Button
                          tone="ghost"
                          size="$2"
                          chromeless
                          icon={selected ? <Icons.CheckSquare size={18} /> : <Icons.Square size={18} />}
                          onPress={() => toggleSelected(row.id)}
                        />
                        <YStack flex={1} minWidth={0} gap="$1.5">
                          <XStack gap="$2" alignItems="center" flexWrap="wrap">
                            <Text fontSize={15} fontWeight="800" color={ui.text} numberOfLines={2}>
                              {row.title}
                            </Text>
                            <XStack
                              paddingHorizontal="$2"
                              paddingVertical="$1"
                              borderRadius={999}
                              backgroundColor={tone.bg}
                            >
                              <Text fontSize={11} fontWeight="800" color={tone.fg}>
                                {severityLabel(row)}
                              </Text>
                            </XStack>
                          </XStack>
                          <Text fontSize={13} color={ui.textSecondary}>
                            {row.description}
                          </Text>
                          <Text fontSize={12} fontWeight="700" color={row.severity === 'critical' ? ui.danger : ui.brand}>
                            {row.dueLabel}
                          </Text>
                        </YStack>
                      </XStack>
                      {row.orderItem ? <OrderStatusBadge status={row.orderItem.item_status} size="sm" /> : null}
                    </XStack>

                    <XStack gap="$3" flexWrap="wrap">
                      <Text fontSize={12} color={ui.textMuted}>
                        {row.orderNumber ? `Order #${row.orderNumber}` : 'Order unavailable'}
                      </Text>
                      {row.customerName ? (
                        <Text fontSize={12} color={ui.textMuted}>
                          {row.customerName}
                        </Text>
                      ) : null}
                      {row.issue?.created_at ? (
                        <Text fontSize={12} color={ui.textMuted}>
                          {formatOrderDate(row.issue.created_at, true)}
                        </Text>
                      ) : null}
                    </XStack>

                    <XStack gap="$1.5" flexWrap="wrap">
                      {row.tags.map((tag) => (
                        <XStack
                          key={`${row.id}-${tag}`}
                          paddingHorizontal="$2"
                          paddingVertical="$1"
                          borderRadius={999}
                          borderWidth={1}
                          borderColor={ui.borderSubtle}
                          backgroundColor={ui.surfaceMuted}
                        >
                          <Text fontSize={11} fontWeight="700" color={ui.textSecondary}>
                            {tag}
                          </Text>
                        </XStack>
                      ))}
                    </XStack>

                    <XStack gap="$2" flexWrap="wrap">
                      {row.kind === 'shipment_risk' && row.orderItemId ? (
                        <Button
                          tone="primary"
                          size="$3"
                          borderRadius={999}
                          icon={<Icons.Truck size={14} />}
                          onPress={() => void openTrackingForItem(row.orderItemId!, 'outbound')}
                        >
                          {row.nextActionLabel}
                        </Button>
                      ) : null}
                      {row.kind === 'pickup_exception' && row.orderItemId ? (
                        <Button
                          tone="primary"
                          size="$3"
                          borderRadius={999}
                          icon={<Icons.PackageSearch size={14} />}
                          onPress={() => void openTrackingForItem(row.orderItemId!, 'return')}
                        >
                          {row.nextActionLabel}
                        </Button>
                      ) : null}
                      {row.issue ? (
                        <Button
                          tone={row.kind === 'return_approval_pending' ? 'primary' : 'outline'}
                          size="$3"
                          borderRadius={999}
                          icon={<Icons.AlertTriangle size={14} />}
                          onPress={() => {
                            setSelectedIssueId(row.issueId)
                            setNote('')
                            setRejectReasonCode(null)
                          }}
                        >
                          {row.nextActionLabel}
                        </Button>
                      ) : null}
                      {row.orderItemId ? (
                        <Button
                          tone="outline"
                          size="$3"
                          borderRadius={999}
                          icon={<Icons.ExternalLink size={14} />}
                          onPress={() => void openOrderDetail(row.orderItemId!)}
                        >
                          View order
                        </Button>
                      ) : null}
                    </XStack>
                  </YStack>
                </VendorPanelCard>
              )
            })}
          </YStack>
        )}
      </VendorPanelShell>

      <VendorOrderIssueDetailDrawer
        ui={ui}
        open={selectedIssueId !== null}
        isDesktop={isDesktop}
        issue={selectedIssue}
        submitting={submitting}
        note={note}
        onNoteChange={setNote}
        rejectReasonCode={rejectReasonCode}
        onRejectReasonChange={setRejectReasonCode}
        onClose={() => {
          setSelectedIssueId(null)
          setNote('')
          setRejectReasonCode(null)
        }}
        onAction={runIssueAction}
      />

      <VendorAddTrackingDrawer
        ui={ui}
        open={trackingItem !== null}
        isDesktop={isDesktop}
        item={trackingItem}
        submitting={trackingSubmitting}
        mode={trackingMode}
        onClose={() => setTrackingItem(null)}
        onSubmit={(values) => void handleTrackingSubmit(values)}
      />

      <VendorOrderDetailDrawer
        ui={ui}
        open={detailOpen}
        isDesktop={isDesktop}
        item={detailItem}
        loading={detailLoading}
        updating={detailUpdating}
        payments={payments}
        issues={detailIssues}
        role={null}
        onClose={() => {
          setDetailOpen(false)
          setDetailItem(null)
          setDetailIssues([])
        }}
        onAdvance={(item, target) => {
          if (target === ORDER_STATUS.SHIPPED) {
            void openTrackingForItem(item.id, 'outbound')
          } else {
            toast.show('Use the inbox actions for this item', { tone: 'info' })
          }
        }}
        onIssuesChanged={() => void load()}
        onRequestTracking={(item, mode) => void openTrackingForItem(item.id, mode)}
      />
    </>
  )
}
