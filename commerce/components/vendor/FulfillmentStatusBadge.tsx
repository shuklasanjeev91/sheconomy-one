import {
  getFulfillmentPriorityDisplay,
  getFulfillmentStatusDisplay,
} from '~/lib/orders/fulfillment.utils'

import { StatusPill, type StatusPillSize } from '~/commerce/components/vendor/StatusPill'

type BadgeProps = {
  /** Show the leading status dot (default true). */
  withDot?: boolean
  size?: StatusPillSize
}

/** Presentational pill for a fulfilment status. */
export function FulfillmentStatusBadge({
  status,
  withDot = true,
  size = 'md',
}: BadgeProps & { status: string | null | undefined }) {
  const display = getFulfillmentStatusDisplay(status)
  return <StatusPill label={display.label} tone={display.tone} withDot={withDot} size={size} />
}

/** Presentational pill for a fulfilment `priority_level` (1 = highest). */
export function FulfillmentPriorityBadge({
  level,
  withDot = false,
  size = 'sm',
}: BadgeProps & { level: number | null | undefined }) {
  const display = getFulfillmentPriorityDisplay(level)
  return <StatusPill label={display.label} tone={display.tone} withDot={withDot} size={size} />
}
