import { Platform } from 'react-native'

import { Icons, Text, YStack } from '~/components/ui'
import { PAYMENT_PROVIDERS } from '~/lib/payment/payment.constants'
import type { PaymentProviderConfig } from '~/lib/payment/payment.type'

type PaymentProviderIconProps = {
  provider: PaymentProviderConfig
  size?: number
}

function providerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export function PaymentProviderIcon({ provider, size = 40 }: PaymentProviderIconProps) {
  const accent = provider.color || '#800020'
  const isBank = provider.id === PAYMENT_PROVIDERS.BANK_TRANSFER

  return (
    <YStack
      width={size}
      height={size}
      borderRadius={12}
      alignItems="center"
      justifyContent="center"
      backgroundColor={`${accent}22`}
      borderWidth={1}
      borderColor={`${accent}33`}
      overflow="hidden"
    >
      {isBank ? (
        <Icons.Building2 size={Math.round(size * 0.45)} color={accent} />
      ) : (
        <Text
          fontSize={Math.max(11, Math.round(size * 0.32))}
          fontWeight="800"
          color={accent}
          letterSpacing={-0.5}
          userSelect={Platform.OS === 'web' ? 'none' : undefined}
        >
          {providerInitials(provider.name)}
        </Text>
      )}
    </YStack>
  )
}
