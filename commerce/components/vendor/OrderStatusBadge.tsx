import { getOrderStatusDisplay } from '~/lib/orders/order.utils'

import { StatusPill, type StatusPillSize } from '~/commerce/components/vendor/StatusPill'

type OrderStatusBadgeProps = {
  status: string | null | undefined
  /** Show the leading status dot (default true). */
  withDot?: boolean
  size?: StatusPillSize
}

/** Presentational pill for an order/item status (label + tone from the shared map). */
export function OrderStatusBadge({ status, withDot = true, size = 'md' }: OrderStatusBadgeProps) {
  const display = getOrderStatusDisplay(status)
  return <StatusPill label={display.label} tone={display.tone} withDot={withDot} size={size} />
}
