/**
 * Vendor fulfillment action model.
 *
 * Turns a fulfilment's current status into the pick-pack-ship buttons a vendor
 * can press, validated against the status machine in `fulfillment.utils`. The
 * service re-validates every transition, so this only shapes the UI (labels,
 * tones, and which extra input each step needs).
 */

import {
  FULFILLMENT_DEFAULTS,
  FULFILLMENT_STATUS,
  type FulfillmentStatus,
} from '~/lib/orders/order.constants'
import type { UpdateFulfillmentStatusMetadata } from '~/lib/orders/fulfillment.type'
import {
  getNextFulfillmentStatuses,
  isFulfillmentException,
  requiresTrackingNumber,
} from '~/lib/orders/fulfillment.utils'

import type { OrderActionTone } from '~/commerce/components/vendor/vendor-order-actions'

/** Extra input a step needs before it can be submitted. */
export type FulfillmentActionPrompt = 'none' | 'tracking' | 'reason'

export type VendorFulfillmentAction = {
  key: string
  label: string
  target: FulfillmentStatus
  tone: OrderActionTone
  /** Lucide icon name (without the `Icon` suffix). */
  icon: string
  prompt: FulfillmentActionPrompt
  /** One-line explanation of what pressing this does. */
  hint: string
}

type StatusCopy = {
  label: string
  tone: OrderActionTone
  icon: string
  hint: string
}

/** Happy-path pick/pack only — shipped / OFD / delivered come from courier tracking. */
const ADVANCE_COPY: Partial<Record<FulfillmentStatus, StatusCopy>> = {
  [FULFILLMENT_STATUS.PROCESSING]: {
    label: 'Start picking',
    tone: 'primary',
    icon: 'Package',
    hint: 'Moves this into your pick-and-pack queue.',
  },
  [FULFILLMENT_STATUS.READY_TO_SHIP]: {
    label: 'Mark packed',
    tone: 'primary',
    icon: 'PackageCheck',
    hint: 'Packed and waiting for the carrier to collect. Add tracking from Orders to ship.',
  },
  [FULFILLMENT_STATUS.DELIVERY_FAILED]: {
    label: 'Delivery failed',
    tone: 'destructive',
    icon: 'AlertTriangle',
    hint: 'Logs a failed attempt so the carrier can retry.',
  },
  [FULFILLMENT_STATUS.RETURNED_TO_SENDER]: {
    label: 'Returned to me',
    tone: 'outline',
    icon: 'RotateCcw',
    hint: 'The package came back undelivered.',
  },
  [FULFILLMENT_STATUS.RETURNED]: {
    label: 'Mark returned',
    tone: 'outline',
    icon: 'Undo2',
    hint: 'The customer sent the goods back.',
  },
  [FULFILLMENT_STATUS.EXCEPTION]: {
    label: 'Flag exception',
    tone: 'destructive',
    icon: 'AlertTriangle',
    hint: 'Blocks the fulfilment and records why.',
  },
  [FULFILLMENT_STATUS.CANCELLED]: {
    label: 'Cancel fulfilment',
    tone: 'destructive',
    icon: 'X',
    hint: 'Stops this fulfilment for good.',
  },
}

/** Steps that also need a written reason for the audit trail. */
const REASON_STATUSES: FulfillmentStatus[] = [
  FULFILLMENT_STATUS.EXCEPTION,
  FULFILLMENT_STATUS.CANCELLED,
  FULFILLMENT_STATUS.DELIVERY_FAILED,
  FULFILLMENT_STATUS.RETURNED_TO_SENDER,
  FULFILLMENT_STATUS.RETURNED,
]

function promptFor(target: FulfillmentStatus, hasTracking: boolean): FulfillmentActionPrompt {
  if (requiresTrackingNumber(target) && !hasTracking) return 'tracking'
  if (REASON_STATUSES.includes(target)) return 'reason'
  return 'none'
}

export type VendorFulfillmentLike = {
  fulfillment_status?: string | null
  tracking_number?: string | null
}

/**
 * Actions for a fulfilment, ordered so the happy path comes first and the
 * destructive/exception paths sit at the end.
 */
export function getVendorFulfillmentActions(
  fulfillment: VendorFulfillmentLike,
): VendorFulfillmentAction[] {
  const hasTracking = Boolean(fulfillment.tracking_number?.trim())

  const actions = getNextFulfillmentStatuses(fulfillment.fulfillment_status)
    .map((target): VendorFulfillmentAction | null => {
      const copy = ADVANCE_COPY[target]
      if (!copy) return null
      // Recovering from an exception is a resume, not a fresh step forward.
      const resuming =
        isFulfillmentException(fulfillment.fulfillment_status) &&
        target !== FULFILLMENT_STATUS.CANCELLED
      return {
        key: `advance-${target}`,
        label: resuming ? `Resume — ${copy.label.toLowerCase()}` : copy.label,
        target,
        tone: resuming ? 'primary' : copy.tone,
        icon: copy.icon,
        prompt: promptFor(target, hasTracking),
        hint: resuming ? 'Clears the exception and continues the fulfilment.' : copy.hint,
      }
    })
    .filter((action): action is VendorFulfillmentAction => action !== null)

  const weight = (action: VendorFulfillmentAction) =>
    action.tone === 'destructive' ? 1 : 0
  return actions.sort((a, b) => weight(a) - weight(b))
}

/**
 * Maps the drawer inputs onto the columns `updateFulfillmentStatus` persists for
 * the target status, so each step writes its reason to the right field.
 */
export function fulfillmentActionMetadata(
  action: VendorFulfillmentAction,
  input: { tracking?: string; reason?: string } = {},
): UpdateFulfillmentStatusMetadata {
  const tracking = input.tracking?.trim()
  const reason = input.reason?.trim()
  const metadata: UpdateFulfillmentStatusMetadata = {
    source_system: FULFILLMENT_DEFAULTS.VENDOR_SOURCE_SYSTEM,
  }

  if (tracking && requiresTrackingNumber(action.target)) metadata.tracking_number = tracking
  if (!reason) return metadata

  switch (action.target) {
    case FULFILLMENT_STATUS.EXCEPTION:
    case FULFILLMENT_STATUS.DELIVERY_FAILED:
      metadata.exception_reason = reason
      break
    case FULFILLMENT_STATUS.CANCELLED:
      metadata.cancellation_reason = reason
      break
    case FULFILLMENT_STATUS.RETURNED:
    case FULFILLMENT_STATUS.RETURNED_TO_SENDER:
      metadata.return_reason = reason
      break
    default:
      break
  }

  return metadata
}
