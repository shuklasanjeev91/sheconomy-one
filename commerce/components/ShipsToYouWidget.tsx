import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { Icons, Input, Text, XStack, YStack } from '~/components/ui'
import {
  isValidZip,
  mockDeliveryEstimateFromZip,
  type MockDeliveryEstimate,
} from '~/commerce/lib/mock-delivery-estimate'
import { getPostalCodeLabel, getPostalCodePlaceholder } from '~/lib/geo'
import { useOptionalUserLocation } from '~/lib/location'
import { useAppUi } from '~/lib/theme/useAppUi'

type ShipsToYouWidgetProps = {
  country?: string
  initialZip?: string
  compact?: boolean
  /** Lift estimate into parent (e.g. PDP Get it by chip). */
  onEstimate?: (estimate: MockDeliveryEstimate | null) => void
}

/** ZIP → mock delivery estimate (no shipping APIs). */
export function ShipsToYouWidget({
  country = 'IN',
  initialZip = '',
  compact,
  onEstimate,
}: ShipsToYouWidgetProps) {
  const ui = useAppUi()
  const location = useOptionalUserLocation()
  const [zip, setZip] = useState(initialZip || location?.postal_code || '')
  const [estimate, setEstimate] = useState<MockDeliveryEstimate | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialZip) {
      setZip(initialZip)
      return
    }
    if (location?.postal_code) {
      setZip((current) => current || location.postal_code || '')
    }
  }, [initialZip, location?.postal_code])

  const resolvedCountry = country || location?.country || 'IN'

  function runEstimate(nextZip = zip) {
    setError(null)
    if (!isValidZip(nextZip)) {
      setEstimate(null)
      onEstimate?.(null)
      setError(`Enter a valid ${getPostalCodeLabel(resolvedCountry)}.`)
      return
    }
    const result = mockDeliveryEstimateFromZip(nextZip)
    setEstimate(result)
    onEstimate?.(result)
  }

  useEffect(() => {
    const seed = initialZip || location?.postal_code
    if (seed && isValidZip(seed)) {
      const result = mockDeliveryEstimateFromZip(seed)
      setEstimate(result)
      onEstimate?.(result)
    }
    // Intentionally omit onEstimate — parents pass inline lambdas; including it
    // re-fires setState every render (React #185).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when location/initial arrives
  }, [initialZip, location?.postal_code])

  return (
    <YStack
      gap={compact ? '$2' : '$3'}
      width="100%"
      padding={compact ? '$3' : '$4'}
      borderRadius={12}
      borderWidth={1}
      borderColor={ui.panelBorder}
      backgroundColor={ui.panelBg}
    >
      <XStack alignItems="center" gap="$2">
        <Icons.Truck size={16} color={ui.text} />
        <Text fontSize={14} fontWeight="700" color={ui.text}>
          Ships to you
        </Text>
      </XStack>
      <Text fontSize={12} color={ui.textSecondary}>
        Enter your {getPostalCodeLabel(resolvedCountry).toLowerCase()} for a delivery estimate.
      </Text>
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <Input
          flex={1}
          minWidth={140}
          value={zip}
          onChangeText={setZip}
          placeholder={getPostalCodePlaceholder(resolvedCountry)}
          autoComplete={Platform.OS === 'web' ? ('postal-code' as never) : undefined}
          textContentType={Platform.OS === 'ios' ? 'postalCode' : undefined}
          onSubmitEditing={() => runEstimate()}
        />
        <XStack
          height={40}
          paddingHorizontal={16}
          borderRadius={999}
          backgroundColor={ui.brand}
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          onPress={() => runEstimate()}
        >
          <Text fontSize={13} fontWeight="700" color={ui.onBrand}>
            Check
          </Text>
        </XStack>
      </XStack>
      {error ? (
        <Text fontSize={12} color={ui.danger}>
          {error}
        </Text>
      ) : null}
      {estimate ? (
        <YStack gap={4}>
          <XStack alignItems="center" gap="$2">
            <Icons.CheckCircle size={15} color={ui.success} />
            <Text fontSize={13} fontWeight="700" color={ui.success} flex={1}>
              {estimate.label}
            </Text>
          </XStack>
          <Text fontSize={12} color={ui.textMuted}>
            {estimate.freeShippingEligible
              ? 'FREE delivery eligible for this area (mock estimate).'
              : 'Standard delivery rates apply at checkout (mock estimate).'}
          </Text>
        </YStack>
      ) : null}
    </YStack>
  )
}
