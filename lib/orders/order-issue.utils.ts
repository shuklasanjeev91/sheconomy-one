/**
 * Shared, pure order-issue helpers (no I/O).
 *
 * Companion to `order.utils` for the disputes domain: presentation maps, the
 * issue status machine, and the triage helpers vendor/admin dashboards need.
 *
 * `order_issues.issue_type` / `issue_priority` / `status` are plain strings in
 * the DB, so every map below is keyed off the canonical value sets in
 * `order.constants` and falls back gracefully for unknown values.
 */

import {
  CLOSED_ISSUE_STATUSES,
  HIGH_ISSUE_PRIORITIES,
  ISSUE_PRIORITY,
  ISSUE_STATUS,
  OPEN_ISSUE_STATUSES,
  ORDER_ISSUE_TYPE,
  type IssuePriority,
  type IssueStatus,
  type OrderIssueType,
  type OrderStatusDisplay,
  type OrderStatusTone,
} from '~/lib/orders/order.constants'

// ============= PRESENTATION =============

export const ISSUE_STATUS_DISPLAY: Record<IssueStatus, OrderStatusDisplay> = {
  [ISSUE_STATUS.OPEN]: {
    label: 'Open',
    tone: 'red',
    icon: 'AlertCircle',
    description: 'Waiting for a first response',
  },
  [ISSUE_STATUS.ASSIGNED]: {
    label: 'Assigned',
    tone: 'blue',
    icon: 'UserCheck',
    description: 'Picked up by someone on the team',
  },
  [ISSUE_STATUS.IN_PROGRESS]: {
    label: 'In Progress',
    tone: 'orange',
    icon: 'Clock',
    description: 'Being worked on right now',
  },
  [ISSUE_STATUS.WAITING_CUSTOMER]: {
    label: 'Waiting on Customer',
    tone: 'yellow',
    icon: 'MessageSquare',
    description: 'Paused until the customer replies',
  },
  [ISSUE_STATUS.ESCALATED]: {
    label: 'Escalated',
    tone: 'purple',
    icon: 'Flag',
    description: 'Handed to platform support',
  },
  [ISSUE_STATUS.RESOLVED]: {
    label: 'Resolved',
    tone: 'green',
    icon: 'CheckCircle',
    description: 'A resolution was agreed with the customer',
  },
  [ISSUE_STATUS.CLOSED]: {
    label: 'Closed',
    tone: 'gray',
    icon: 'Archive',
    description: 'Closed with no further action',
  },
  [ISSUE_STATUS.CANCELLED]: {
    label: 'Cancelled',
    tone: 'gray',
    icon: 'XCircle',
    description: 'Withdrawn by the customer',
  },
}

export type IssuePriorityDisplay = {
  label: string
  tone: OrderStatusTone
  /** Sort weight — higher is more urgent. */
  weight: number
}

export const ISSUE_PRIORITY_DISPLAY: Record<IssuePriority, IssuePriorityDisplay> = {
  [ISSUE_PRIORITY.LOW]: { label: 'Low', tone: 'gray', weight: 1 },
  [ISSUE_PRIORITY.MEDIUM]: { label: 'Medium', tone: 'blue', weight: 2 },
  [ISSUE_PRIORITY.NORMAL]: { label: 'Normal', tone: 'blue', weight: 2 },
  [ISSUE_PRIORITY.HIGH]: { label: 'High', tone: 'orange', weight: 3 },
  [ISSUE_PRIORITY.URGENT]: { label: 'Urgent', tone: 'red', weight: 4 },
  [ISSUE_PRIORITY.CRITICAL]: { label: 'Critical', tone: 'red', weight: 5 },
}

/** Labels that read better than a naive de-underscore of the raw value. */
const ISSUE_TYPE_LABELS: Partial<Record<OrderIssueType, string>> = {
  [ORDER_ISSUE_TYPE.CANCELLATION_REQUEST]: 'Cancellation request',
  [ORDER_ISSUE_TYPE.RETURN_REQUEST]: 'Return request',
  [ORDER_ISSUE_TYPE.REFUND_REQUEST]: 'Refund request',
  [ORDER_ISSUE_TYPE.EXCHANGE_REQUEST]: 'Exchange request',
  [ORDER_ISSUE_TYPE.CUSTOMER_COMPLAINT]: 'Customer complaint',
  [ORDER_ISSUE_TYPE.OTHER]: 'Other',
}

/** Title-case a snake_case enum value ("wrong_item" → "Wrong Item"). */
function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

const UNKNOWN_ISSUE_STATUS_DISPLAY: OrderStatusDisplay = {
  label: 'Unknown',
  tone: 'gray',
  icon: 'HelpCircle',
  description: 'Unknown issue status',
}

export function getIssueStatusDisplay(
  status: IssueStatus | string | null | undefined,
): OrderStatusDisplay {
  if (!status) return UNKNOWN_ISSUE_STATUS_DISPLAY
  return (
    ISSUE_STATUS_DISPLAY[status as IssueStatus] ?? {
      ...UNKNOWN_ISSUE_STATUS_DISPLAY,
      label: humanize(String(status)),
    }
  )
}

export function getIssuePriorityDisplay(
  priority: IssuePriority | string | null | undefined,
): IssuePriorityDisplay {
  if (!priority) return ISSUE_PRIORITY_DISPLAY[ISSUE_PRIORITY.NORMAL]
  return (
    ISSUE_PRIORITY_DISPLAY[priority as IssuePriority] ?? {
      label: humanize(String(priority)),
      tone: 'gray',
      weight: 2,
    }
  )
}

export function issueStatusLabel(status: IssueStatus | string | null | undefined): string {
  return status ? getIssueStatusDisplay(status).label : 'Unknown'
}

export function issueTypeLabel(issueType: OrderIssueType | string | null | undefined): string {
  if (!issueType) return 'Issue'
  return ISSUE_TYPE_LABELS[issueType as OrderIssueType] ?? humanize(String(issueType))
}

export function issuePriorityLabel(priority: IssuePriority | string | null | undefined): string {
  return getIssuePriorityDisplay(priority).label
}

// ============= CLASSIFICATION =============

export function isOpenIssueStatus(status: string | null | undefined): boolean {
  return Boolean(status) && (OPEN_ISSUE_STATUSES as string[]).includes(status as string)
}

export function isClosedIssueStatus(status: string | null | undefined): boolean {
  return Boolean(status) && (CLOSED_ISSUE_STATUSES as string[]).includes(status as string)
}

export function isHighIssuePriority(priority: string | null | undefined): boolean {
  return Boolean(priority) && (HIGH_ISSUE_PRIORITIES as string[]).includes(priority as string)
}

export function isCancellationIssueType(issueType: string | null | undefined): boolean {
  return issueType === ORDER_ISSUE_TYPE.CANCELLATION_REQUEST
}

export function isReturnIssueType(issueType: string | null | undefined): boolean {
  return (
    issueType === ORDER_ISSUE_TYPE.RETURN_REQUEST || issueType === ORDER_ISSUE_TYPE.REFUND_REQUEST
  )
}

export function isExchangeIssueType(issueType: string | null | undefined): boolean {
  return issueType === ORDER_ISSUE_TYPE.EXCHANGE_REQUEST
}

/**
 * Request types the vendor answers with an accept/reject decision rather than a
 * free-form status change. These go through `resolve_order_issue_request`, which
 * also applies the downstream side effects (cancelling items, starting refunds);
 * mirrors the type guard inside that function.
 */
export function isDecisionIssueType(issueType: string | null | undefined): boolean {
  return (
    isCancellationIssueType(issueType) ||
    isReturnIssueType(issueType) ||
    isExchangeIssueType(issueType)
  )
}

// ============= STATUS MACHINE =============

/**
 * Allowed issue status transitions. `resolved` can be reopened because a
 * customer may come back on the same complaint; `closed` / `cancelled` are
 * terminal.
 */
export const VALID_ISSUE_STATUS_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  [ISSUE_STATUS.OPEN]: [
    ISSUE_STATUS.IN_PROGRESS,
    ISSUE_STATUS.WAITING_CUSTOMER,
    ISSUE_STATUS.ESCALATED,
    ISSUE_STATUS.RESOLVED,
  ],
  [ISSUE_STATUS.ASSIGNED]: [
    ISSUE_STATUS.IN_PROGRESS,
    ISSUE_STATUS.WAITING_CUSTOMER,
    ISSUE_STATUS.ESCALATED,
    ISSUE_STATUS.RESOLVED,
  ],
  [ISSUE_STATUS.IN_PROGRESS]: [
    ISSUE_STATUS.WAITING_CUSTOMER,
    ISSUE_STATUS.ESCALATED,
    ISSUE_STATUS.RESOLVED,
  ],
  [ISSUE_STATUS.WAITING_CUSTOMER]: [
    ISSUE_STATUS.IN_PROGRESS,
    ISSUE_STATUS.ESCALATED,
    ISSUE_STATUS.RESOLVED,
  ],
  [ISSUE_STATUS.ESCALATED]: [ISSUE_STATUS.IN_PROGRESS, ISSUE_STATUS.RESOLVED],
  [ISSUE_STATUS.RESOLVED]: [ISSUE_STATUS.CLOSED, ISSUE_STATUS.IN_PROGRESS],
  [ISSUE_STATUS.CLOSED]: [],
  [ISSUE_STATUS.CANCELLED]: [],
}

export function getNextIssueStatuses(
  current: IssueStatus | string | null | undefined,
): IssueStatus[] {
  if (!current) return []
  return [...(VALID_ISSUE_STATUS_TRANSITIONS[current as IssueStatus] ?? [])]
}

export function isValidIssueStatusTransition(
  current: IssueStatus | string | null | undefined,
  next: IssueStatus | string | null | undefined,
): boolean {
  if (!current || !next) return false
  return getNextIssueStatuses(current).includes(next as IssueStatus)
}

// ============= TRIAGE =============

/** Hours a new issue may sit untouched before the dashboard flags it. */
export const ISSUE_FIRST_RESPONSE_SLA_HOURS = 24

export type IssueLike = {
  status?: string | null
  issue_priority?: string | null
  issue_type?: string | null
  created_at?: string | null
}

/** Whole hours since the issue was reported (0 when the date is unusable). */
export function issueAgeInHours(
  createdAt: string | null | undefined,
  now = Date.now(),
): number {
  if (!createdAt) return 0
  const createdMs = new Date(createdAt).getTime()
  if (!Number.isFinite(createdMs)) return 0
  return Math.max(0, Math.floor((now - createdMs) / (60 * 60 * 1000)))
}

/** An open issue that has blown through the first-response window. */
export function isOverdueIssue(
  issue: IssueLike,
  now = Date.now(),
  slaHours = ISSUE_FIRST_RESPONSE_SLA_HOURS,
): boolean {
  if (!isOpenIssueStatus(issue.status)) return false
  return issueAgeInHours(issue.created_at, now) >= slaHours
}

/** Sort key for the vendor queue: overdue first, then priority, then oldest. */
export function issueUrgencyRank(issue: IssueLike, now = Date.now()): number {
  const open = isOpenIssueStatus(issue.status) ? 1 : 0
  const overdue = isOverdueIssue(issue, now) ? 1 : 0
  const priority = getIssuePriorityDisplay(issue.issue_priority).weight
  return open * 1000 + overdue * 100 + priority * 10
}

/** Most urgent first — open and overdue issues bubble to the top. */
export function sortIssuesByUrgency<T extends IssueLike>(issues: T[], now = Date.now()): T[] {
  return [...issues].sort((a, b) => {
    const rankDiff = issueUrgencyRank(b, now) - issueUrgencyRank(a, now)
    if (rankDiff !== 0) return rankDiff
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return aTime - bTime
  })
}

export type IssueQueueSummary = {
  total: number
  open: number
  awaitingDecision: number
  overdue: number
  highPriority: number
  resolved: number
}

/** Counts for the vendor issues header (over whatever page is loaded). */
export function summarizeIssueQueue(issues: IssueLike[], now = Date.now()): IssueQueueSummary {
  const summary: IssueQueueSummary = {
    total: issues.length,
    open: 0,
    awaitingDecision: 0,
    overdue: 0,
    highPriority: 0,
    resolved: 0,
  }

  for (const issue of issues) {
    const open = isOpenIssueStatus(issue.status)
    if (open) summary.open += 1
    if (open && isDecisionIssueType(issue.issue_type)) summary.awaitingDecision += 1
    if (isOverdueIssue(issue, now)) summary.overdue += 1
    if (open && isHighIssuePriority(issue.issue_priority)) summary.highPriority += 1
    if (issue.status === ISSUE_STATUS.RESOLVED) summary.resolved += 1
  }

  return summary
}
