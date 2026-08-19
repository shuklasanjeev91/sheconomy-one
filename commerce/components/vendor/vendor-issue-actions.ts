/**
 * Vendor order-issue action model.
 *
 * Turns an issue's type + current status into the concrete buttons a vendor can
 * press. Two families exist, because the backend treats them differently:
 *
 *  - **Decision requests** (cancellation / return / refund) are answered with
 *    accept or reject through `resolve_order_issue_request`, which also applies
 *    the side effects (cancelling items, moving refunds along). A vendor must
 *    answer these before anything else, so they short-circuit the list.
 *  - **Support issues** (damage, wrong item, delays, complaints) move along the
 *    issue status machine in `order-issue.utils` via `updateIssueStatus`.
 *
 * Both paths are re-validated server-side; this is purely for shaping the UI.
 */

import { ISSUE_STATUS, ORDER_ISSUE_TYPE, type IssueStatus } from '~/lib/orders/order.constants'
import {
  getNextIssueStatuses,
  isCancellationIssueType,
  isDecisionIssueType,
  isExchangeIssueType,
  isOpenIssueStatus,
  isReturnIssueType,
} from '~/lib/orders/order-issue.utils'
import { canAssignReturnTracking } from '~/commerce/lib/customer-order-lifecycle'

import type { OrderActionTone } from '~/commerce/components/vendor/vendor-order-actions'

export type VendorIssueLike = {
  status?: string | null
  issue_type?: string | null
  resolution_action?: string | null
  order_item_id?: string | null
  return_tracking_number?: string | null
  return_shipping_mode?: string | null
  return_courier_slug?: string | null
  reject_reason_code?: string | null
}

type ActionBase = {
  key: string
  label: string
  tone: OrderActionTone
  /** Lucide icon name (without the `Icon` suffix). */
  icon: string
  /** One-line explanation of what pressing this does. */
  hint: string
}

export type VendorIssueAction =
  | (ActionBase & { kind: 'decision'; decision: 'accept' | 'reject' })
  | (ActionBase & { kind: 'status'; target: IssueStatus; requiresNote: boolean })
  | (ActionBase & { kind: 'return-received' })
  | (ActionBase & { kind: 'assign-return-tracking' })
  | (ActionBase & { kind: 'ship-replacement' })

/** Accept/reject copy differs per request type so the stakes stay obvious. */
const DECISION_COPY: Record<
  string,
  { accept: string; reject: string; acceptHint: string; rejectHint: string }
> = {
  [ORDER_ISSUE_TYPE.CANCELLATION_REQUEST]: {
    accept: 'Approve cancellation',
    reject: 'Decline cancellation',
    acceptHint: 'Cancels the item and releases the reserved stock.',
    rejectHint: 'Keeps the order active — tell the customer why.',
  },
  [ORDER_ISSUE_TYPE.RETURN_REQUEST]: {
    accept: 'Approve + book pickup',
    reject: 'Decline return',
    acceptHint: 'Auto-books the reverse pickup and refunds once it is delivered back.',
    rejectHint: 'Rejects the return — pick a reason so the customer understands.',
  },
  [ORDER_ISSUE_TYPE.EXCHANGE_REQUEST]: {
    accept: 'Approve + book pickup',
    reject: 'Decline exchange',
    acceptHint: 'Auto-books the reverse pickup; ship the replacement once it is delivered back.',
    rejectHint: 'Rejects the exchange — pick a reason so the customer understands.',
  },
  [ORDER_ISSUE_TYPE.REFUND_REQUEST]: {
    accept: 'Approve refund',
    reject: 'Decline refund',
    acceptHint: 'Moves the refund into processing for payout.',
    rejectHint: 'Rejects the refund — pick a reason so the customer understands.',
  },
}

const STATUS_COPY: Partial<
  Record<IssueStatus, { label: string; tone: OrderActionTone; icon: string; hint: string; requiresNote: boolean }>
> = {
  [ISSUE_STATUS.IN_PROGRESS]: {
    label: 'Start working',
    tone: 'primary',
    icon: 'Clock',
    hint: 'Tells the customer someone is on it.',
    requiresNote: false,
  },
  [ISSUE_STATUS.WAITING_CUSTOMER]: {
    label: 'Ask customer',
    tone: 'outline',
    icon: 'MessageSquare',
    hint: 'Pauses the clock until the customer replies.',
    requiresNote: true,
  },
  [ISSUE_STATUS.ESCALATED]: {
    label: 'Escalate to support',
    tone: 'outline',
    icon: 'Flag',
    hint: 'Hands the case to the platform team.',
    requiresNote: true,
  },
  [ISSUE_STATUS.RESOLVED]: {
    label: 'Mark resolved',
    tone: 'success',
    icon: 'CheckCircle',
    hint: 'Records how you fixed it and notifies the customer.',
    requiresNote: true,
  },
  [ISSUE_STATUS.CLOSED]: {
    label: 'Close issue',
    tone: 'outline',
    icon: 'Archive',
    hint: 'Closes the case with no further action.',
    requiresNote: false,
  },
}

/**
 * An approved return/exchange where the goods have not been checked in yet — the
 * vendor still owes a "return received" confirmation to release the refund or
 * ship the replacement.
 */
export function isReturnAwaitingGoods(issue: VendorIssueLike): boolean {
  if (!isReturnIssueType(issue.issue_type) && !isExchangeIssueType(issue.issue_type)) return false
  if (issue.resolution_action === 'return_received') return false
  if (issue.resolution_action === 'exchange_ready_to_ship') return false
  return (
    issue.status === ISSUE_STATUS.RESOLVED ||
    issue.status === ISSUE_STATUS.WAITING_CUSTOMER ||
    issue.resolution_action === 'accepted'
  )
}

export function isExchangeReadyToShip(issue: VendorIssueLike): boolean {
  return isExchangeIssueType(issue.issue_type) && issue.resolution_action === 'exchange_ready_to_ship'
}

/** Whether this issue still needs the vendor to do something. */
export function issueNeedsVendorAction(issue: VendorIssueLike): boolean {
  return (
    isOpenIssueStatus(issue.status) ||
    isReturnAwaitingGoods(issue) ||
    isExchangeReadyToShip(issue)
  )
}

export function getVendorIssueActions(issue: VendorIssueLike): VendorIssueAction[] {
  // An unanswered accept/reject request blocks everything else.
  if (
    isDecisionIssueType(issue.issue_type) &&
    isOpenIssueStatus(issue.status) &&
    issue.resolution_action !== 'accepted'
  ) {
    const copy =
      DECISION_COPY[issue.issue_type as string] ??
      DECISION_COPY[ORDER_ISSUE_TYPE.CANCELLATION_REQUEST]
    return [
      {
        kind: 'decision',
        key: 'accept',
        label: copy.accept,
        tone: 'success',
        icon: 'Check',
        decision: 'accept',
        hint: copy.acceptHint,
      },
      {
        kind: 'decision',
        key: 'reject',
        label: copy.reject,
        tone: 'destructive',
        icon: 'X',
        decision: 'reject',
        hint: copy.rejectHint,
      },
    ]
  }

  if (isExchangeReadyToShip(issue) && issue.order_item_id) {
    return [
      {
        kind: 'ship-replacement',
        key: 'ship-replacement',
        label: 'Ship replacement',
        tone: 'primary',
        icon: 'Truck',
        hint: 'Open Add Tracking for the replacement line item.',
      },
    ]
  }

  if (isReturnAwaitingGoods(issue) && issue.order_item_id) {
    const isExchange = isExchangeIssueType(issue.issue_type)
    const actions: VendorIssueAction[] = []

    if (canAssignReturnTracking(issue)) {
      actions.push({
        kind: 'assign-return-tracking',
        key: 'assign-return-tracking',
        label: 'Arrange pickup manually',
        tone: 'primary',
        icon: 'Truck',
        hint: 'Auto-booking was unavailable — pick a courier and paste the return AWB.',
      })
    }

    if (issue.return_tracking_number) {
      actions.push({
        kind: 'return-received',
        key: 'return-received',
        label: isExchange ? 'Confirm exchange received' : 'Confirm return received',
        tone: 'success',
        icon: 'PackageCheck',
        hint: isExchange
          ? 'Checks the item in and creates a replacement line ready to ship.'
          : 'Checks the item back in and sends the refund to the payment gateway.',
      })
    } else {
      // Still allow confirm if goods arrived without AWB (local drop-off).
      actions.push({
        kind: 'return-received',
        key: 'return-received',
        label: isExchange ? 'Confirm exchange received' : 'Confirm return received',
        tone: 'outline',
        icon: 'PackageCheck',
        hint: isExchange
          ? 'Use when the item is already with you — then ship the replacement.'
          : 'Use when the item is already with you — refund goes to the payment gateway.',
      })
    }

    return actions
  }

  return getNextIssueStatuses(issue.status)
    .map((target): VendorIssueAction | null => {
      const copy = STATUS_COPY[target]
      if (!copy) return null
      // Re-entering `in_progress` from a resolved issue is a reopen, not a start.
      const reopening = target === ISSUE_STATUS.IN_PROGRESS && issue.status === ISSUE_STATUS.RESOLVED
      return {
        kind: 'status',
        key: `status-${target}`,
        label: reopening ? 'Reopen issue' : copy.label,
        tone: reopening ? 'outline' : copy.tone,
        icon: reopening ? 'RotateCcw' : copy.icon,
        target,
        requiresNote: copy.requiresNote,
        hint: reopening ? 'Puts the case back into your queue.' : copy.hint,
      }
    })
    .filter((action): action is VendorIssueAction => action !== null)
}

/** Short badge / filter chip for the issues queue. */
export function vendorIssueBadge(issue: VendorIssueLike): string | null {
  if (
    isDecisionIssueType(issue.issue_type) &&
    isOpenIssueStatus(issue.status) &&
    issue.resolution_action !== 'accepted'
  ) {
    if (isExchangeIssueType(issue.issue_type)) return 'Needs decision'
    if (isReturnIssueType(issue.issue_type)) return 'Needs decision'
    if (isCancellationIssueType(issue.issue_type)) return 'Needs decision'
  }
  if (isExchangeReadyToShip(issue)) return 'Ship replacement'
  if (canAssignReturnTracking(issue)) return 'Needs pickup'
  if (isReturnAwaitingGoods(issue) && issue.return_tracking_number) return 'Confirm received'
  if (isReturnAwaitingGoods(issue)) return 'Return in transit'
  return null
}

/** Short banner copy for the issue queue, or null when nothing is urgent. */
export function issueAttentionMessage(issue: VendorIssueLike): string | null {
  if (isCancellationIssueType(issue.issue_type) && isOpenIssueStatus(issue.status) && issue.resolution_action !== 'accepted') {
    return 'Cancellation request — answer this before you ship.'
  }
  if (isReturnIssueType(issue.issue_type) && isOpenIssueStatus(issue.status) && issue.resolution_action !== 'accepted') {
    return 'Return request — approve or decline to unblock the customer.'
  }
  if (isExchangeIssueType(issue.issue_type) && isOpenIssueStatus(issue.status) && issue.resolution_action !== 'accepted') {
    return 'Exchange request — approve or decline to unblock the customer.'
  }
  if (isExchangeReadyToShip(issue)) {
    return 'Exchange ready — add tracking on the replacement item.'
  }
  if (canAssignReturnTracking(issue)) {
    return isExchangeIssueType(issue.issue_type)
      ? 'Exchange approved — auto-pickup unavailable, arrange it manually.'
      : 'Return approved — auto-pickup unavailable, arrange it manually.'
  }
  if (isReturnAwaitingGoods(issue) && issue.return_tracking_number) {
    return isExchangeIssueType(issue.issue_type)
      ? 'Return in transit — confirm the goods arrived to prepare the replacement.'
      : 'Return in transit — confirm the goods arrived to release the refund.'
  }
  if (isReturnAwaitingGoods(issue)) {
    return isExchangeIssueType(issue.issue_type)
      ? 'Exchange approved — confirm the goods arrived to prepare the replacement.'
      : 'Return approved — confirm the goods arrived to release the refund.'
  }
  return null
}
