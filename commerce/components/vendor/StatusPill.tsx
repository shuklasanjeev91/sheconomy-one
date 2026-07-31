import { Text, XStack, YStack } from '~/components/ui'
import type { OrderStatusTone } from '~/lib/orders/order.constants'

/**
 * Soft pill styling per semantic status tone. These are intentionally light
 * "chip" colours (light background + saturated text) to match the vendor
 * dashboard look, independent of the strong overlay-badge tokens in `app-ui`.
 */
export const TONE_STYLES: Record<OrderStatusTone, { bg: string; fg: string; dot: string }> = {
  yellow: { bg: '#fef3c7', fg: '#92600a', dot: '#d97706' },
  orange: { bg: '#ffedd5', fg: '#9a3412', dot: '#ea580c' },
  red: { bg: '#fee2e2', fg: '#b42318', dot: '#dc2626' },
  blue: { bg: '#dbeafe', fg: '#1d4ed8', dot: '#2563eb' },
  purple: { bg: '#ede9fe', fg: '#6d28d9', dot: '#7c3aed' },
  green: { bg: '#dcfce7', fg: '#15803d', dot: '#16a34a' },
  gray: { bg: '#eef1f5', fg: '#475569', dot: '#94a3b8' },
}

export function toneStyle(tone: OrderStatusTone | null | undefined) {
  return TONE_STYLES[tone ?? 'gray'] ?? TONE_STYLES.gray
}

export type StatusPillSize = 'sm' | 'md'

type StatusPillProps = {
  label: string
  tone: OrderStatusTone
  /** Show the leading status dot (default true). */
  withDot?: boolean
  size?: StatusPillSize
}

/** Presentational pill shared by order, issue, and fulfilment status badges. */
export function StatusPill({ label, tone, withDot = true, size = 'md' }: StatusPillProps) {
  const style = toneStyle(tone)
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
      backgroundColor={style.bg}
      alignSelf="flex-start"
    >
      {withDot ? <YStack width={6} height={6} borderRadius={999} backgroundColor={style.dot} /> : null}
      <Text fontSize={fontSize} fontWeight="700" color={style.fg} numberOfLines={1}>
        {label}
      </Text>
    </XStack>
  )
}
