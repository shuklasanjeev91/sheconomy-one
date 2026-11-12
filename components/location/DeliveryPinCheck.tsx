import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { Icons, Input, SafeIcon, Spinner, Text, XStack, YStack } from '~/components/ui'
import { getPostalCodeLabel, getPostalCodePlaceholder } from '~/lib/geo'
import { checkDeliveryAvailability, useOptionalUserLocation } from '~/lib/location'
import { useAppUi } from '~/lib/theme/useAppUi'

type DeliveryPinCheckProps = {
  shopId?: string | null
  listingId?: string | null
  listingType?: string | null
  country?: string
  state?: string | null
  initialPostal?: string
  compact?: boolean
}

/** PIN / postal delivery availability check for PDP and checkout. */
export function DeliveryPinCheck({
  shopId,
  listingId,
  listingType,
  country = 'IN',
  state,
  initialPostal = '',
  compact,
}: DeliveryPinCheckProps) {
  const ui = useAppUi()
  const location = useOptionalUserLocation()
  const [postal, setPostal] = useState(initialPostal || location?.postal_code || '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    if (initialPostal) return
    if (location?.postal_code) {
      setPostal((current) => current || location.postal_code || '')
    }
  }, [initialPostal, location?.postal_code])

  const resolvedCountry = country || location?.country || 'IN'
  const resolvedState = state ?? location?.state ?? null

  if (listingType === 'digital') {
    return (
      <XStack alignItems="center" gap="$2">
        <SafeIcon icon={Icons.CheckCircle} size={16} color={ui.success} />
        <Text fontSize={13} color={ui.success} fontWeight="600">
          Instant digital delivery
        </Text>
      </XStack>
    )
  }

  async function handleCheck() {
    setBusy(true)
    setMessage(null)
    const result = await checkDeliveryAvailability({
      postalCode: postal,
      country: resolvedCountry,
      state: resolvedState,
      shopId,
      listingId,
      listingType,
    })
    setBusy(false)
    setOk(result.available)
    if (result.available) {
      setMessage(
        [result.etaHint, result.profileName ? `via ${result.profileName}` : null]
          .filter(Boolean)
          .join(' · ') || 'Delivery available to this PIN.',
      )
    } else {
      setMessage(result.reason ?? 'Not available at this PIN.')
    }
  }

  return (
    <YStack gap={compact ? '$2' : '$3'} width="100%">
      <Text fontSize={13} fontWeight="600" color={ui.text}>
        Check delivery
      </Text>
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <Input
          flex={1}
          minWidth={140}
          value={postal}
          onChangeText={setPostal}
          placeholder={getPostalCodePlaceholder(resolvedCountry)}
          autoComplete={Platform.OS === 'web' ? ('postal-code' as never) : undefined}
          textContentType={Platform.OS === 'ios' ? 'postalCode' : undefined}
          onSubmitEditing={() => void handleCheck()}
        />
        <XStack
          height={40}
          paddingHorizontal={16}
          borderRadius={999}
          backgroundColor={ui.brand}
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          opacity={busy ? 0.7 : 1}
          onPress={() => void handleCheck()}
        >
          {busy ? (
            <Spinner size="small" color="white" />
          ) : (
            <Text fontSize={13} fontWeight="700" color={ui.onBrand}>
              Check {getPostalCodeLabel(resolvedCountry)}
            </Text>
          )}
        </XStack>
      </XStack>
      {message ? (
        <XStack alignItems="center" gap="$2">
          {ok ? (
            <SafeIcon icon={Icons.CheckCircle} size={15} color={ui.success} />
          ) : (
            <SafeIcon icon={Icons.AlertCircle} size={15} color={ui.danger} />
          )}
          <Text fontSize={13} color={ok ? ui.success : ui.danger} flex={1}>
            {message}
          </Text>
        </XStack>
      ) : null}
    </YStack>
  )
}
