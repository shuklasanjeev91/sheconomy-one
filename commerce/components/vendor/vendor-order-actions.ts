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

export type VendorOrderAction = {
  key: string
  label: string
  target: OrderStatus
  tone: OrderActionTone
  /** Lucide icon name (without the `Icon` suffix). */
  icon: string
}

/** Human copy for advancing an item to a given status. */
const ADVANCE_LABELS: Partial<Record<OrderStatus, string>> = {
  [ORDER_STATUS.CONFIRMED]: 'Accept',
  [ORDER_STATUS.PROCESSING]: 'Create shipping label',
  [ORDER_STATUS.SHIPPED]: 'Add tracking',
  [ORDER_STATUS.IN_TRANSIT]: 'In transit',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Out for delivery',
  [ORDER_STATUS.DELIVERED]: 'Delivered',
  [ORDER_STATUS.COMPLETED]: 'Complete Order',
}

const ADVANCE_ICONS: Partial<Record<OrderStatus, string>> = {
  [ORDER_STATUS.CONFIRMED]: 'Check',
  [ORDER_STATUS.PROCESSING]: 'Package',
  [ORDER_STATUS.SHIPPED]: 'Truck',
  [ORDER_STATUS.IN_TRANSIT]: 'Truck',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Truck',
  [ORDER_STATUS.DELIVERED]: 'PackageCheck',
  [ORDER_STATUS.COMPLETED]: 'CheckCircle2',
}

/** The single "forward" status a vendor would advance to from `current`. */
function primaryForwardStatus(current: OrderStatus): OrderStatus | null {
  switch (current) {
    case ORDER_STATUS.PENDING:
    case ORDER_STATUS.AWAITING_PAYMENT:
      return ORDER_STATUS.CONFIRMED
    case ORDER_STATUS.CONFIRMED:
      // Paid marketplace orders auto-accept into processing; confirmed is rare (legacy/COD).
      return ORDER_STATUS.PROCESSING
    case ORDER_STATUS.PROCESSING:
    case ORDER_STATUS.PARTIALLY_SHIPPED:
      // Opens label / tracking flow — carrier webhooks advance after ship.
      return ORDER_STATUS.SHIPPED
    case ORDER_STATUS.DELIVERED:
      return ORDER_STATUS.COMPLETED
    case ORDER_STATUS.SHIPPED:
    case ORDER_STATUS.IN_TRANSIT:
    case ORDER_STATUS.OUT_FOR_DELIVERY:
      // Carrier-driven — no vendor button.
      return null
    default:
      return null
  }
}

/**
 * Build the list of actions for an item. `pending` items get an explicit
 * Accept / Reject pair; everything else gets a single "advance" primary action
 * when a forward transition is available.
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

  if (current === ORDER_STATUS.PENDING || current === ORDER_STATUS.AWAITING_PAYMENT) {
    if (canReach(ORDER_STATUS.CONFIRMED)) {
      actions.push({ key: 'accept', label: 'Accept', target: ORDER_STATUS.CONFIRMED, tone: 'success', icon: 'Check' })
    }
    if (canReach(ORDER_STATUS.CANCELLED)) {
      actions.push({ key: 'reject', label: 'Reject', target: ORDER_STATUS.CANCELLED, tone: 'destructive', icon: 'X' })
    }
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
