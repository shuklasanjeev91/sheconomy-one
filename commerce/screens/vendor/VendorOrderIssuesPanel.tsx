import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { Avatar, Button, Icons, Popover, PopoverContent, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import {
  ISSUE_PRIORITY,
  ISSUE_STATUS,
  ORDER_ISSUE_TYPE,
  type IssuePriority,
  type IssueStatus,
  type OrderIssueType,
} from '~/lib/orders/order.constants'
import { formatOrderDate } from '~/lib/orders/order.utils'
import type { EnrichedOrderIssue } from '~/lib/orders/order-issue.type'
import {
  clearError,
  fetchVendorIssues,
  selectOrderIssues,
  selectOrderIssuesError,
  selectOrderIssuesLoading,
  selectOrderIssuesPagination,
  updateIssueStatus,
} from '~/lib/orders/order-issue.store'
import {
  getIssueStatusDisplay,
  issueAgeInHours,
  issueTypeLabel,
  isOverdueIssue,
  sortIssuesByUrgency,
  summarizeIssueQueue,
} from '~/lib/orders/order-issue.utils'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import { useAppUi } from '~/lib/theme/useAppUi'
import {
  confirmOrderReturnReceived,
  resolveOrderIssueRequest,
} from '~/commerce/lib/customer-order-trust'

import { IssuePriorityBadge, IssueStatusBadge } from '~/commerce/components/vendor/IssueStatusBadge'
import { toneStyle } from '~/commerce/components/vendor/StatusPill'
import { VendorActionButton } from '~/commerce/components/vendor/VendorActionButton'
import {
  getVendorIssueActions,
  issueNeedsVendorAction,
  type VendorIssueAction,
} from '~/commerce/components/vendor/vendor-issue-actions'
import { VendorOrderIssueDetailDrawer } from '~/commerce/screens/vendor/VendorOrderIssueDetailDrawer'

const PAGE_SIZE = 10

type StatusFilter = IssueStatus | 'all'
type TypeFilter = OrderIssueType | 'all'
type PriorityFilter = IssuePriority | 'all'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  ...Object.values(ISSUE_STATUS).map((status) => ({
    value: status,
    label: getIssueStatusDisplay(status).label,
  })),
]

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  ...[
    ORDER_ISSUE_TYPE.CANCELLATION_REQUEST,
    ORDER_ISSUE_TYPE.RETURN_REQUEST,
    ORDER_ISSUE_TYPE.EXCHANGE_REQUEST,
    ORDER_ISSUE_TYPE.REFUND_REQUEST,
    ORDER_ISSUE_TYPE.DAMAGED_ITEM,
    ORDER_ISSUE_TYPE.WRONG_ITEM,
    ORDER_ISSUE_TYPE.MISSING_ITEM,
    ORDER_ISSUE_TYPE.DELIVERY_DELAY,
    ORDER_ISSUE_TYPE.PAYMENT_ISSUE,
    ORDER_ISSUE_TYPE.CUSTOMER_COMPLAINT,
    ORDER_ISSUE_TYPE.OTHER,
  ].map((type) => ({ value: type, label: issueTypeLabel(type) })),
]

const PRIORITY_OPTIONS: { value: PriorityFilter; label: string }[] = [
  { value: 'all', label: 'Any Priority' },
  { value: ISSUE_PRIORITY.CRITICAL, label: 'Critical' },
  { value: ISSUE_PRIORITY.URGENT, label: 'Urgent' },
  { value: ISSUE_PRIORITY.HIGH, label: 'High' },
  { value: ISSUE_PRIORITY.NORMAL, label: 'Normal' },
  { value: ISSUE_PRIORITY.LOW, label: 'Low' },
]

const QUICK_STATUS_CHIPS: IssueStatus[] = [
  ISSUE_STATUS.OPEN,
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.WAITING_CUSTOMER,
  ISSUE_STATUS.ESCALATED,
  ISSUE_STATUS.RESOLVED,
]

function statusMetadata(target: IssueStatus, note: string) {
  const trimmed = note.trim()
  if (!trimmed) return {}
  if (target === ISSUE_STATUS.CLOSED) return { closure_reason: trimmed }
  if (target === ISSUE_STATUS.RESOLVED) {
    return { resolution_note: trimmed, resolution_action: 'vendor_resolved' }
  }
  return { resolution_note: trimmed }
}

function formatAge(hours: number): string {
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function inlineActions(issue: EnrichedOrderIssue): VendorIssueAction[] {
  return getVendorIssueActions(issue).filter(
    (action) => action.kind !== 'status' || !action.requiresNote,
  )
}

type VendorOrderIssuesPanelProps = {
  ui: AppUiTokens
  isDesktop: boolean
  shopId: string
  shopName: string | null
  tabs?: ReactNode
}

export function VendorOrderIssuesPanel({
  ui,
  isDesktop,
  shopId,
  shopName,
  tabs,
}: VendorOrderIssuesPanelProps) {
  const toast = useAppToast()
  const dispatch = useAppDispatch()
  const { safeBottom } = useAppLayout()

  const issues = useAppSelector(selectOrderIssues)
  const pagination = useAppSelector(selectOrderIssuesPagination)
  const loading = useAppSelector(selectOrderIssuesLoading)
  const error = useAppSelector(selectOrderIssuesError)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadPage = useCallback(() => {
    if (!shopId) return
    void dispatch(
      fetchVendorIssues({
        vendorId: shopId,
        options: {
          status: statusFilter === 'all' ? null : statusFilter,
          issue_type: typeFilter === 'all' ? null : typeFilter,
          priority: priorityFilter === 'all' ? null : priorityFilter,
          page,
          limit: PAGE_SIZE,
          sort_by: 'created_at',
          sort_order: 'desc',
        },
      }),
    )
  }, [dispatch, shopId, statusFilter, typeFilter, priorityFilter, page])

  useEffect(() => { loadPage() }, [loadPage])

  useEffect(() => {
    if (error) {
      toast.show('Could not load requests', { tone: 'danger', message: error })
      dispatch(clearError())
    }
  }, [error, toast, dispatch])

  const ordered = useMemo(() => sortIssuesByUrgency(issues), [issues])
  const summary = useMemo(() => summarizeIssueQueue(issues), [issues])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const issue of issues) {
      if (issue.status) counts[issue.status] = (counts[issue.status] ?? 0) + 1
    }
    return counts
  }, [issues])

  const selectedIssue = useMemo(
    () => ordered.find((issue) => issue.id === selectedId) ?? null,
    [ordered, selectedId],
  )

  const openDetail = (issue: EnrichedOrderIssue) => {
    setSelectedId(issue.id)
    setNote('')
  }

  const closeDetail = () => {
    setSelectedId(null)
    setNote('')
  }

  const runAction = async (issue: EnrichedOrderIssue, action: VendorIssueAction) => {
    setSubmitting(true)
    try {
      if (action.kind === 'decision') {
        const result = await resolveOrderIssueRequest({
          issueId: issue.id,
          decision: action.decision,
          resolutionNote: note,
        })
        if (result.error) throw new Error(result.error)
        toast.show(action.decision === 'accept' ? 'Request approved' : 'Request declined', { tone: 'success' })
      } else if (action.kind === 'return-received') {
        if (!issue.order_item_id) throw new Error('This request is not linked to an item.')
        const result = await confirmOrderReturnReceived({ orderItemId: issue.order_item_id, note })
        if (result.error) throw new Error(result.error)
        const isExchange = Boolean(result.data?.replacementItemId)
        toast.show(
          isExchange
            ? 'Exchange received — replacement ready to ship'
            : 'Return received — refund sent to payment gateway',
          {
            tone: 'success',
            message: isExchange
              ? 'Add tracking on the new replacement line when you ship it.'
              : 'PayU will process the refund to the original payment method.',
          },
        )
      } else {
        await dispatch(
          updateIssueStatus({
            issueId: issue.id,
            status: action.target,
            metadata: statusMetadata(action.target, note),
          }),
        ).unwrap()
        toast.show('Request updated', {
          tone: 'success',
          message: `Moved to ${getIssueStatusDisplay(action.target).label}.`,
        })
      }
      setNote('')
      loadPage()
    } catch (err) {
      toast.show('Could not update request', {
        tone: 'danger',
        message: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const hasFilters = statusFilter !== 'all' || typeFilter !== 'all' || priorityFilter !== 'all'

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
                Issues & Requests
              </Text>
              <Text fontSize={isDesktop ? 20 : 17} fontWeight="700" color={ui.textMuted}>
                ({total})
              </Text>
            </XStack>
            <Text fontSize={13} color={ui.textSecondary} lineHeight={18} marginTop={2}>
              Answer cancellations and returns fast — open requests block shipping and hurt your rating.
            </Text>
          </YStack>

          <Button
            tone="outline"
            size="$3"
            borderRadius={999}
            icon={<Icons.RefreshCw size={15} />}
            disabled={loading.issues}
            onPress={loadPage}
          >
            Refresh
          </Button>
        </XStack>

        {tabs}

        {/* Stat strip */}
        {issues.length > 0 ? (
          <XStack gap="$3" flexWrap="wrap">
            {[
              { label: 'Open', value: summary.open, icon: Icons.MessageSquare, alert: false },
              { label: 'Awaiting your decision', value: summary.awaitingDecision, icon: Icons.Handshake, alert: true },
              { label: 'Overdue reply', value: summary.overdue, icon: Icons.Clock, alert: true },
              { label: 'Resolved', value: summary.resolved, icon: Icons.CheckCircle, alert: false },
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
            <IssueFilterDropdown
              ui={ui}
              icon={<Icons.SlidersHorizontal size={15} color={ui.textSecondary} />}
              label={STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? 'All Statuses'}
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(v) => handleStatus(v as StatusFilter)}
            />
            <IssueFilterDropdown
              ui={ui}
              icon={<Icons.Tag size={15} color={ui.textSecondary} />}
              label={TYPE_OPTIONS.find((o) => o.value === typeFilter)?.label ?? 'All Types'}
              options={TYPE_OPTIONS}
              value={typeFilter}
              onChange={(v) => { setTypeFilter(v as TypeFilter); setPage(1) }}
            />
            <IssueFilterDropdown
              ui={ui}
              icon={<Icons.Flag size={15} color={ui.textSecondary} />}
              label={PRIORITY_OPTIONS.find((o) => o.value === priorityFilter)?.label ?? 'Any Priority'}
              options={PRIORITY_OPTIONS}
              value={priorityFilter}
              onChange={(v) => { setPriorityFilter(v as PriorityFilter); setPage(1) }}
            />
          </XStack>

          {/* Quick chips */}
          <XStack gap="$2" flexWrap="wrap">
            <IssueQuickChip
              ui={ui}
              label="All"
              active={statusFilter === 'all'}
              onPress={() => handleStatus('all')}
            />
            {QUICK_STATUS_CHIPS.map((status) => (
              <IssueQuickChip
                key={status}
                ui={ui}
                label={getIssueStatusDisplay(status).label}
                count={statusCounts[status]}
                active={statusFilter === status}
                onPress={() => handleStatus(status)}
              />
            ))}
          </XStack>
        </YStack>

        {/* List */}
        {loading.issues && issues.length === 0 ? (
          <YStack alignItems="center" justifyContent="center" paddingVertical={64}>
            <Spinner size="large" />
          </YStack>
        ) : ordered.length === 0 ? (
          <IssuesEmptyState ui={ui} hasFilters={hasFilters} />
        ) : isDesktop ? (
          <IssuesTable
            ui={ui}
            issues={ordered}
            submitting={submitting}
            onOpen={openDetail}
            onAction={runAction}
          />
        ) : (
          <YStack gap="$3">
            {ordered.map((issue) => (
              <IssueCard
                key={issue.id}
                ui={ui}
                issue={issue}
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
              Showing {rangeStart} to {rangeEnd} of {total} requests
            </Text>
            <XStack alignItems="center" gap="$2">
              <IssuePagerButton
                ui={ui}
                icon={Icons.ChevronLeft}
                disabled={pagination.page <= 1 || loading.issues}
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
              <IssuePagerButton
                ui={ui}
                icon={Icons.ChevronRight}
                disabled={pagination.page >= pagination.total_pages || loading.issues}
                onPress={() => setPage((p) => p + 1)}
              />
            </XStack>
          </XStack>
        ) : null}
      </YStack>

      <VendorOrderIssueDetailDrawer
        ui={ui}
        open={selectedId !== null}
        isDesktop={isDesktop}
        issue={selectedIssue}
        submitting={submitting || loading.updating}
        note={note}
        onNoteChange={setNote}
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
  issues: EnrichedOrderIssue[]
  submitting: boolean
  onOpen: (issue: EnrichedOrderIssue) => void
  onAction: (issue: EnrichedOrderIssue, action: VendorIssueAction) => void
}

function IssuesTable({ ui, issues, submitting, onOpen, onAction }: TableProps) {
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
        <IssueHeaderCell flex={2.8} label="Request" />
        <IssueHeaderCell flex={1.8} label="Customer" />
        <IssueHeaderCell flex={1} label="Priority" />
        <IssueHeaderCell flex={1.3} label="Status" />
        <IssueHeaderCell flex={1.1} label="Raised" />
        <IssueHeaderCell flex={1.9} label="Actions" align="flex-end" />
      </XStack>

      {issues.map((issue, index) => (
        <IssueRow
          key={issue.id}
          ui={ui}
          issue={issue}
          submitting={submitting}
          isLast={index === issues.length - 1}
          onOpen={onOpen}
          onAction={onAction}
        />
      ))}
    </YStack>
  )
}

function IssueHeaderCell({
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
  issue: EnrichedOrderIssue
  submitting: boolean
  isLast: boolean
  onOpen: (issue: EnrichedOrderIssue) => void
  onAction: (issue: EnrichedOrderIssue, action: VendorIssueAction) => void
}

function IssueRow({ ui, issue, submitting, isLast, onOpen, onAction }: RowProps) {
  const reporter = issue.reported_by_profile
  const actions = inlineActions(issue)
  const overdue = isOverdueIssue(issue)
  const needsAction = issueNeedsVendorAction(issue)

  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3.5"
      gap="$3"
      alignItems="center"
      borderBottomWidth={isLast ? 0 : 1}
      borderBottomColor={ui.borderSubtle}
      borderLeftWidth={needsAction ? 3 : 0}
      borderLeftColor={overdue ? ui.danger : ui.brand}
      hoverStyle={{ backgroundColor: ui.surfaceMuted }}
      animation="quick"
    >
      {/* Request details */}
      <YStack flex={2.8} minWidth={0} gap={2} cursor="pointer" onPress={() => onOpen(issue)}>
        <Text fontSize={12.5} fontWeight="800" color={ui.brand} numberOfLines={1}>
          #{issue.orders?.order_number ?? '—'}
        </Text>
        <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
          {issueTypeLabel(issue.issue_type)}
        </Text>
        <Text fontSize={11.5} color={ui.textMuted} numberOfLines={1}>
          {issue.order_items?.product_title ?? issue.issue_title ?? 'Whole order'}
        </Text>
      </YStack>

      {/* Customer */}
      <XStack flex={1.8} minWidth={0} gap="$2" alignItems="center">
        <Avatar size="$2" name={reporter?.full_name ?? 'Customer'} />
        <YStack flex={1} minWidth={0} gap={1}>
          <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
            {reporter?.full_name ?? 'Customer'}
          </Text>
          <Text fontSize={11.5} color={ui.textMuted} numberOfLines={1}>
            {reporter?.email ?? '—'}
          </Text>
        </YStack>
      </XStack>

      {/* Priority */}
      <XStack flex={1} minWidth={0}>
        <IssuePriorityBadge priority={issue.issue_priority} />
      </XStack>

      {/* Status */}
      <XStack flex={1.3} minWidth={0}>
        <IssueStatusBadge status={issue.status} size="sm" />
      </XStack>

      {/* Raised */}
      <YStack flex={1.1} minWidth={0} gap={1}>
        <Text fontSize={12} fontWeight="600" color={overdue ? ui.danger : ui.textSecondary}>
          {formatAge(issueAgeInHours(issue.created_at))}
        </Text>
        <Text fontSize={10.5} color={ui.textMuted}>
          {formatOrderDate(issue.created_at)}
        </Text>
      </YStack>

      {/* Actions */}
      <XStack flex={1.9} minWidth={0} justifyContent="flex-end" gap="$1.5" flexWrap="wrap">
        {actions.map((action) => (
          <VendorActionButton
            key={action.key}
            ui={ui}
            action={action}
            disabled={submitting}
            onPress={() => onAction(issue, action)}
          />
        ))}
        <Button tone="ghost" size="$2" borderRadius={999} onPress={() => onOpen(issue)}>
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
  issue: EnrichedOrderIssue
  submitting: boolean
  onOpen: (issue: EnrichedOrderIssue) => void
  onAction: (issue: EnrichedOrderIssue, action: VendorIssueAction) => void
}

function IssueCard({ ui, issue, submitting, onOpen, onAction }: CardProps) {
  const reporter = issue.reported_by_profile
  const actions = inlineActions(issue)
  const overdue = isOverdueIssue(issue)

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
        <YStack flex={1} minWidth={0} gap={2} cursor="pointer" onPress={() => onOpen(issue)}>
          <Text fontSize={12} fontWeight="800" color={ui.brand}>
            #{issue.orders?.order_number ?? '—'}
          </Text>
          <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={2}>
            {issueTypeLabel(issue.issue_type)}
          </Text>
          <Text fontSize={11.5} color={ui.textMuted} numberOfLines={2}>
            {issue.order_items?.product_title ?? issue.issue_title ?? 'Whole order'}
          </Text>
        </YStack>
        <YStack gap="$1.5" alignItems="flex-end">
          <IssueStatusBadge status={issue.status} size="sm" />
          <IssuePriorityBadge priority={issue.issue_priority} />
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
            Waiting {formatAge(issueAgeInHours(issue.created_at))} — reply now
          </Text>
        </XStack>
      ) : null}

      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
          <Avatar size="$2" name={reporter?.full_name ?? 'Customer'} />
          <YStack flex={1} minWidth={0}>
            <Text fontSize={12.5} fontWeight="700" color={ui.text} numberOfLines={1}>
              {reporter?.full_name ?? 'Customer'}
            </Text>
            <Text fontSize={11} color={ui.textMuted} numberOfLines={1}>
              {formatOrderDate(issue.created_at)}
            </Text>
          </YStack>
        </XStack>
      </XStack>

      <XStack gap="$2" flexWrap="wrap">
        {actions.map((action) => (
          <VendorActionButton
            key={action.key}
            ui={ui}
            action={action}
            disabled={submitting}
            flex={1}
            onPress={() => onAction(issue, action)}
          />
        ))}
        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          flex={actions.length > 0 ? undefined : 1}
          onPress={() => onOpen(issue)}
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

type IssueFilterDropdownProps = {
  ui: AppUiTokens
  icon: React.ReactNode
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}

function IssueFilterDropdown({ ui, icon, label, options, value, onChange }: IssueFilterDropdownProps) {
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

function IssueQuickChip({
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

function IssuePagerButton({
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

function IssuesEmptyState({ ui, hasFilters }: { ui: AppUiTokens; hasFilters: boolean }) {
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
        <Icons.ShieldCheck size={30} color={ui.brand} />
      </YStack>
      <Text fontSize={18} fontWeight="800" color={ui.text}>
        {hasFilters ? 'No matching requests' : 'No open requests'}
      </Text>
      <Text fontSize={14} color={ui.textSecondary} textAlign="center" maxWidth={360} lineHeight={20}>
        {hasFilters
          ? 'Try clearing the filters to see the rest of your queue.'
          : 'Cancellations, returns, and complaints from your customers will land here.'}
      </Text>
    </YStack>
  )
}