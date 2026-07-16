import { useState } from 'react'
import { Platform } from 'react-native'

import { Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import {
  getCurrentPosition,
  reverseGeocode,
  type LatLng,
  type ResolvedAddress,
} from '~/lib/location'
import { useAppUi } from '~/lib/theme/useAppUi'

import { MapAddressPicker } from './MapAddressPicker'

type LocationAssistActionsProps = {
  onResolved: (address: ResolvedAddress) => void
  disabled?: boolean
}

/** “Use my location” + “Choose on map” assist for address forms. */
export function LocationAssistActions({ onResolved, disabled }: LocationAssistActionsProps) {
  const ui = useAppUi()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [mapCoords, setMapCoords] = useState<LatLng | null>(null)

  async function handleCurrentLocation() {
    if (disabled || busy) return
    setBusy(true)
    setError(null)

    const accuracy =
      Platform.OS === 'ios' ? ('approximate' as const) : ('balanced' as const)
    let position = await getCurrentPosition({ accuracy })

    if (position.coords && Platform.OS === 'ios' && (position.accuracy ?? 9999) > 500) {
      position = await getCurrentPosition({ accuracy: 'precise' })
    }

    if (!position.coords) {
      setBusy(false)
      setError(position.error ?? 'Could not get your location.')
      return
    }

    setMapCoords(position.coords)
    const resolved = await reverseGeocode(position.coords)
    setBusy(false)

    if (resolved.data) {
      onResolved({ ...resolved.data, source: 'current_location' })
      return
    }

    if (resolved.unavailable) {
      onResolved({
        address_line_1: '',
        address_line_2: '',
        city: '',
        state: '',
        postal_code: '',
        country: '',
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        place_id: null,
        formatted: null,
        source: 'current_location',
      })
      setError('Address lookup is offline — confirm city and PIN below.')
      return
    }

    setError(resolved.error ?? 'Could not resolve that location.')
  }

  return (
    <YStack gap="$2" width="100%">
      <XStack gap="$2" flexWrap="wrap">
        <XStack
          flex={1}
          minWidth={140}
          alignItems="center"
          justifyContent="center"
          gap="$2"
          paddingVertical={10}
          paddingHorizontal={12}
          borderRadius={999}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          cursor={disabled || busy ? 'default' : 'pointer'}
          opacity={disabled ? 0.55 : 1}
          onPress={() => void handleCurrentLocation()}
        >
          {busy ? (
            <Spinner size="small" />
          ) : (
            <Icons.Locate size={16} color={ui.brand} />
          )}
          <Text fontSize={13} fontWeight="600" color={ui.text}>
            Use my location
          </Text>
        </XStack>

        <XStack
          flex={1}
          minWidth={140}
          alignItems="center"
          justifyContent="center"
          gap="$2"
          paddingVertical={10}
          paddingHorizontal={12}
          borderRadius={999}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          cursor={disabled ? 'default' : 'pointer'}
          opacity={disabled ? 0.55 : 1}
          onPress={() => {
            if (!disabled) setMapOpen(true)
          }}
        >
          <Icons.MapPin size={16} color={ui.brand} />
          <Text fontSize={13} fontWeight="600" color={ui.text}>
            Choose on map
          </Text>
        </XStack>
      </XStack>

      {error ? (
        <Text fontSize={12} color={ui.danger}>
          {error}
        </Text>
      ) : null}

      <MapAddressPicker
        open={mapOpen}
        onOpenChange={setMapOpen}
        initialCoords={mapCoords}
        onConfirm={onResolved}
      />
    </YStack>
  )
}
