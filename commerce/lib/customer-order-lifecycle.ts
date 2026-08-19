/**
 * Pure customer post-purchase lifecycle helpers (no I/O).
 * Shared by success, detail, history, and action UIs across web + native.
 */

import {
  DELIVERY_STATUS_DISPLAY,
  ORDER_ISSUE_TYPE,
  ORDER_STATUS,
  ORDER_STATUS_DISPLAY,
  ORDER_STATUS_PROGRESS,
  RETURN_REJECT_REASON_LABELS,
  type DeliveryStatus,
  type OrderIssueType,
  type OrderStatus,
  type ReturnRejectReason,
} from '~/lib/orders/order.constants'
import {
  isCancellationIssueType,
  isExchangeIssueType,
  isOpenIssueStatus,
  isReturnIssueType,
  issueStatusLabel,
  issueTypeLabel,
} from '~/lib/orders/order-issue.utils'
import { formatOrderDate, getOrderStatusDisplay } from '~/lib/orders/order.utils'
import { safeHttpUrl } from '~/lib/platform/openUrl'

// Issue presentation/classification is shared with the vendor + admin surfaces.
export {
  isCancellationIssueType,
  isExchangeIssueType,
  isOpenIssueStatus,
  isReturnIssueType,
  issueStatusLabel,
  issueTypeLabel,
}

/** Statuses where the customer may still request cancellation (pre-shipment). */
export const PRE_SHIPMENT_ORDER_STATUSES: OrderStatus[] = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.AWAITING_PAYMENT,
  ORDER_STATUS.PAYMENT_FAILED,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.ON_HOLD,
]

const SHIPPED_OR_LATER: OrderStatus[] = [
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.PARTIALLY_SHIPPED,
  ORDER_STATUS.IN_TRANSIT,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.COMPLETED,
]

export type CustomerTimelineKind = 'order' | 'delivery'

export type CustomerTimelineEvent = {
  id: string
  kind: CustomerTimelineKind
  status: string
  label: string
  description: string
  at: string | null
  note?: string | null
  isCurrent?: boolean
}

export type CustomerOrderActionEligibility = {
  canCancel: boolean
  canInstantCancel: boolean
  canRequestCancel: boolean
  cancelBlockedReason: string | null
  canReorder: boolean
  canShareInvoice: boolean
  canGetHelp: boolean
  hasOpenCancellationRequest: boolean
}

export type CustomerItemTrustEligibility = {
  canReview: boolean
  reviewBlockedReason: string | null
  canReturn: boolean
  returnBlockedReason: string | null
  canExchange: boolean
  exchangeBlockedReason: string | null
  canCancelReturnOrExchange: boolean
  cancelReturnBlockedReason: string | null
  canDownload: boolean
  downloadBlockedReason: string | null
  hasOpenReturnRequest: boolean
  hasOpenExchangeRequest: boolean
  hasReview: boolean
  returnWindowLabel: string | null
}

export type RefundStatusLike = 'requested' | 'processing' | 'approved' | 'completed' | 'rejected' | string

export const RETURN_WINDOW_DAYS = 30

export type PendingOrderSuccessSnapshot = {
  orderIds: string[]
  orderNumbers: string[]
  createdAt: number
  paymentMode?: string | null
  awaitingExternalPayment?: boolean
  checkoutGroupId?: string | null
  checkoutUrl?: string | null
}

export const PENDING_ORDER_SUCCESS_KEY = 'commerce:pending-order-success'
/** Snapshot survives external payment handoff long enough for native return. */
export const PENDING_ORDER_SUCCESS_TTL_MS = 1000 * 60 * 60 * 6

export function normalizeOrderStatus(status: string | null | undefined): OrderStatus | null {
  if (!status) return null
  const known = Object.values(ORDER_STATUS) as string[]
  return known.includes(status) ? (status as OrderStatus) : null
}

export function isPreShipmentStatus(status: string | null | undefined): boolean {
  const normalized = normalizeOrderStatus(status)
  return Boolean(normalized && PRE_SHIPMENT_ORDER_STATUSES.includes(normalized))
}

export function isShippedOrLater(status: string | null | undefined): boolean {
  const normalized = normalizeOrderStatus(status)
  return Boolean(normalized && SHIPPED_OR_LATER.includes(normalized))
}

export function findOpenReturnRequest<T extends { issue_type?: string | null; status?: string | null; order_item_id?: string | null }>(
  issues: T[] | null | undefined,
  orderItemId?: string | null,
): T | null {
  if (!issues?.length) return null
  return (
    issues.find(
      (issue) =>
        isReturnIssueType(issue.issue_type) &&
        isOpenIssueStatus(issue.status) &&
        (!orderItemId || issue.order_item_id === orderItemId),
    ) ?? null
  )
}

export function findOpenExchangeRequest<T extends { issue_type?: string | null; status?: string | null; order_item_id?: string | null; resolution_action?: string | null }>(
  issues: T[] | null | undefined,
  orderItemId?: string | null,
): T | null {
  if (!issues?.length) return null
  return (
    issues.find((issue) => {
      if (!isExchangeIssueType(issue.issue_type)) return false
      if (orderItemId && issue.order_item_id !== orderItemId) return false
      if (issue.resolution_action === 'exchange_ready_to_ship') return false
      if (issue.resolution_action === 'rejected') return false
      return (
        isOpenIssueStatus(issue.status) ||
        (issue.status === 'resolved' && issue.resolution_action === 'accepted') ||
        issue.status === 'waiting_customer'
      )
    }) ?? null
  )
}

export function canAssignReturnTracking(issue: {
  issue_type?: string | null
  status?: string | null
  resolution_action?: string | null
  return_tracking_number?: string | null
  order_item_id?: string | null
}): boolean {
  if (!issue.order_item_id) return false
  if (issue.return_tracking_number) return false
  if (issue.resolution_action === 'return_received') return false
  if (issue.resolution_action === 'exchange_ready_to_ship') return false
  const isReturnOrExchange =
    isReturnIssueType(issue.issue_type) || isExchangeIssueType(issue.issue_type)
  if (!isReturnOrExchange) return false
  return (
    issue.resolution_action === 'accepted' ||
    issue.status === 'waiting_customer' ||
    (issue.status === 'resolved' && issue.resolution_action === 'accepted')
  )
}

export function canCancelReturnOrExchange(issue: {
  issue_type?: string | null
  status?: string | null
  resolution_action?: string | null
  return_tracking_number?: string | null
} | null | undefined): boolean {
  if (!issue) return false
  const isReturnOrExchange =
    isReturnIssueType(issue.issue_type) || isExchangeIssueType(issue.issue_type)
  if (!isReturnOrExchange) return false
  if (issue.return_tracking_number) return false
  if (
    issue.resolution_action === 'return_received' ||
    issue.resolution_action === 'exchange_ready_to_ship' ||
    issue.resolution_action === 'rejected' ||
    issue.resolution_action === 'cancelled_by_buyer'
  ) {
    return false
  }
  if (isOpenIssueStatus(issue.status)) return true
  return issue.status === 'resolved' && issue.resolution_action === 'accepted'
}

export function getReturnWindowLabel(
  deliveredAt: string | null | undefined,
  windowDays = RETURN_WINDOW_DAYS,
  now = Date.now(),
): string | null {
  if (!deliveredAt) return null
  const deliveredMs = new Date(deliveredAt).getTime()
  if (!Number.isFinite(deliveredMs)) return null
  const endsAt = deliveredMs + windowDays * 24 * 60 * 60 * 1000
  const ends = new Date(endsAt)
  const dateLabel = ends.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  if (now > endsAt) return `Return window ended ${dateLabel}`
  const daysLeft = Math.max(0, Math.ceil((endsAt - now) / (24 * 60 * 60 * 1000)))
  if (daysLeft <= 1) return `Returns until ${dateLabel} (last day)`
  return `Returns until ${dateLabel} (${daysLeft} days left)`
}

export function rejectReasonLabel(code: string | null | undefined): string | null {
  if (!code) return null
  return RETURN_REJECT_REASON_LABELS[code as ReturnRejectReason] ?? code.replace(/_/g, ' ')
}

export type ReturnExchangeTimelineStep = {
  id: string
  label: string
  done: boolean
  active: boolean
  detail?: string | null
}

export type BuyerReturnHubCategory = 'needs_action' | 'in_progress' | 'resolved' | 'declined'

export type BuyerReturnHubAction =
  | 'upload_evidence'
  | 'wait_for_decision'
  | 'wait_for_pickup'
  | 'track_return'
  | 'wait_for_receipt'
  | 'view_refund_progress'
  | 'replacement_shipping_soon'
  | 'view_decline_reason'
  | 'request_cancelled'

export type BuyerReturnHubEntry = {
  issueId: string
  orderItemId: string | null
  itemTitle: string
  issueLabel: string
  statusLabel: string
  category: BuyerReturnHubCategory
  action: BuyerReturnHubAction
  actionLabel: string
  actionDetail: string | null
  timeline: ReturnExchangeTimelineStep[]
  evidenceCount: number
  evidenceUrls: string[]
  evidenceLabel: string | null
  refundLabel: string | null
  refundProgress: BuyerRefundProgress | null
  returnTrackingNumber: string | null
  returnCourierSlug: string | null
  returnTrackingUrl: string | null
  returnShippingMode: string | null
  rejectReason: string | null
  resolutionNote: string | null
}

export type BuyerRefundProgress = {
  status: string
  statusLabel: string
  etaLabel: string | null
  explainer: string
  nextStep: string
  delayedWarning: string | null
}

export type BuyerRefundSummary = {
  activeCount: number
  completedCount: number
  headline: string
  detail: string
  delayedCount: number
}

const BUSINESS_DAY_MS = 24 * 60 * 60 * 1000

function daysBetween(startAt: string | null | undefined, endAt = Date.now()) {
  if (!startAt) return null
  const startMs = new Date(startAt).getTime()
  if (!Number.isFinite(startMs)) return null
  return Math.max(0, Math.floor((endAt - startMs) / BUSINESS_DAY_MS))
}

function formatRefundEta(status: string, receivedAt: string | null, approvedAt: string | null) {
  if (status === 'completed') return 'Refund completed'
  if (status === 'approved') return 'Expect the refund within 2-3 business days'
  if (status === 'processing') return 'Most banks reflect this within 3-5 business days'
  if (status === 'requested' && receivedAt) return 'The refund usually starts within 1-2 business days'
  if (status === 'requested' && approvedAt) return 'Refund starts after the shop receives your return'
  return null
}

export function buildBuyerRefundProgress(input: {
  refund_status?: string | null
  return_received_at?: string | null
  approved_at?: string | null
  updated_at?: string | null
}, now = Date.now()): BuyerRefundProgress | null {
  const status = String(input.refund_status ?? '').trim().toLowerCase()
  if (!status) return null
  const statusLabel = refundStatusLabel(status)
  const receivedAt = input.return_received_at ?? null
  const approvedAt = input.approved_at ?? null
  const etaLabel = formatRefundEta(status, receivedAt, approvedAt)
  const receivedDays = daysBetween(receivedAt, now)

  let explainer = `Refund ${statusLabel}`
  let nextStep = 'We will keep this order updated as the refund moves forward.'
  let delayedWarning: string | null = null

  if (status === 'requested') {
    explainer = receivedAt
      ? 'The shop marked your return as received and is preparing the refund handoff.'
      : 'The refund request is approved, but the shop still needs to receive your returned item.'
    nextStep = receivedAt
      ? 'Next, the refund is handed to the payment provider.'
      : 'Next, the shop confirms receipt of your returned item.'
  } else if (status === 'processing') {
    explainer = 'The refund has been sent to the payment provider and is moving through bank processing.'
    nextStep = 'Next, your bank or wallet posts the refund to the original payment method.'
  } else if (status === 'approved') {
    explainer = 'The refund has been approved and should appear on the original payment method shortly.'
    nextStep = 'Next, your bank or wallet reflects the completed payout.'
  } else if (status === 'completed') {
    explainer = 'The refund has completed on our side.'
    nextStep = 'If it is not visible yet, your bank statement may take a short time to refresh.'
  }

  if ((status === 'requested' || status === 'processing') && receivedDays !== null && receivedDays >= 7) {
    delayedWarning = 'This refund is taking longer than usual. If you still do not see movement soon, contact support.'
  } else if (status === 'approved' && receivedDays !== null && receivedDays >= 10) {
    delayedWarning = 'The refund looks delayed beyond the usual bank window. Please contact support if it has not posted yet.'
  }

  return {
    status,
    statusLabel,
    etaLabel,
    explainer,
    nextStep,
    delayedWarning,
  }
}

export function getReturnExchangeTimeline(input: {
  issue: {
    issue_type?: string | null
    status?: string | null
    resolution_action?: string | null
    return_tracking_number?: string | null
    return_courier_slug?: string | null
    return_shipping_mode?: string | null
    return_shipped_at?: string | null
    reject_reason_code?: string | null
    resolution_note?: string | null
    created_at?: string | null
  }
  refund?: {
    refund_status?: string | null
    return_received_at?: string | null
  } | null
}): ReturnExchangeTimelineStep[] {
  const issue = input.issue
  const isExchange = isExchangeIssueType(issue.issue_type)
  const rejected = issue.resolution_action === 'rejected'
  const cancelled = issue.resolution_action === 'cancelled_by_buyer'
  const accepted =
    issue.resolution_action === 'accepted' ||
    issue.resolution_action === 'return_received' ||
    issue.resolution_action === 'exchange_ready_to_ship'
  const hasAwb = Boolean(issue.return_tracking_number)
  const received =
    issue.resolution_action === 'return_received' ||
    issue.resolution_action === 'exchange_ready_to_ship' ||
    Boolean(input.refund?.return_received_at)
  const refundDone = ['approved', 'completed'].includes(String(input.refund?.refund_status ?? ''))
  const exchangeReady = issue.resolution_action === 'exchange_ready_to_ship'

  const steps: ReturnExchangeTimelineStep[] = [
    {
      id: 'requested',
      label: isExchange ? 'Exchange requested' : 'Return requested',
      done: true,
      active: !accepted && !rejected && !cancelled,
    },
    {
      id: 'decision',
      label: rejected
        ? `Declined${rejectReasonLabel(issue.reject_reason_code) ? ` — ${rejectReasonLabel(issue.reject_reason_code)}` : ''}`
        : cancelled
          ? 'Cancelled by you'
          : accepted
            ? 'Approved by shop'
            : 'Waiting for shop decision',
      done: accepted || rejected || cancelled,
      active: !accepted && !rejected && !cancelled,
      detail: issue.resolution_note,
    },
  ]

  if (!rejected && !cancelled) {
    const mode = hasAwb ? 'Pickup arranged by the shop' : 'Shop is arranging pickup'
    steps.push({
      id: 'shipped',
      label: hasAwb
        ? `Return shipped${issue.return_tracking_number ? ` · ${issue.return_tracking_number}` : ''}`
        : 'Return shipment',
      done: hasAwb,
      active: accepted && !hasAwb && !received,
      detail: mode,
    })
    steps.push({
      id: 'received',
      label: received ? 'Shop received the item' : 'Awaiting shop receipt',
      done: received,
      active: hasAwb && !received,
    })
    if (isExchange) {
      steps.push({
        id: 'replacement',
        label: exchangeReady ? 'Replacement ready to ship' : 'Replacement shipping',
        done: exchangeReady,
        active: received && !exchangeReady,
      })
    } else {
      steps.push({
        id: 'refund',
        label: refundDone ? 'Refund completed' : 'Refund',
        done: refundDone,
        active: received && !refundDone,
      })
    }
  }

  return steps
}

export function getBuyerReturnHubEntries(input: {
  items: Array<{ id: string; product_title?: string | null }>
  issues: Array<{
    id: string
    order_item_id?: string | null
    issue_type?: string | null
    status?: string | null
    resolution_action?: string | null
    return_tracking_number?: string | null
    return_courier_slug?: string | null
    return_tracking_url?: string | null
    return_shipping_mode?: string | null
    reject_reason_code?: string | null
    resolution_note?: string | null
    evidence_urls?: string[] | null
    created_at?: string | null
  }>
  refunds?: Array<{
    order_item_id?: string | null
    refund_status?: string | null
    refund_amount?: number | null
    return_received_at?: string | null
    approved_at?: string | null
    created_at?: string | null
    updated_at?: string | null
  }> | null
  currency?: string | null
}): BuyerReturnHubEntry[] {
  const itemById = new Map(input.items.map((item) => [item.id, item]))

  return input.issues
    .filter((issue) => isReturnIssueType(issue.issue_type) || isExchangeIssueType(issue.issue_type))
    .map((issue) => {
      const refund =
        (input.refunds ?? []).find((item) => item.order_item_id === issue.order_item_id) ?? null
      const timeline = getReturnExchangeTimeline({ issue, refund })
      const isExchange = isExchangeIssueType(issue.issue_type)
      const rejected = issue.resolution_action === 'rejected'
      const cancelled = issue.resolution_action === 'cancelled_by_buyer'
      const hasAwb = Boolean(issue.return_tracking_number)
      const received =
        issue.resolution_action === 'return_received' ||
        issue.resolution_action === 'exchange_ready_to_ship' ||
        Boolean(refund?.return_received_at)
      const refundStatus = String(refund?.refund_status ?? '')
      const refundProgress = refund ? buildBuyerRefundProgress(refund) : null
      const refundDone = ['approved', 'completed'].includes(refundStatus)
      const exchangeReady = issue.resolution_action === 'exchange_ready_to_ship'
      const accepted =
        issue.resolution_action === 'accepted' ||
        issue.resolution_action === 'return_received' ||
        issue.resolution_action === 'exchange_ready_to_ship'
      const evidenceCount = Array.isArray(issue.evidence_urls) ? issue.evidence_urls.length : 0
      const rejectReason = rejectReasonLabel(issue.reject_reason_code)
      const itemTitle =
        itemById.get(issue.order_item_id ?? '')?.product_title?.trim() || issueTypeLabel(issue.issue_type)

      let category: BuyerReturnHubCategory = 'in_progress'
      let action: BuyerReturnHubAction = 'wait_for_decision'
      let actionLabel = 'Waiting for shop decision'
      let actionDetail: string | null = 'The shop will review your request shortly.'

      if (rejected) {
        category = 'declined'
        action = 'view_decline_reason'
        actionLabel = 'Request declined'
        actionDetail = rejectReason
          ? `${rejectReason}${issue.resolution_note ? ` · ${issue.resolution_note}` : ''}`
          : issue.resolution_note ?? 'The shop declined this request.'
      } else if (cancelled) {
        category = 'resolved'
        action = 'request_cancelled'
        actionLabel = 'Request cancelled'
        actionDetail = 'You cancelled this request before pickup was arranged.'
      } else if (!accepted) {
        category = evidenceCount === 0 ? 'needs_action' : 'in_progress'
        action = evidenceCount === 0 ? 'upload_evidence' : 'wait_for_decision'
        actionLabel = evidenceCount === 0 ? 'Add photos if helpful' : 'Waiting for shop decision'
        actionDetail =
          evidenceCount === 0
            ? 'Photos can help the shop approve your request faster.'
            : `Evidence uploaded · ${evidenceCount} photo${evidenceCount === 1 ? '' : 's'}`
      } else if (received && isExchange) {
        category = exchangeReady ? 'in_progress' : 'in_progress'
        action = 'replacement_shipping_soon'
        actionLabel = exchangeReady ? 'Replacement ready to ship' : 'Replacement shipping soon'
        actionDetail = 'The shop has received your item and will ship your replacement next.'
      } else if (received && refundStatus) {
        category = refundDone ? 'resolved' : 'in_progress'
        action = 'view_refund_progress'
        actionLabel = refundDone ? 'Refund completed' : 'Refund in progress'
        actionDetail = `Refund ${refundStatusLabel(refundStatus)}`
      } else if (!hasAwb) {
        category = 'in_progress'
        action = 'wait_for_pickup'
        actionLabel = 'Pickup being arranged'
        actionDetail = 'The shop has approved your request and is arranging reverse pickup.'
      } else if (!received) {
        category = 'in_progress'
        action = issue.return_tracking_url ? 'track_return' : 'wait_for_receipt'
        actionLabel = issue.return_tracking_url ? 'Track return' : 'Return in transit'
        actionDetail = 'Your return is on the way back to the shop.'
      }

      const evidenceLabel =
        evidenceCount > 0
          ? `${evidenceCount} photo${evidenceCount === 1 ? '' : 's'} shared with the shop`
          : category === 'needs_action'
            ? 'No photos attached yet'
            : null

      return {
        issueId: issue.id,
        orderItemId: issue.order_item_id ?? null,
        itemTitle,
        issueLabel: issueTypeLabel(issue.issue_type),
        statusLabel: issueStatusLabel(issue.status),
        category,
        action,
        actionLabel,
        actionDetail,
        timeline,
        evidenceCount,
        evidenceUrls: Array.isArray(issue.evidence_urls) ? issue.evidence_urls.filter(Boolean) : [],
        evidenceLabel,
        refundLabel: refundStatus ? `Refund ${refundStatusLabel(refundStatus)}` : null,
        refundProgress,
        returnTrackingNumber: issue.return_tracking_number ?? null,
        returnCourierSlug: issue.return_courier_slug ?? null,
        returnTrackingUrl: safeHttpUrl(issue.return_tracking_url) ?? null,
        returnShippingMode: issue.return_shipping_mode ?? null,
        rejectReason,
        resolutionNote: issue.resolution_note ?? null,
      } satisfies BuyerReturnHubEntry
    })
    .sort((a, b) => {
      const rank = { needs_action: 0, in_progress: 1, declined: 2, resolved: 3 } satisfies Record<
        BuyerReturnHubCategory,
        number
      >
      return rank[a.category] - rank[b.category]
    })
}

export function buildBuyerRefundSummary(entries: BuyerReturnHubEntry[]): BuyerRefundSummary | null {
  const refundEntries = entries.filter((entry) => entry.refundProgress)
  if (!refundEntries.length) return null
  const activeCount = refundEntries.filter((entry) => entry.refundProgress?.status !== 'completed').length
  const completedCount = refundEntries.filter((entry) => entry.refundProgress?.status === 'completed').length
  const delayedCount = refundEntries.filter((entry) => entry.refundProgress?.delayedWarning).length
  const primary = refundEntries.find((entry) => entry.refundProgress?.status !== 'completed') ?? refundEntries[0]
  const eta = primary?.refundProgress?.etaLabel

  return {
    activeCount,
    completedCount,
    delayedCount,
    headline:
      activeCount > 1
        ? `${activeCount} refunds in progress`
        : activeCount === 1
          ? '1 refund in progress'
          : `${completedCount} refund${completedCount === 1 ? '' : 's'} completed`,
    detail:
      delayedCount > 0
        ? `${delayedCount} refund${delayedCount === 1 ? '' : 's'} may need support attention.`
        : eta ?? 'Track each return below for the next payout step.',
  }
}

export function isDeliveredOrCompletedStatus(status: string | null | undefined): boolean {
  return status === ORDER_STATUS.DELIVERED || status === ORDER_STATUS.COMPLETED
}

export function isDigitalListingType(listingType: string | null | undefined): boolean {
  return listingType === 'digital' || listingType === 'service'
}

export function isDownloadUrlSafe(url: string | null | undefined): boolean {
  return Boolean(sanitizeCarrierTrackingUrl(url))
}

export function isWithinReturnWindow(
  deliveredAt: string | null | undefined,
  now = Date.now(),
  windowDays = RETURN_WINDOW_DAYS,
): boolean {
  if (!deliveredAt) return false
  const deliveredMs = new Date(deliveredAt).getTime()
  if (!Number.isFinite(deliveredMs)) return false
  return now - deliveredMs <= windowDays * 24 * 60 * 60 * 1000
}

export function refundStatusLabel(status: RefundStatusLike | null | undefined): string {
  if (!status) return 'Unknown'
  return String(status).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function getCustomerItemTrustEligibility(input: {
  orderStatus: string | null | undefined
  itemStatus: string | null | undefined
  listingType?: string | null
  digitalDownloadUrl?: string | null
  downloadExpiresAt?: string | null
  hasReview?: boolean | null
  deliveredAt?: string | null
  returnWindowDays?: number | null
  acceptsReturns?: boolean | null
  acceptsExchanges?: boolean | null
  issues?: Array<{
    issue_type?: string | null
    status?: string | null
    order_item_id?: string | null
    resolution_action?: string | null
    return_tracking_number?: string | null
    return_shipping_mode?: string | null
  }> | null
  refunds?: Array<{
    order_item_id?: string | null
    refund_status?: string | null
    return_tracking_number?: string | null
  }> | null
  orderItemId: string
  now?: number
}): CustomerItemTrustEligibility {
  const now = input.now ?? Date.now()
  const windowDays = input.returnWindowDays ?? RETURN_WINDOW_DAYS
  const delivered =
    isDeliveredOrCompletedStatus(input.itemStatus) ||
    isDeliveredOrCompletedStatus(input.orderStatus)
  const digital =
    isDigitalListingType(input.listingType) || Boolean(input.digitalDownloadUrl?.trim())
  const openReturn = findOpenReturnRequest(input.issues, input.orderItemId)
  const openExchange = findOpenExchangeRequest(input.issues, input.orderItemId)
  const cancellableIssue =
    (openReturn && canCancelReturnOrExchange(openReturn) ? openReturn : null) ??
    (openExchange && canCancelReturnOrExchange(openExchange) ? openExchange : null) ??
    (input.issues ?? []).find(
      (issue) =>
        issue.order_item_id === input.orderItemId && canCancelReturnOrExchange(issue),
    ) ??
    null
  const activeRefund = (input.refunds ?? []).find(
    (refund) =>
      refund.order_item_id === input.orderItemId &&
      ['requested', 'processing', 'approved', 'completed'].includes(String(refund.refund_status)),
  )
  const hasReview = Boolean(input.hasReview)
  const acceptsReturns = input.acceptsReturns !== false
  const acceptsExchanges = input.acceptsExchanges !== false
  const returnWindowLabel = delivered
    ? getReturnWindowLabel(input.deliveredAt ?? null, windowDays, now)
    : null

  let reviewBlockedReason: string | null = null
  if (hasReview) reviewBlockedReason = 'You already reviewed this item.'
  else if (!delivered) reviewBlockedReason = 'You can review this item after delivery.'

  let returnBlockedReason: string | null = null
  if (digital) returnBlockedReason = 'Digital purchases cannot be returned here.'
  else if (!acceptsReturns) returnBlockedReason = 'This shop does not accept returns for this item.'
  else if (!delivered) returnBlockedReason = 'Returns are available after delivery.'
  else if (openReturn) returnBlockedReason = 'A return request is already open for this item.'
  else if (openExchange) returnBlockedReason = 'An exchange request is already open for this item.'
  else if (activeRefund) returnBlockedReason = 'A refund is already in progress for this item.'
  else if (!isWithinReturnWindow(input.deliveredAt ?? null, now, windowDays)) {
    returnBlockedReason = `Returns are available for ${windowDays} days after delivery.`
  }

  let exchangeBlockedReason: string | null = null
  if (digital) exchangeBlockedReason = 'Digital purchases cannot be exchanged here.'
  else if (!acceptsExchanges) {
    exchangeBlockedReason = 'This shop does not accept exchanges for this item.'
  } else if (!delivered) exchangeBlockedReason = 'Exchanges are available after delivery.'
  else if (openExchange) exchangeBlockedReason = 'An exchange request is already open for this item.'
  else if (openReturn) exchangeBlockedReason = 'A return request is already open for this item.'
  else if (activeRefund) exchangeBlockedReason = 'A refund is already in progress for this item.'
  else if (!isWithinReturnWindow(input.deliveredAt ?? null, now, windowDays)) {
    exchangeBlockedReason = `Exchanges are available for ${windowDays} days after delivery.`
  }

  let cancelReturnBlockedReason: string | null = null
  if (!cancellableIssue) {
    cancelReturnBlockedReason = 'There is no open return or exchange you can cancel.'
  }

  let downloadBlockedReason: string | null = null
  if (!input.digitalDownloadUrl?.trim()) {
    downloadBlockedReason = 'No digital download is available for this item.'
  } else if (!isDownloadUrlSafe(input.digitalDownloadUrl)) {
    downloadBlockedReason = 'Download link is invalid.'
  } else if (
    input.orderStatus === ORDER_STATUS.CANCELLED ||
    input.orderStatus === ORDER_STATUS.REFUNDED ||
    input.itemStatus === ORDER_STATUS.CANCELLED ||
    input.itemStatus === ORDER_STATUS.REFUNDED
  ) {
    downloadBlockedReason = 'Download is unavailable for cancelled or refunded orders.'
  } else if (
    input.downloadExpiresAt &&
    new Date(input.downloadExpiresAt).getTime() < now
  ) {
    downloadBlockedReason = 'This download link has expired.'
  }

  return {
    canReview: !reviewBlockedReason,
    reviewBlockedReason,
    canReturn: !returnBlockedReason,
    returnBlockedReason,
    canExchange: !exchangeBlockedReason,
    exchangeBlockedReason,
    canCancelReturnOrExchange: !cancelReturnBlockedReason,
    cancelReturnBlockedReason,
    canDownload: !downloadBlockedReason,
    downloadBlockedReason,
    hasOpenReturnRequest: Boolean(openReturn),
    hasOpenExchangeRequest: Boolean(openExchange),
    hasReview,
    returnWindowLabel,
  }
}

export function findOpenCancellationRequest<T extends { issue_type?: string | null; status?: string | null }>(
  issues: T[] | null | undefined,
): T | null {
  if (!issues?.length) return null
  return (
    issues.find(
      (issue) => isCancellationIssueType(issue.issue_type) && isOpenIssueStatus(issue.status),
    ) ?? null
  )
}

export function getCustomerOrderActionEligibility(input: {
  orderStatus: string | null | undefined
  paymentStatus?: string | null | undefined
  issues?: Array<{ issue_type?: string | null; status?: string | null }> | null
}): CustomerOrderActionEligibility {
  const openCancellation = findOpenCancellationRequest(input.issues)
  const final =
    input.orderStatus === ORDER_STATUS.CANCELLED ||
    input.orderStatus === ORDER_STATUS.REFUNDED ||
    input.orderStatus === ORDER_STATUS.COMPLETED

  const payment = (input.paymentStatus ?? '').toLowerCase()
  const paymentCaptured = payment === 'completed' || payment === 'paid' || payment === 'refunded'
  const unpaidStatus =
    input.orderStatus === ORDER_STATUS.AWAITING_PAYMENT ||
    input.orderStatus === ORDER_STATUS.PAYMENT_FAILED ||
    (input.orderStatus === ORDER_STATUS.PENDING && !paymentCaptured)

  let cancelBlockedReason: string | null = null
  if (final) cancelBlockedReason = 'This order can no longer be cancelled.'
  else if (openCancellation) cancelBlockedReason = 'A cancellation request is already open.'
  else if (!isPreShipmentStatus(input.orderStatus)) {
    cancelBlockedReason = 'Cancellation is only available before the shop ships your order.'
  }

  const canInstantCancel = !cancelBlockedReason && unpaidStatus
  const canRequestCancel =
    !cancelBlockedReason && !canInstantCancel && isPreShipmentStatus(input.orderStatus)

  return {
    canCancel: canInstantCancel || canRequestCancel,
    canInstantCancel,
    canRequestCancel,
    cancelBlockedReason,
    canReorder: Boolean(input.orderStatus) && input.orderStatus !== ORDER_STATUS.CANCELLED,
    canShareInvoice: Boolean(input.orderStatus) && input.orderStatus !== ORDER_STATUS.CANCELLED,
    canGetHelp: Boolean(input.orderStatus) && input.orderStatus !== ORDER_STATUS.CANCELLED,
    hasOpenCancellationRequest: Boolean(openCancellation),
  }
}

/** Accept only http(s) carrier tracking URLs. */
export function sanitizeCarrierTrackingUrl(url: string | null | undefined): string | null {
  return safeHttpUrl(url)
}

export function formatEstimatedDelivery(date: string | null | undefined): string | null {
  if (!date) return null
  const label = formatOrderDate(date)
  return label === 'N/A' || label === 'Invalid Date' ? null : label
}

export function deliveryNoteFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const record = metadata as Record<string, unknown>
  const candidates = [
    record.current_location,
    record.carrier_notes,
    record.note,
    record.latest_note,
    record.status_note,
  ]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

type StatusLogLike = {
  id?: string | null
  to_status?: string | null
  from_status?: string | null
  changed_at?: string | null
  note?: string | null
  change_reason?: string | null
}

type DeliveryLike = {
  id?: string | null
  delivery_status?: string | null
  created_at?: string | null
  updated_at?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  estimated_delivery_date?: string | null
  delivery_metadata?: unknown
  status_history?: unknown
  tracking_number?: string | null
  carrier_name?: string | null
}

/**
 * Merge order status logs + delivery milestones into a chronological timeline
 * (oldest → newest). Marks the latest event as current.
 */
export function buildCustomerOrderTimeline(input: {
  orderStatus: string | null | undefined
  statusLogs?: StatusLogLike[] | null
  deliveries?: DeliveryLike[] | null
  createdAt?: string | null
}): CustomerTimelineEvent[] {
  const events: CustomerTimelineEvent[] = []

  if (input.createdAt) {
    events.push({
      id: 'order-placed',
      kind: 'order',
      status: ORDER_STATUS.PENDING,
      label: 'Order placed',
      description: 'We received your order',
      at: input.createdAt,
    })
  }

  for (const log of input.statusLogs ?? []) {
    if (!log.to_status) continue
    const display = ORDER_STATUS_DISPLAY[log.to_status as OrderStatus] ?? getOrderStatusDisplay(log.to_status)
    events.push({
      id: log.id ?? `log-${log.to_status}-${log.changed_at ?? ''}`,
      kind: 'order',
      status: log.to_status,
      label: display.label,
      description: log.note?.trim() || log.change_reason?.trim() || display.description,
      at: log.changed_at ?? null,
      note: log.note ?? null,
    })
  }

  for (const delivery of input.deliveries ?? []) {
    const status = delivery.delivery_status
    if (status) {
      const display =
        DELIVERY_STATUS_DISPLAY[status as DeliveryStatus] ??
        ({
          label: String(status).replace(/_/g, ' '),
          description: 'Shipment update',
        } as const)
      events.push({
        id: `${delivery.id ?? 'delivery'}-${status}`,
        kind: 'delivery',
        status,
        label: display.label,
        description:
          deliveryNoteFromMetadata(delivery.delivery_metadata) ||
          (delivery.tracking_number
            ? `Tracking ${delivery.tracking_number}${
                delivery.carrier_name ? ` · ${delivery.carrier_name}` : ''
              }`
            : display.description),
        at: delivery.updated_at ?? delivery.shipped_at ?? delivery.created_at ?? null,
        note: deliveryNoteFromMetadata(delivery.delivery_metadata),
      })
    }

    const history = delivery.status_history
    if (Array.isArray(history)) {
      history.forEach((entry, index) => {
        if (!entry || typeof entry !== 'object') return
        const row = entry as Record<string, unknown>
        const histStatus = typeof row.status === 'string' ? row.status : null
        const at =
          typeof row.at === 'string'
            ? row.at
            : typeof row.timestamp === 'string'
              ? row.timestamp
              : typeof row.changed_at === 'string'
                ? row.changed_at
                : null
        if (!histStatus && !at) return
        events.push({
          id: `${delivery.id ?? 'delivery'}-hist-${index}`,
          kind: 'delivery',
          status: histStatus ?? 'update',
          label: histStatus
            ? (DELIVERY_STATUS_DISPLAY[histStatus as DeliveryStatus]?.label ??
              histStatus.replace(/_/g, ' '))
            : 'Shipment update',
          description:
            (typeof row.note === 'string' && row.note) ||
            (typeof row.location === 'string' && row.location) ||
            'Carrier update',
          at,
        })
      })
    }
  }

  const deduped = dedupeTimelineEvents(events)
  deduped.sort((a, b) => {
    const aTime = a.at ? new Date(a.at).getTime() : 0
    const bTime = b.at ? new Date(b.at).getTime() : 0
    if (aTime !== bTime) return aTime - bTime
    return a.id.localeCompare(b.id)
  })

  if (deduped.length > 0) {
    deduped[deduped.length - 1] = { ...deduped[deduped.length - 1], isCurrent: true }
  } else if (input.orderStatus) {
    const display = getOrderStatusDisplay(input.orderStatus)
    deduped.push({
      id: 'current-status',
      kind: 'order',
      status: input.orderStatus,
      label: display.label,
      description: display.description,
      at: null,
      isCurrent: true,
    })
  }

  return deduped
}

function dedupeTimelineEvents(events: CustomerTimelineEvent[]): CustomerTimelineEvent[] {
  const seen = new Set<string>()
  const result: CustomerTimelineEvent[] = []
  for (const event of events) {
    const key = `${event.kind}|${event.status}|${event.at ?? ''}|${event.description}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(event)
  }
  return result
}

export function getOrderProgressPercent(status: string | null | undefined): number {
  if (!status) return 0
  return ORDER_STATUS_PROGRESS[status as OrderStatus] ?? 0
}

export function serializePendingOrderSuccess(snapshot: PendingOrderSuccessSnapshot): string {
  return JSON.stringify(snapshot)
}

export function parsePendingOrderSuccess(
  raw: string | null | undefined,
  now = Date.now(),
): PendingOrderSuccessSnapshot | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PendingOrderSuccessSnapshot
    if (!Array.isArray(parsed.orderIds) || parsed.orderIds.length === 0) return null
    if (typeof parsed.createdAt !== 'number') return null
    if (now - parsed.createdAt > PENDING_ORDER_SUCCESS_TTL_MS) return null
    return {
      orderIds: parsed.orderIds.filter((id): id is string => typeof id === 'string' && !!id),
      orderNumbers: Array.isArray(parsed.orderNumbers)
        ? parsed.orderNumbers.filter((n): n is string => typeof n === 'string')
        : [],
      createdAt: parsed.createdAt,
      paymentMode: parsed.paymentMode ?? null,
      awaitingExternalPayment: Boolean(parsed.awaitingExternalPayment),
      checkoutGroupId:
        typeof parsed.checkoutGroupId === 'string' && parsed.checkoutGroupId
          ? parsed.checkoutGroupId
          : null,
      checkoutUrl:
        typeof parsed.checkoutUrl === 'string' && parsed.checkoutUrl ? parsed.checkoutUrl : null,
    }
  } catch {
    return null
  }
}

export function isPendingOrderSuccessExpired(
  snapshot: PendingOrderSuccessSnapshot | null | undefined,
  now = Date.now(),
): boolean {
  if (!snapshot) return true
  return now - snapshot.createdAt > PENDING_ORDER_SUCCESS_TTL_MS
}

export function supportIssueTypeOptions(): Array<{ value: OrderIssueType; label: string }> {
  return [
    { value: ORDER_ISSUE_TYPE.DELIVERY_DELAY, label: 'Delivery delay' },
    { value: ORDER_ISSUE_TYPE.WRONG_ITEM, label: 'Wrong item' },
    { value: ORDER_ISSUE_TYPE.MISSING_ITEM, label: 'Missing item' },
    { value: ORDER_ISSUE_TYPE.DAMAGED_ITEM, label: 'Damaged item' },
    { value: ORDER_ISSUE_TYPE.PAYMENT_ISSUE, label: 'Payment issue' },
    { value: ORDER_ISSUE_TYPE.SHIPPING_ISSUE, label: 'Shipping issue' },
    { value: ORDER_ISSUE_TYPE.CUSTOMER_COMPLAINT, label: 'Other complaint' },
    { value: ORDER_ISSUE_TYPE.OTHER, label: 'Something else' },
  ]
}

export function returnReasonOptions(): Array<{ value: string; label: string }> {
  return [
    { value: 'defective', label: 'Item arrived defective or damaged' },
    { value: 'wrong_item', label: 'Wrong item received' },
    { value: 'not_as_described', label: 'Not as described' },
    { value: 'size_fit', label: 'Size / fit issue' },
    { value: 'changed_mind', label: 'Changed my mind' },
    { value: 'other', label: 'Something else' },
  ]
}

export type ReorderItemLike = {
  id: string
  listing_id: string
  quantity: number
  listing_active: boolean
  available_stock: number | null
}

export type ReorderCandidateLike<T extends ReorderItemLike = ReorderItemLike> = {
  item: T
  eligible: boolean
  reason: string | null
}

/** Decide which purchased lines can be re-added to cart (pure). */
export function evaluateReorderCandidates<T extends ReorderItemLike>(
  items: T[],
): {
  eligible: T[]
  skipped: ReorderCandidateLike<T>[]
  candidates: ReorderCandidateLike<T>[]
} {
  const candidates: ReorderCandidateLike<T>[] = items.map((item) => {
    if (!item.listing_id) {
      return { item, eligible: false, reason: 'Listing no longer available' }
    }
    if (!item.listing_active) {
      return { item, eligible: false, reason: 'Listing is unavailable' }
    }
    if (item.available_stock != null && item.available_stock <= 0) {
      return { item, eligible: false, reason: 'Out of stock' }
    }
    if (
      item.available_stock != null &&
      item.available_stock > 0 &&
      item.quantity > item.available_stock
    ) {
      return {
        item: { ...item, quantity: item.available_stock },
        eligible: true,
        reason: `Only ${item.available_stock} left — quantity adjusted`,
      }
    }
    return { item, eligible: true, reason: null }
  })

  return {
    eligible: candidates.filter((c) => c.eligible).map((c) => c.item),
    skipped: candidates.filter((c) => !c.eligible),
    candidates,
  }
}
