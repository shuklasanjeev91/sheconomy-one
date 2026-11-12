import { Text, XStack, YStack } from '~/components/ui'
import type { PayuPaymentModeId } from '~/commerce/lib/payu-payment-modes'

type Badge = {
  bg: string
  fg: string
  label: string
}

/**
 * Text-only badges — never Lucide/`Icons.*`.
 * Missing tree-shaken icons previously crashed checkout with
 * "Element type is invalid" (support refs CHECKOUT-*).
 */
const METHOD_BADGES: Partial<Record<PayuPaymentModeId, Badge>> = {
  upi_collect: { bg: '#E8F5E9', fg: '#1B5E20', label: 'UPI' },
  upi_gpay: { bg: '#E8F0FE', fg: '#1A73E8', label: 'GPay' },
  upi_phonepe: { bg: '#F3E5F5', fg: '#5F259F', label: 'PhonePe' },
  upi_paytm: { bg: '#E1F5FE', fg: '#00A9E0', label: 'Paytm' },
  upi_intent: { bg: '#E8F5E9', fg: '#097939', label: 'UPI' },
  upi_qr: { bg: '#FFF3E0', fg: '#E65100', label: 'QR' },
  cards: { bg: '#E3F2FD', fg: '#0D47A1', label: 'Card' },
  netbanking: { bg: '#E3F2FD', fg: '#0D47A1', label: 'Bank' },
  wallet_mobikwik: { bg: '#E8EAF6', fg: '#3F51B5', label: 'MK' },
  wallet_olamoney: { bg: '#E8F5E9', fg: '#1B8E3C', label: 'Ola' },
  emi: { bg: '#F3E5F5', fg: '#6A1B9A', label: 'EMI' },
  bnpl: { bg: '#E0F7FA', fg: '#006064', label: 'BNPL' },
  paypal: { bg: '#E3F2FD', fg: '#003087', label: 'PayPal' },
  pluxee: { bg: '#FFF3E0', fg: '#EF6C00', label: 'Pluxee' },
  neft: { bg: '#ECEFF1', fg: '#37474F', label: 'NEFT' },
}

const SECTION_BADGES: Record<string, Badge[]> = {
  upi: [
    { bg: '#E8F0FE', fg: '#1A73E8', label: 'GPay' },
    { bg: '#F3E5F5', fg: '#5F259F', label: 'Pe' },
    { bg: '#E1F5FE', fg: '#00A9E0', label: 'Paytm' },
    { bg: '#E8F5E9', fg: '#097939', label: 'UPI' },
  ],
  cards: [
    { bg: '#1A1F71', fg: '#FFFFFF', label: 'VISA' },
    { bg: '#EB001B', fg: '#FFFFFF', label: 'MC' },
    { bg: '#2E77BC', fg: '#FFFFFF', label: 'RuPay' },
  ],
  netbanking: [
    { bg: '#FFEBEE', fg: '#B71C1C', label: 'HDFC' },
    { bg: '#FCE4EC', fg: '#880E4F', label: 'ICICI' },
    { bg: '#E3F2FD', fg: '#0D47A1', label: 'SBI' },
  ],
  wallets: [
    { bg: '#E1F5FE', fg: '#00A9E0', label: 'Paytm' },
    { bg: '#F3E5F5', fg: '#5F259F', label: 'Pe' },
    { bg: '#FFF8E1', fg: '#FF9900', label: 'aPay' },
  ],
  more: [
    { bg: '#E3F2FD', fg: '#003087', label: 'PP' },
    { bg: '#F3E5F5', fg: '#6A1B9A', label: 'EMI' },
  ],
  emi: [{ bg: '#F3E5F5', fg: '#6A1B9A', label: 'EMI' }],
  bnpl: [{ bg: '#E0F7FA', fg: '#006064', label: 'BNPL' }],
  paypal: [{ bg: '#E3F2FD', fg: '#003087', label: 'PP' }],
  pluxee: [{ bg: '#FFF3E0', fg: '#EF6C00', label: 'Pluxee' }],
  neft: [{ bg: '#ECEFF1', fg: '#37474F', label: 'NEFT' }],
}

function BadgeMark({ badge, size }: { badge: Badge; size: number }) {
  return (
    <YStack
      width={size}
      height={size}
      borderRadius={8}
      alignItems="center"
      justifyContent="center"
      backgroundColor={badge.bg}
      borderWidth={1}
      borderColor={`${badge.fg}18`}
      flexShrink={0}
    >
      <Text
        fontSize={size <= 28 ? 8 : size <= 36 ? 9 : 11}
        fontWeight="800"
        color={badge.fg}
        numberOfLines={1}
        letterSpacing={-0.3}
      >
        {badge.label}
      </Text>
    </YStack>
  )
}

/** Brand-colored tile for a concrete PayU checkout option. */
export function CheckoutPayuMethodIcon({
  modeId,
  size = 40,
}: {
  modeId: PayuPaymentModeId
  size?: number
}) {
  const badge = METHOD_BADGES[modeId] ?? {
    bg: '#F5F5F5',
    fg: '#424242',
    label: 'Pay',
  }
  return <BadgeMark badge={badge} size={size} />
}

/** Mini logo strip shown on accordion section headers (Amazon-style). */
export function CheckoutPayuSectionIcons({
  sectionId,
  size = 22,
}: {
  sectionId: string
  size?: number
}) {
  const badges = SECTION_BADGES[sectionId] ?? []
  if (!badges.length) return null
  return (
    <XStack gap={4} alignItems="center" flexShrink={0}>
      {badges.map((badge) => (
        <BadgeMark key={`${sectionId}-${badge.label}`} badge={badge} size={size} />
      ))}
    </XStack>
  )
}
