import { getIssuePriorityDisplay, getIssueStatusDisplay } from '~/lib/orders/order-issue.utils'

import { StatusPill, type StatusPillSize } from '~/commerce/components/vendor/StatusPill'

type BadgeProps = {
  /** Show the leading status dot (default true). */
  withDot?: boolean
  size?: StatusPillSize
}

/** Presentational pill for an order-issue status. */
export function IssueStatusBadge({
  status,
  withDot = true,
  size = 'md',
}: BadgeProps & { status: string | null | undefined }) {
  const display = getIssueStatusDisplay(status)
  return <StatusPill label={display.label} tone={display.tone} withDot={withDot} size={size} />
}

/** Presentational pill for an order-issue priority. */
export function IssuePriorityBadge({
  priority,
  withDot = false,
  size = 'sm',
}: BadgeProps & { priority: string | null | undefined }) {
  const display = getIssuePriorityDisplay(priority)
  return <StatusPill label={display.label} tone={display.tone} withDot={withDot} size={size} />
}
