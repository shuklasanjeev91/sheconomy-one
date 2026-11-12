/**
 * Vendor order-item action model.
 *
 * Turns an item's current status into the concrete buttons a vendor can press,
 * validated against the shared status machine (`getNextPossibleStatuses`). The
 * store still re-validates every transition, so this is purely for shaping the
 * UI (labels / tones / which targets to surface).
 */

import { ORDER_STATUS, type OrderStatus } from '~/lib/orders/order.constants'
import { getNextPossibleStatuses } from '~/lib/orders/order.utils'
import type { UserRole } from '~/lib/profile/profile.type'

export type OrderActionTone = 'primary' | 'success' | 'destructive' | 'outline'

export type VendorOrderActionKind = 'status' | 'fulfill'

export type VendorOrderAction = {
  key: string
  label: string
  target: OrderStatus
  tone: OrderActionTone
  /** Lucide icon name (without the `Icon` suffix). */
  icon: string
  /**
   * `fulfill` = Amazon-style buy label + auto tracking (EasyShip).
   * `status` = plain status transition.
   */
  kind?: VendorOrderActionKind
}

/** Human copy for advancing an item to a given status. */
const ADVANCE_LABELS: Partial<Record<OrderStatus, string>> = {
  [ORDER_STATUS.CONFIRMED]: 'Accept',
  [ORDER_STATUS.PROCESSING]: 'Start packing',
  [ORDER_STATUS.SHIPPED]: 'Fulfill',
  [ORDER_STATUS.IN_TRANSIT]: 'In transit',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Out for delivery',
  [ORDER_STATUS.DELIVERED]: 'Delivered',
  [ORDER_STATUS.COMPLETED]: 'Complete Order',
}

const ADVANCE_ICONS: Partial<Record<OrderStatus, string>> = {
  [ORDER_STATUS.CONFIRMED]: 'Check',
  [ORDER_STATUS.PROCESSING]: 'Package',
  [ORDER_STATUS.SHIPPED]: 'Package',
  [ORDER_STATUS.IN_TRANSIT]: 'Truck',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Truck',
  [ORDER_STATUS.DELIVERED]: 'PackageCheck',
  [ORDER_STATUS.COMPLETED]: 'CheckCircle2',
}

/** The single "forward" status a vendor would advance to from `current`. */
function primaryForwardStatus(current: OrderStatus): OrderStatus | null {
  switch (current) {
    case ORDER_STATUS.PENDING:
      return ORDER_STATUS.CONFIRMED
    case ORDER_STATUS.CONFIRMED:
      return ORDER_STATUS.PROCESSING
    case ORDER_STATUS.PROCESSING:
    case ORDER_STATUS.PARTIALLY_SHIPPED:
      return ORDER_STATUS.SHIPPED
    case ORDER_STATUS.DELIVERED:
      return ORDER_STATUS.COMPLETED
    case ORDER_STATUS.SHIPPED:
    case ORDER_STATUS.IN_TRANSIT:
    case ORDER_STATUS.OUT_FOR_DELIVERY:
    case ORDER_STATUS.AWAITING_PAYMENT:
      return null
    default:
      return null
  }
}

/**
 * Build the list of actions for an item.
 * - Unpaid (`awaiting_payment`): no Accept — seller waits for payment (Reject only).
 * - COD `pending`: Accept / Reject.
 * - `processing`: Fulfill (buy label + auto-add tracking), Amazon-style.
 */
export function getVendorOrderActions(
  status: OrderStatus | string | null | undefined,
  role: UserRole | string | null = 'U',
): VendorOrderAction[] {
  if (!status) return []
  const current = status as OrderStatus
  const allowed = getNextPossibleStatuses(current, role)
  const canReach = (target: OrderStatus) => allowed.includes(target)

  const actions: VendorOrderAction[] = []

  // Online unpaid — do not offer Accept; payment webhook auto-accepts into processing.
  if (current === ORDER_STATUS.AWAITING_PAYMENT) {
    if (canReach(ORDER_STATUS.CANCELLED)) {
      actions.push({
        key: 'reject',
        label: 'Reject',
        target: ORDER_STATUS.CANCELLED,
        tone: 'destructive',
        icon: 'X',
        kind: 'status',
      })
    }
    return actions
  }

  if (current === ORDER_STATUS.PENDING) {
    if (canReach(ORDER_STATUS.CONFIRMED)) {
      actions.push({
        key: 'accept',
        label: 'Accept',
        target: ORDER_STATUS.CONFIRMED,
        tone: 'success',
        icon: 'Check',
        kind: 'status',
      })
    }
    if (canReach(ORDER_STATUS.CANCELLED)) {
      actions.push({
        key: 'reject',
        label: 'Reject',
        target: ORDER_STATUS.CANCELLED,
        tone: 'destructive',
        icon: 'X',
        kind: 'status',
      })
    }
    return actions
  }

  if (
    (current === ORDER_STATUS.PROCESSING || current === ORDER_STATUS.PARTIALLY_SHIPPED) &&
    canReach(ORDER_STATUS.SHIPPED)
  ) {
    actions.push({
      key: 'fulfill',
      label: 'Fulfill',
      target: ORDER_STATUS.SHIPPED,
      tone: 'primary',
      icon: 'Package',
      kind: 'fulfill',
    })
    return actions
  }

  const forward = primaryForwardStatus(current)
  if (forward && canReach(forward)) {
    actions.push({
      key: `advance-${forward}`,
      label: ADVANCE_LABELS[forward] ?? 'Update Status',
      target: forward,
      tone: 'primary',
      icon: ADVANCE_ICONS[forward] ?? 'ArrowRight',
      kind: 'status',
    })
  }

  return actions
}

/** Whether a status still needs vendor attention (drives the "needs action" accent). */
export function isActionableStatus(status: OrderStatus | string | null | undefined): boolean {
  return (
    status === ORDER_STATUS.PENDING ||
    status === ORDER_STATUS.CONFIRMED ||
    status === ORDER_STATUS.PROCESSING
  )
}
