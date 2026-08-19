import { ISSUE_PRIORITY, ISSUE_STATUS, ORDER_STATUS } from '~/lib/orders/order.constants'
import type { EnrichedOrderIssue } from '~/lib/orders/order-issue.type'
import {
  getIssuePriorityDisplay,
  isDecisionIssueType,
  isExchangeIssueType,
  isHighIssuePriority,
  isOpenIssueStatus,
  isOverdueIssue,
  issueAgeInHours,
  issueStatusLabel,
  issueTypeLabel,
} from '~/lib/orders/order-issue.utils'
import type { VendorOrderItem } from '~/lib/orders/vendor-orders.type'

export const VENDOR_SLA_FILTERS = [
  'all',
  'critical',
  'ship_now',
  'approve_returns',
  'pickup_issues',
  'exchange_blocked',
] as const

export type VendorSlaFilter = (typeof VENDOR_SLA_FILTERS)[number]
export type VendorSlaSeverity = 'critical' | 'high' | 'medium' | 'low'
export type VendorSlaRowKind =
  | 'shipment_risk'
  | 'return_approval_pending'
  | 'pickup_exception'
  | 'exchange_stock_blocked'
  | 'issue_follow_up'

export type VendorSlaInboxRow = {
  id: string
  kind: VendorSlaRowKind
  severity: VendorSlaSeverity
  title: string
  description: string
  dueLabel: string
  nextActionLabel: string
  orderItemId: string | null
  issueId: string | null
  orderId: string | null
  orderNumber: string | null
  customerName: string | null
  productTitle: string | null
  tags: string[]
  orderItem: VendorOrderItem | null
  issue: EnrichedOrderIssue | null
}

export type VendorSlaSummary = {
  total: number
  critical: number
  shipNow: number
  approveReturns: number
  pickupIssues: number
  exchangeBlocked: number
  overdue: number
}

export type VendorSlaInboxData = {
  rows: VendorSlaInboxRow[]
  counts: Record<VendorSlaFilter, number>
  summary: VendorSlaSummary
}

const SHIPMENT_WARNING_HOURS = 24
const SHIPMENT_CRITICAL_HOURS = 48
const RETURN_DECISION_WARNING_HOURS = 24
const RETURN_DECISION_CRITICAL_HOURS = 48
const PICKUP_WARNING_HOURS = 12
const PICKUP_CRITICAL_HOURS = 24

function hoursSince(value: string | null | undefined, now = Date.now()) {
  if (!value) return 0
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return 0
  return Math.max(0, Math.floor((now - time) / (60 * 60 * 1000)))
}

function ageLabel(hours: number) {
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  const remainder = hours % 24
  return remainder ? `${days}d ${remainder}h` : `${days}d`
}

function severityRank(severity: VendorSlaSeverity) {
  switch (severity) {
    case 'critical':
      return 4
    case 'high':
      return 3
    case 'medium':
      return 2
    case 'low':
    default:
      return 1
  }
}

function severityForAge(hours: number, warning: number, critical: number): VendorSlaSeverity {
  if (hours >= critical) return 'critical'
  if (hours >= warning) return 'high'
  if (hours > 0) return 'medium'
  return 'low'
}

function rowOrder(kind: VendorSlaRowKind) {
  switch (kind) {
    case 'exchange_stock_blocked':
      return 0
    case 'pickup_exception':
      return 1
    case 'return_approval_pending':
      return 2
    case 'shipment_risk':
      return 3
    case 'issue_follow_up':
    default:
      return 4
  }
}

function shipmentRiskRow(item: VendorOrderItem, now: number): VendorSlaInboxRow | null {
  const status = item.item_status
  if (status !== ORDER_STATUS.CONFIRMED && status !== ORDER_STATUS.PROCESSING) return null
  const delivery = Array.isArray(item.order_delivery) ? item.order_delivery[0] : item.order_delivery
  if (delivery?.tracking_number || delivery?.awb_code) return null

  const createdAt = item.orders?.created_at ?? item.created_at ?? null
  const ageHours = hoursSince(createdAt, now)
  const severity = severityForAge(ageHours, SHIPMENT_WARNING_HOURS, SHIPMENT_CRITICAL_HOURS)

  return {
    id: `shipment:${item.id}`,
    kind: 'shipment_risk',
    severity,
    title: item.product_title ?? item.listings?.title ?? 'Order item',
    description: 'This order is ready for fulfillment but still has no outbound tracking.',
    dueLabel:
      ageHours >= SHIPMENT_WARNING_HOURS ? `Overdue by ${ageLabel(ageHours)}` : `Waiting ${ageLabel(ageHours)}`,
    nextActionLabel: 'Add outbound tracking',
    orderItemId: item.id,
    issueId: null,
    orderId: item.order_id ?? item.orders?.id ?? null,
    orderNumber: item.orders?.order_number ?? null,
    customerName: item.orders?.profiles?.full_name ?? null,
    productTitle: item.product_title ?? item.listings?.title ?? null,
    tags: ['Ship now', severity === 'critical' ? 'Overdue' : 'Fulfillment'],
    orderItem: item,
    issue: null,
  }
}

function buildIssueRow(
  issue: EnrichedOrderIssue,
  itemById: Map<string, VendorOrderItem>,
  replacementBySourceId: Map<string, VendorOrderItem>,
  now: number,
): VendorSlaInboxRow | null {
  if (!isOpenIssueStatus(issue.status)) return null

  const ageHours = issueAgeInHours(issue.created_at, now)
  const productTitle = issue.order_items?.product_title ?? itemById.get(issue.order_item_id ?? '')?.product_title ?? null
  const customerName = issue.orders?.profiles?.full_name ?? issue.reported_by_profile?.full_name ?? null
  const orderItem = itemById.get(issue.order_item_id ?? '') ?? null
  const replacementItem =
    issue.order_item_id ? replacementBySourceId.get(issue.order_item_id) ?? null : null

  if (
    isExchangeIssueType(issue.issue_type) &&
    issue.resolution_action === 'exchange_ready_to_ship' &&
    !replacementItem
  ) {
    return {
      id: `exchange:${issue.id}`,
      kind: 'exchange_stock_blocked',
      severity: 'critical',
      title: productTitle ?? issueTypeLabel(issue.issue_type),
      description: 'The exchange is ready to ship, but no replacement line item was found yet.',
      dueLabel: `Blocked for ${ageLabel(ageHours)}`,
      nextActionLabel: 'Open exchange request',
      orderItemId: issue.order_item_id ?? null,
      issueId: issue.id,
      orderId: issue.order_id ?? issue.orders?.id ?? null,
      orderNumber: issue.orders?.order_number ?? null,
      customerName,
      productTitle,
      tags: ['Exchange', 'Blocked', 'Replacement'],
      orderItem,
      issue,
    }
  }

  const isReturnDecision =
    isDecisionIssueType(issue.issue_type) && !issue.resolution_action && issue.status !== ISSUE_STATUS.WAITING_CUSTOMER
  if (isReturnDecision) {
    const severity = severityForAge(ageHours, RETURN_DECISION_WARNING_HOURS, RETURN_DECISION_CRITICAL_HOURS)
    return {
      id: `decision:${issue.id}`,
      kind: 'return_approval_pending',
      severity,
      title: productTitle ?? issueTypeLabel(issue.issue_type),
      description: `${issueTypeLabel(issue.issue_type)} is waiting for your accept or decline decision.`,
      dueLabel: isOverdueIssue(issue, now) ? `Overdue by ${ageLabel(ageHours)}` : `Waiting ${ageLabel(ageHours)}`,
      nextActionLabel: 'Review request',
      orderItemId: issue.order_item_id ?? null,
      issueId: issue.id,
      orderId: issue.order_id ?? issue.orders?.id ?? null,
      orderNumber: issue.orders?.order_number ?? null,
      customerName,
      productTitle,
      tags: ['Returns', 'Decision', issueStatusLabel(issue.status)],
      orderItem,
      issue,
    }
  }

  const acceptedReturn =
    (issue.issue_type === 'return_request' || issue.issue_type === 'refund_request' || isExchangeIssueType(issue.issue_type)) &&
    issue.resolution_action === 'accepted' &&
    !(issue as { return_tracking_number?: string | null }).return_tracking_number
  if (acceptedReturn) {
    const severity = severityForAge(ageHours, PICKUP_WARNING_HOURS, PICKUP_CRITICAL_HOURS)
    return {
      id: `pickup:${issue.id}`,
      kind: 'pickup_exception',
      severity,
      title: productTitle ?? issueTypeLabel(issue.issue_type),
      description: 'This approved return still needs a reverse pickup AWB or courier assignment.',
      dueLabel: ageHours >= PICKUP_WARNING_HOURS ? `Pickup delayed ${ageLabel(ageHours)}` : `Waiting ${ageLabel(ageHours)}`,
      nextActionLabel: 'Arrange return pickup',
      orderItemId: issue.order_item_id ?? null,
      issueId: issue.id,
      orderId: issue.order_id ?? issue.orders?.id ?? null,
      orderNumber: issue.orders?.order_number ?? null,
      customerName,
      productTitle,
      tags: ['Pickup', 'Reverse logistics', issueStatusLabel(issue.status)],
      orderItem,
      issue,
    }
  }

  const needsFollowUp =
    isHighIssuePriority(issue.issue_priority) ||
    isOverdueIssue(issue, now) ||
    issue.status === ISSUE_STATUS.WAITING_CUSTOMER
  if (!needsFollowUp) return null

  const priority = getIssuePriorityDisplay(issue.issue_priority)
  const severity: VendorSlaSeverity =
    issue.status === ISSUE_STATUS.WAITING_CUSTOMER
      ? 'medium'
      : isOverdueIssue(issue, now)
        ? 'high'
        : priority.weight >= 4
          ? 'high'
          : 'medium'

  return {
    id: `followup:${issue.id}`,
    kind: 'issue_follow_up',
    severity,
    title: productTitle ?? issueTypeLabel(issue.issue_type),
    description:
      issue.status === ISSUE_STATUS.WAITING_CUSTOMER
        ? 'This thread is paused on the customer. Review if you need to re-engage or escalate.'
        : `${issueTypeLabel(issue.issue_type)} needs vendor follow-up.`,
    dueLabel:
      issue.status === ISSUE_STATUS.WAITING_CUSTOMER
        ? `Waiting ${ageLabel(ageHours)}`
        : isOverdueIssue(issue, now)
          ? `Overdue by ${ageLabel(ageHours)}`
          : `Priority ${priority.label}`,
    nextActionLabel: 'Open request',
    orderItemId: issue.order_item_id ?? null,
    issueId: issue.id,
    orderId: issue.order_id ?? issue.orders?.id ?? null,
    orderNumber: issue.orders?.order_number ?? null,
    customerName,
    productTitle,
    tags: [priority.label, issueStatusLabel(issue.status), issueTypeLabel(issue.issue_type)],
    orderItem,
    issue,
  }
}

export function buildVendorSlaInboxData(input: {
  orders: VendorOrderItem[]
  issues: EnrichedOrderIssue[]
  now?: number
}): VendorSlaInboxData {
  const now = input.now ?? Date.now()
  const itemById = new Map(input.orders.map((item) => [item.id, item]))
  const replacementBySourceId = new Map(
    input.orders
      .filter((item) => typeof item.exchanged_from_item_id === 'string' && item.exchanged_from_item_id.length > 0)
      .map((item) => [String(item.exchanged_from_item_id), item]),
  )

  const rows = [
    ...input.orders.map((item) => shipmentRiskRow(item, now)).filter((row): row is VendorSlaInboxRow => !!row),
    ...input.issues
      .map((issue) => buildIssueRow(issue, itemById, replacementBySourceId, now))
      .filter((row): row is VendorSlaInboxRow => !!row),
  ].sort((a, b) => {
    const severityDiff = severityRank(b.severity) - severityRank(a.severity)
    if (severityDiff !== 0) return severityDiff
    const kindDiff = rowOrder(a.kind) - rowOrder(b.kind)
    if (kindDiff !== 0) return kindDiff
    const aTime = a.issue?.created_at ?? a.orderItem?.orders?.created_at ?? a.orderItem?.created_at ?? null
    const bTime = b.issue?.created_at ?? b.orderItem?.orders?.created_at ?? b.orderItem?.created_at ?? null
    return new Date(aTime ?? 0).getTime() - new Date(bTime ?? 0).getTime()
  })

  const counts: Record<VendorSlaFilter, number> = {
    all: rows.length,
    critical: rows.filter((row) => row.severity === 'critical').length,
    ship_now: rows.filter((row) => row.kind === 'shipment_risk').length,
    approve_returns: rows.filter((row) => row.kind === 'return_approval_pending').length,
    pickup_issues: rows.filter((row) => row.kind === 'pickup_exception').length,
    exchange_blocked: rows.filter((row) => row.kind === 'exchange_stock_blocked').length,
  }

  return {
    rows,
    counts,
    summary: {
      total: rows.length,
      critical: counts.critical,
      shipNow: counts.ship_now,
      approveReturns: counts.approve_returns,
      pickupIssues: counts.pickup_issues,
      exchangeBlocked: counts.exchange_blocked,
      overdue: rows.filter((row) => row.dueLabel.toLowerCase().includes('overdue')).length,
    },
  }
}

export function filterVendorSlaRows(rows: VendorSlaInboxRow[], filter: VendorSlaFilter): VendorSlaInboxRow[] {
  switch (filter) {
    case 'critical':
      return rows.filter((row) => row.severity === 'critical')
    case 'ship_now':
      return rows.filter((row) => row.kind === 'shipment_risk')
    case 'approve_returns':
      return rows.filter((row) => row.kind === 'return_approval_pending')
    case 'pickup_issues':
      return rows.filter((row) => row.kind === 'pickup_exception')
    case 'exchange_blocked':
      return rows.filter((row) => row.kind === 'exchange_stock_blocked')
    case 'all':
    default:
      return rows
  }
}

export function canBulkAcknowledgeInboxRows(rows: VendorSlaInboxRow[]): boolean {
  return rows.length > 0 && rows.every((row) => row.kind === 'return_approval_pending' && Boolean(row.issueId))
}

export function vendorSlaRowsToCsv(rows: VendorSlaInboxRow[]): string {
  if (!rows.length) return ''
  const headers = [
    'kind',
    'severity',
    'due_label',
    'next_action',
    'order_number',
    'customer_name',
    'product_title',
    'tags',
  ]
  const values = rows.map((row) => [
    row.kind,
    row.severity,
    row.dueLabel,
    row.nextActionLabel,
    row.orderNumber ?? '',
    row.customerName ?? '',
    row.productTitle ?? '',
    row.tags.join(' | '),
  ])
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  return [headers, ...values].map((line) => line.map((value) => escape(String(value))).join(',')).join('\n')
}
