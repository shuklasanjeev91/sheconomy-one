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
  type DeliveryStatus,
  type OrderIssueType,
  type OrderStatus,
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
  canSubmitReturnTracking: boolean
  returnTrackingBlockedReason: string | null
  canDownload: boolean
  downloadBlockedReason: string | null
  hasOpenReturnRequest: boolean
  hasOpenExchangeRequest: boolean
  hasReview: boolean
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

/** Accepted return/exchange still waiting for the buyer to add an AWB. */
export function findAcceptedReturnAwaitingTracking<
  T extends {
    issue_type?: string | null
    status?: string | null
    resolution_action?: string | null
    order_item_id?: string | null
    return_tracking_number?: string | null
  },
>(issues: T[] | null | undefined, orderItemId?: string | null): T | null {
  if (!issues?.length) return null
  return (
    issues.find((issue) => {
      if (orderItemId && issue.order_item_id !== orderItemId) return false
      if (issue.return_tracking_number) return false
      const isReturnOrExchange =
        isReturnIssueType(issue.issue_type) || isExchangeIssueType(issue.issue_type)
      if (!isReturnOrExchange) return false
      return (
        issue.resolution_action === 'accepted' ||
        issue.status === 'waiting_customer' ||
        (issue.status === 'resolved' && issue.resolution_action === 'accepted')
      )
    }) ?? null
  )
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
  const awaitingTracking = findAcceptedReturnAwaitingTracking(input.issues, input.orderItemId)
  const activeRefund = (input.refunds ?? []).find(
    (refund) =>
      refund.order_item_id === input.orderItemId &&
      ['requested', 'processing', 'approved', 'completed'].includes(String(refund.refund_status)),
  )
  const hasReview = Boolean(input.hasReview)
  const acceptsReturns = input.acceptsReturns !== false
  const acceptsExchanges = input.acceptsExchanges !== false

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

  let returnTrackingBlockedReason: string | null = null
  if (!awaitingTracking) {
    returnTrackingBlockedReason = 'No approved return or exchange is waiting for tracking.'
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
    canSubmitReturnTracking: !returnTrackingBlockedReason,
    returnTrackingBlockedReason,
    canDownload: !downloadBlockedReason,
    downloadBlockedReason,
    hasOpenReturnRequest: Boolean(openReturn),
    hasOpenExchangeRequest: Boolean(openExchange),
    hasReview,
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
