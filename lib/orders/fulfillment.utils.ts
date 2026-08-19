/**
 * Shared, pure fulfillment helpers (no I/O).
 *
 * Companion to `order.utils` for the logistics domain: presentation maps, the
 * fulfillment status machine, and the queue/triage helpers the vendor
 * pick-pack-ship dashboard needs.
 */

import {
  FINAL_FULFILLMENT_STATUSES,
  FULFILLMENT_EVENT_TYPE,
  FULFILLMENT_STATUS,
  PENDING_FULFILLMENT_STATUSES,
  type FulfillmentEventType,
  type FulfillmentStatus,
  type OrderStatusDisplay,
  type OrderStatusTone,
} from '~/lib/orders/order.constants'

// ============= PRESENTATION =============

export const FULFILLMENT_STATUS_DISPLAY: Record<FulfillmentStatus, OrderStatusDisplay> = {
  [FULFILLMENT_STATUS.PENDING]: {
    label: 'Pending',
    tone: 'yellow',
    icon: 'Clock',
    description: 'Queued — not picked yet',
  },
  [FULFILLMENT_STATUS.PROCESSING]: {
    label: 'Picking & Packing',
    tone: 'orange',
    icon: 'Package',
    description: 'Being picked and packed',
  },
  [FULFILLMENT_STATUS.READY_TO_SHIP]: {
    label: 'Ready to Ship',
    tone: 'blue',
    icon: 'PackageCheck',
    description: 'Packed and waiting for carrier pickup',
  },
  [FULFILLMENT_STATUS.SHIPPED]: {
    label: 'Shipped',
    tone: 'purple',
    icon: 'Truck',
    description: 'Handed to the carrier',
  },
  [FULFILLMENT_STATUS.OUT_FOR_DELIVERY]: {
    label: 'Out for Delivery',
    tone: 'green',
    icon: 'Truck',
    description: 'On the way to the customer',
  },
  [FULFILLMENT_STATUS.DELIVERED]: {
    label: 'Delivered',
    tone: 'green',
    icon: 'PackageCheck',
    description: 'Delivered to the customer',
  },
  [FULFILLMENT_STATUS.DELIVERY_FAILED]: {
    label: 'Delivery Failed',
    tone: 'red',
    icon: 'AlertTriangle',
    description: 'A delivery attempt failed',
  },
  [FULFILLMENT_STATUS.RETURNED_TO_SENDER]: {
    label: 'Returned to Sender',
    tone: 'orange',
    icon: 'RotateCcw',
    description: 'Package came back to you',
  },
  [FULFILLMENT_STATUS.CANCELLED]: {
    label: 'Cancelled',
    tone: 'gray',
    icon: 'XCircle',
    description: 'Fulfilment cancelled',
  },
  [FULFILLMENT_STATUS.RETURNED]: {
    label: 'Returned',
    tone: 'orange',
    icon: 'Undo2',
    description: 'Customer returned the goods',
  },
  [FULFILLMENT_STATUS.EXCEPTION]: {
    label: 'Exception',
    tone: 'red',
    icon: 'AlertTriangle',
    description: 'Blocked — needs your attention',
  },
}

/** Progress percentage (0–100) for fulfilment progress bars. */
export const FULFILLMENT_STATUS_PROGRESS: Record<FulfillmentStatus, number> = {
  [FULFILLMENT_STATUS.PENDING]: 10,
  [FULFILLMENT_STATUS.PROCESSING]: 30,
  [FULFILLMENT_STATUS.READY_TO_SHIP]: 50,
  [FULFILLMENT_STATUS.SHIPPED]: 70,
  [FULFILLMENT_STATUS.OUT_FOR_DELIVERY]: 90,
  [FULFILLMENT_STATUS.DELIVERED]: 100,
  [FULFILLMENT_STATUS.DELIVERY_FAILED]: 80,
  [FULFILLMENT_STATUS.RETURNED_TO_SENDER]: 0,
  [FULFILLMENT_STATUS.CANCELLED]: 0,
  [FULFILLMENT_STATUS.RETURNED]: 0,
  [FULFILLMENT_STATUS.EXCEPTION]: 40,
}

const UNKNOWN_FULFILLMENT_DISPLAY: OrderStatusDisplay = {
  label: 'Unknown',
  tone: 'gray',
  icon: 'HelpCircle',
  description: 'Unknown fulfilment status',
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function getFulfillmentStatusDisplay(
  status: FulfillmentStatus | string | null | undefined,
): OrderStatusDisplay {
  if (!status) return UNKNOWN_FULFILLMENT_DISPLAY
  return (
    FULFILLMENT_STATUS_DISPLAY[status as FulfillmentStatus] ?? {
      ...UNKNOWN_FULFILLMENT_DISPLAY,
      label: humanize(String(status)),
    }
  )
}

export function fulfillmentStatusLabel(
  status: FulfillmentStatus | string | null | undefined,
): string {
  return status ? getFulfillmentStatusDisplay(status).label : 'Unknown'
}

export function getFulfillmentProgress(
  status: FulfillmentStatus | string | null | undefined,
): number {
  if (!status) return 0
  return FULFILLMENT_STATUS_PROGRESS[status as FulfillmentStatus] ?? 0
}

export function fulfillmentEventLabel(
  eventType: FulfillmentEventType | string | null | undefined,
): string {
  if (!eventType) return 'Update'
  return humanize(String(eventType))
}

/** `priority_level` is numeric in the schema (1 = highest, 5 = lowest). */
export type FulfillmentPriorityDisplay = {
  label: string
  tone: OrderStatusTone
}

export const FULFILLMENT_PRIORITY_DISPLAY: Record<number, FulfillmentPriorityDisplay> = {
  1: { label: 'Critical', tone: 'red' },
  2: { label: 'High', tone: 'orange' },
  3: { label: 'Normal', tone: 'blue' },
  4: { label: 'Low', tone: 'gray' },
  5: { label: 'Lowest', tone: 'gray' },
}

export const FULFILLMENT_PRIORITY_OPTIONS: { value: number; label: string }[] = Object.entries(
  FULFILLMENT_PRIORITY_DISPLAY,
).map(([value, display]) => ({ value: Number(value), label: display.label }))

export function getFulfillmentPriorityDisplay(
  level: number | null | undefined,
): FulfillmentPriorityDisplay {
  return FULFILLMENT_PRIORITY_DISPLAY[level ?? 3] ?? FULFILLMENT_PRIORITY_DISPLAY[3]
}

// ============= CLASSIFICATION =============

export function isPendingFulfillmentStatus(status: string | null | undefined): boolean {
  return Boolean(status) && (PENDING_FULFILLMENT_STATUSES as string[]).includes(status as string)
}

export function isFinalFulfillmentStatus(status: string | null | undefined): boolean {
  return Boolean(status) && (FINAL_FULFILLMENT_STATUSES as string[]).includes(status as string)
}

export function isFulfillmentException(status: string | null | undefined): boolean {
  return (
    status === FULFILLMENT_STATUS.EXCEPTION || status === FULFILLMENT_STATUS.DELIVERY_FAILED
  )
}

// ============= STATUS MACHINE =============

/**
 * Allowed fulfilment status transitions. Every non-terminal state can drop into
 * `exception` (carrier problem, damaged stock) or `cancelled`, and an exception
 * can be recovered back into the normal flow once resolved.
 */
export const VALID_FULFILLMENT_TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  [FULFILLMENT_STATUS.PENDING]: [
    FULFILLMENT_STATUS.PROCESSING,
    FULFILLMENT_STATUS.EXCEPTION,
    FULFILLMENT_STATUS.CANCELLED,
  ],
  [FULFILLMENT_STATUS.PROCESSING]: [
    FULFILLMENT_STATUS.READY_TO_SHIP,
    FULFILLMENT_STATUS.EXCEPTION,
    FULFILLMENT_STATUS.CANCELLED,
  ],
  [FULFILLMENT_STATUS.READY_TO_SHIP]: [
    FULFILLMENT_STATUS.SHIPPED,
    FULFILLMENT_STATUS.EXCEPTION,
    FULFILLMENT_STATUS.CANCELLED,
  ],
  [FULFILLMENT_STATUS.SHIPPED]: [
    FULFILLMENT_STATUS.OUT_FOR_DELIVERY,
    FULFILLMENT_STATUS.DELIVERED,
    FULFILLMENT_STATUS.DELIVERY_FAILED,
    FULFILLMENT_STATUS.EXCEPTION,
  ],
  [FULFILLMENT_STATUS.OUT_FOR_DELIVERY]: [
    FULFILLMENT_STATUS.DELIVERED,
    FULFILLMENT_STATUS.DELIVERY_FAILED,
    FULFILLMENT_STATUS.EXCEPTION,
  ],
  [FULFILLMENT_STATUS.DELIVERED]: [FULFILLMENT_STATUS.RETURNED],
  [FULFILLMENT_STATUS.DELIVERY_FAILED]: [
    FULFILLMENT_STATUS.OUT_FOR_DELIVERY,
    FULFILLMENT_STATUS.RETURNED_TO_SENDER,
    FULFILLMENT_STATUS.EXCEPTION,
  ],
  [FULFILLMENT_STATUS.EXCEPTION]: [
    FULFILLMENT_STATUS.PROCESSING,
    FULFILLMENT_STATUS.READY_TO_SHIP,
    FULFILLMENT_STATUS.SHIPPED,
    FULFILLMENT_STATUS.CANCELLED,
  ],
  [FULFILLMENT_STATUS.RETURNED_TO_SENDER]: [FULFILLMENT_STATUS.RETURNED],
  [FULFILLMENT_STATUS.RETURNED]: [],
  [FULFILLMENT_STATUS.CANCELLED]: [],
}

export function getNextFulfillmentStatuses(
  current: FulfillmentStatus | string | null | undefined,
): FulfillmentStatus[] {
  if (!current) return []
  return [...(VALID_FULFILLMENT_TRANSITIONS[current as FulfillmentStatus] ?? [])]
}

export function isValidFulfillmentTransition(
  current: FulfillmentStatus | string | null | undefined,
  next: FulfillmentStatus | string | null | undefined,
): boolean {
  if (!current || !next) return false
  return getNextFulfillmentStatuses(current).includes(next as FulfillmentStatus)
}

/** Statuses where a tracking number must exist before the vendor can advance. */
export function requiresTrackingNumber(next: FulfillmentStatus | string | null | undefined): boolean {
  return next === FULFILLMENT_STATUS.SHIPPED
}

/** The event type to record alongside a status change. */
export function eventTypeForStatus(status: FulfillmentStatus | string): FulfillmentEventType {
  if (status === FULFILLMENT_STATUS.EXCEPTION) return FULFILLMENT_EVENT_TYPE.EXCEPTION
  if (status === FULFILLMENT_STATUS.DELIVERY_FAILED) return FULFILLMENT_EVENT_TYPE.DELIVERY_ATTEMPT
  if (status === FULFILLMENT_STATUS.RETURNED || status === FULFILLMENT_STATUS.RETURNED_TO_SENDER) {
    return FULFILLMENT_EVENT_TYPE.RETURN_INITIATED
  }
  return FULFILLMENT_EVENT_TYPE.STATUS_CHANGE
}

// ============= QUEUE / TRIAGE =============

export type FulfillmentLike = {
  id?: string
  fulfillment_number?: string | null
  fulfillment_status?: string | null
  priority_level?: number | null
  estimated_ship_date?: string | null
  estimated_delivery_date?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  tracking_number?: string | null
  last_failure_reason?: string | null
  quantity_to_fulfill?: number | null
  quantity_fulfilled?: number | null
  created_at?: string | null
}

export type FulfillmentControlLane =
  | 'pick_now'
  | 'pack_now'
  | 'ready_to_ship'
  | 'in_transit'
  | 'exception'
  | 'done'

export type FulfillmentControlBlockerTone = 'info' | 'warning' | 'danger'

export type FulfillmentControlBlocker = {
  id: string
  label: string
  tone: FulfillmentControlBlockerTone
}

export type FulfillmentControlRow = {
  lane: FulfillmentControlLane
  laneLabel: string
  readinessLabel: string
  blockers: FulfillmentControlBlocker[]
  isBatchEligible: boolean
  needsAttention: boolean
}

export type FulfillmentControlSummary = Record<FulfillmentControlLane, number>

export const FULFILLMENT_CONTROL_LANE_LABELS: Record<FulfillmentControlLane, string> = {
  pick_now: 'Pick now',
  pack_now: 'Pack now',
  ready_to_ship: 'Ready to ship',
  in_transit: 'In transit',
  exception: 'Exceptions',
  done: 'Done',
}

/** Not shipped and past its promised ship date. */
export function isOverdueToShip(fulfillment: FulfillmentLike, now = Date.now()): boolean {
  if (fulfillment.shipped_at) return false
  if (isFinalFulfillmentStatus(fulfillment.fulfillment_status)) return false
  if (!fulfillment.estimated_ship_date) return false
  const dueMs = new Date(fulfillment.estimated_ship_date).getTime()
  return Number.isFinite(dueMs) && dueMs < now
}

/** Shipped but past its promised delivery date without a delivery record. */
export function isOverdueToDeliver(fulfillment: FulfillmentLike, now = Date.now()): boolean {
  if (fulfillment.delivered_at) return false
  if (isFinalFulfillmentStatus(fulfillment.fulfillment_status)) return false
  if (!fulfillment.estimated_delivery_date) return false
  const dueMs = new Date(fulfillment.estimated_delivery_date).getTime()
  return Number.isFinite(dueMs) && dueMs < now
}

export function isOverdueFulfillment(fulfillment: FulfillmentLike, now = Date.now()): boolean {
  return isOverdueToShip(fulfillment, now) || isOverdueToDeliver(fulfillment, now)
}

/** Whether the vendor still has work to do on this fulfilment. */
export function needsVendorAction(fulfillment: FulfillmentLike): boolean {
  return (
    isPendingFulfillmentStatus(fulfillment.fulfillment_status) ||
    isFulfillmentException(fulfillment.fulfillment_status)
  )
}

export function getFulfillmentControlLane(fulfillment: FulfillmentLike): FulfillmentControlLane {
  const status = fulfillment.fulfillment_status
  if (status === FULFILLMENT_STATUS.PENDING) return 'pick_now'
  if (status === FULFILLMENT_STATUS.PROCESSING) return 'pack_now'
  if (status === FULFILLMENT_STATUS.READY_TO_SHIP) return 'ready_to_ship'
  if (
    status === FULFILLMENT_STATUS.SHIPPED ||
    status === FULFILLMENT_STATUS.OUT_FOR_DELIVERY
  ) {
    return 'in_transit'
  }
  if (
    status === FULFILLMENT_STATUS.DELIVERED ||
    status === FULFILLMENT_STATUS.CANCELLED ||
    status === FULFILLMENT_STATUS.RETURNED ||
    status === FULFILLMENT_STATUS.RETURNED_TO_SENDER
  ) {
    return 'done'
  }
  return 'exception'
}

export function getFulfillmentControlBlockers(
  fulfillment: FulfillmentLike,
  now = Date.now(),
): FulfillmentControlBlocker[] {
  const blockers: FulfillmentControlBlocker[] = []
  const lane = getFulfillmentControlLane(fulfillment)
  const outstanding = outstandingQuantity(fulfillment)

  if (isOverdueFulfillment(fulfillment, now)) {
    blockers.push({
      id: 'overdue',
      label:
        lane === 'in_transit' ? 'Past promised delivery date' : 'Past promised ship date',
      tone: 'danger',
    })
  }

  if (
    (fulfillment.fulfillment_status === FULFILLMENT_STATUS.READY_TO_SHIP ||
      fulfillment.fulfillment_status === FULFILLMENT_STATUS.SHIPPED) &&
    !fulfillment.tracking_number
  ) {
    blockers.push({
      id: 'missing_tracking',
      label: 'Tracking number missing',
      tone: 'warning',
    })
  }

  if (lane === 'exception' && fulfillment.last_failure_reason) {
    blockers.push({
      id: 'exception_reason',
      label: fulfillment.last_failure_reason,
      tone: 'danger',
    })
  }

  if (
    lane !== 'done' &&
    lane !== 'in_transit' &&
    outstanding > 0 &&
    Number(fulfillment.quantity_fulfilled ?? 0) > 0
  ) {
    blockers.push({
      id: 'partial_pick',
      label: `${outstanding} unit${outstanding === 1 ? '' : 's'} still outstanding`,
      tone: 'info',
    })
  }

  return blockers
}

export function getFulfillmentControlRow(
  fulfillment: FulfillmentLike,
  now = Date.now(),
): FulfillmentControlRow {
  const lane = getFulfillmentControlLane(fulfillment)
  const blockers = getFulfillmentControlBlockers(fulfillment, now)
  return {
    lane,
    laneLabel: FULFILLMENT_CONTROL_LANE_LABELS[lane],
    readinessLabel:
      lane === 'pick_now'
        ? 'Waiting to be picked'
        : lane === 'pack_now'
          ? 'Picking in progress'
          : lane === 'ready_to_ship'
            ? 'Packed and ready for carrier handoff'
            : lane === 'in_transit'
              ? 'Carrier updates in progress'
              : lane === 'done'
                ? 'No further handling required'
                : 'Needs manual intervention',
    blockers,
    isBatchEligible: lane === 'ready_to_ship' && blockers.every((blocker) => blocker.id !== 'missing_tracking'),
    needsAttention: lane === 'exception' || blockers.some((blocker) => blocker.tone === 'danger'),
  }
}

export function summarizeFulfillmentControlLanes(
  fulfillments: FulfillmentLike[],
  now = Date.now(),
): FulfillmentControlSummary {
  const summary: FulfillmentControlSummary = {
    pick_now: 0,
    pack_now: 0,
    ready_to_ship: 0,
    in_transit: 0,
    exception: 0,
    done: 0,
  }

  for (const fulfillment of fulfillments) {
    summary[getFulfillmentControlLane(fulfillment)] += 1
    if (getFulfillmentControlRow(fulfillment, now).needsAttention && summary.exception >= 0) {
      // already captured by lane for true exceptions; overdue ship risk stays in its work lane
    }
  }
  return summary
}

export function filterFulfillmentsByControlLane<T extends FulfillmentLike>(
  fulfillments: T[],
  lane: FulfillmentControlLane | 'all',
  now = Date.now(),
): T[] {
  if (lane === 'all') return fulfillments
  return fulfillments.filter((fulfillment) => getFulfillmentControlRow(fulfillment, now).lane === lane)
}

export function canExportFulfillmentShipList(fulfillments: FulfillmentLike[], now = Date.now()): boolean {
  return fulfillments.length > 0 && fulfillments.every((fulfillment) => getFulfillmentControlRow(fulfillment, now).isBatchEligible)
}

export function fulfillmentsToShipListCsv<T extends FulfillmentLike & {
  order_items?: { orders?: { order_number?: string | null } | null; product_title?: string | null } | null
}>(
  fulfillments: T[],
): string {
  if (!fulfillments.length) return ''
  const rows = [
    ['Fulfillment', 'Order', 'Product', 'Lane', 'Tracking', 'Est ship date'],
    ...fulfillments.map((fulfillment) => [
      fulfillment.fulfillment_number ?? fulfillment.id ?? '—',
      fulfillment.order_items?.orders?.order_number ?? '—',
      fulfillment.order_items?.product_title ?? 'Product',
      getFulfillmentControlLane(fulfillment).replace(/_/g, ' '),
      fulfillment.tracking_number ?? '—',
      fulfillment.estimated_ship_date ?? '—',
    ]),
  ]
  return rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n')
}

/** Sort key for the pick-pack queue: exceptions and overdue work first. */
export function fulfillmentUrgencyRank(fulfillment: FulfillmentLike, now = Date.now()): number {
  const exception = isFulfillmentException(fulfillment.fulfillment_status) ? 1 : 0
  const overdue = isOverdueFulfillment(fulfillment, now) ? 1 : 0
  const actionable = needsVendorAction(fulfillment) ? 1 : 0
  // `priority_level` is inverted (1 = highest), so flip it into a weight.
  const priority = 6 - (fulfillment.priority_level ?? 3)
  return exception * 1000 + overdue * 500 + actionable * 100 + priority * 10
}

export function sortFulfillmentsByUrgency<T extends FulfillmentLike>(
  fulfillments: T[],
  now = Date.now(),
): T[] {
  return [...fulfillments].sort((a, b) => {
    const rankDiff = fulfillmentUrgencyRank(b, now) - fulfillmentUrgencyRank(a, now)
    if (rankDiff !== 0) return rankDiff
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return aTime - bTime
  })
}

export type FulfillmentQueueSummary = {
  total: number
  toPack: number
  readyToShip: number
  inTransit: number
  exceptions: number
  overdue: number
  delivered: number
}

/** Counts for the vendor fulfilments header (over whatever page is loaded). */
export function summarizeFulfillmentQueue(
  fulfillments: FulfillmentLike[],
  now = Date.now(),
): FulfillmentQueueSummary {
  const summary: FulfillmentQueueSummary = {
    total: fulfillments.length,
    toPack: 0,
    readyToShip: 0,
    inTransit: 0,
    exceptions: 0,
    overdue: 0,
    delivered: 0,
  }

  for (const fulfillment of fulfillments) {
    const status = fulfillment.fulfillment_status
    if (status === FULFILLMENT_STATUS.PENDING || status === FULFILLMENT_STATUS.PROCESSING) {
      summary.toPack += 1
    }
    if (status === FULFILLMENT_STATUS.READY_TO_SHIP) summary.readyToShip += 1
    if (status === FULFILLMENT_STATUS.SHIPPED || status === FULFILLMENT_STATUS.OUT_FOR_DELIVERY) {
      summary.inTransit += 1
    }
    if (isFulfillmentException(status)) summary.exceptions += 1
    if (isOverdueFulfillment(fulfillment, now)) summary.overdue += 1
    if (status === FULFILLMENT_STATUS.DELIVERED) summary.delivered += 1
  }

  return summary
}

/** Remaining units still to fulfil on a record. */
export function outstandingQuantity(fulfillment: {
  quantity_to_fulfill?: number | null
  quantity_fulfilled?: number | null
}): number {
  const target = Number(fulfillment.quantity_to_fulfill ?? 0)
  const done = Number(fulfillment.quantity_fulfilled ?? 0)
  return Math.max(0, target - done)
}
