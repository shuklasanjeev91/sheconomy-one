import { Text, XStack, YStack } from '~/components/ui'
import { getOrderStatusDisplay } from '~/lib/orders/order.utils'
import type { OrderStatusTone } from '~/lib/orders/order.constants'

/**
 * Soft pill styling per semantic status tone. These are intentionally light
 * "chip" colours (light background + saturated text) to match the vendor
 * dashboard look, independent of the strong overlay-badge tokens in `app-ui`.
 */
const TONE_STYLES: Record<OrderStatusTone, { bg: string; fg: string; dot: string }> = {
  yellow: { bg: '#fef3c7', fg: '#92600a', dot: '#d97706' },
  orange: { bg: '#ffedd5', fg: '#9a3412', dot: '#ea580c' },
  red: { bg: '#fee2e2', fg: '#b42318', dot: '#dc2626' },
  blue: { bg: '#dbeafe', fg: '#1d4ed8', dot: '#2563eb' },
  purple: { bg: '#ede9fe', fg: '#6d28d9', dot: '#7c3aed' },
  green: { bg: '#dcfce7', fg: '#15803d', dot: '#16a34a' },
  gray: { bg: '#eef1f5', fg: '#475569', dot: '#94a3b8' },
}

type OrderStatusBadgeProps = {
  status: string | null | undefined
  /** Show the leading status dot (default true). */
  withDot?: boolean
  size?: 'sm' | 'md'
}

/** Presentational pill for an order/item status (label + tone from the shared map). */
export function OrderStatusBadge({ status, withDot = true, size = 'md' }: OrderStatusBadgeProps) {
  const display = getOrderStatusDisplay(status)
  const tone = TONE_STYLES[display.tone] ?? TONE_STYLES.gray
  const paddingV = size === 'sm' ? 3 : 4
  const paddingH = size === 'sm' ? 8 : 10
  const fontSize = size === 'sm' ? 11 : 12

  return (
    <XStack
      alignItems="center"
      gap={5}
      paddingHorizontal={paddingH}
      paddingVertical={paddingV}
      borderRadius={999}
      backgroundColor={tone.bg}
      alignSelf="flex-start"
    >
      {withDot ? <YStack width={6} height={6} borderRadius={999} backgroundColor={tone.dot} /> : null}
      <Text fontSize={fontSize} fontWeight="700" color={tone.fg} numberOfLines={1}>
        {display.label}
      </Text>
    </XStack>
  )
}
