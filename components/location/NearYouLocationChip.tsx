import { Icons, Spinner, Text, XStack } from '~/components/ui'
import { buildLocationLabel, useOptionalUserLocation } from '~/lib/location'
import { useAppUi } from '~/lib/theme/useAppUi'

/** Compact “Near you” chip for commerce home / browse headers. */
export function NearYouLocationChip() {
  const ui = useAppUi()
  const location = useOptionalUserLocation()
  if (!location) return null

  const placeLabel =
    buildLocationLabel({
      city: location.city,
      state: location.state,
      country: location.country,
      postal_code: location.postal_code,
    }) ||
    // Prefer a short place name over a full street-formatted string.
    (location.label && location.label.length <= 48 ? location.label : null) ||
    (location.label ? location.label.split(',').slice(0, 2).join(',').trim() : null)

  if (location.status === 'loading' && !placeLabel && !location.coords) {
    return (
      <XStack alignItems="center" gap="$2" paddingHorizontal="$4" paddingTop="$1">
        <Spinner size="small" />
        <Text fontSize={12} color={ui.textMuted}>
          Finding your location…
        </Text>
      </XStack>
    )
  }

  if (!placeLabel && !location.coords) {
    const canPrompt =
      location.status === 'denied' ||
      location.status === 'unavailable' ||
      location.status === 'idle' ||
      location.permission === 'undetermined' ||
      location.permission === 'denied'

    if (canPrompt) {
      return (
        <XStack
          alignItems="center"
          gap="$2"
          paddingHorizontal="$4"
          paddingTop="$1"
          cursor="pointer"
          onPress={() => void location.requestPermission()}
        >
          <Icons.MapPin size={14} color={ui.textMuted} />
          <Text fontSize={12} color={ui.link} fontWeight="600">
            Enable location for nearby shops
          </Text>
        </XStack>
      )
    }
    return null
  }

  const display = placeLabel ? `Near you · ${placeLabel}` : 'Near you'

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      paddingHorizontal="$4"
      paddingTop="$1"
    >
      <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
        <Icons.MapPin size={14} color={ui.brand} />
        <Text fontSize={12} color={ui.textSecondary} numberOfLines={1}>
          {display}
        </Text>
      </XStack>
      <Text
        fontSize={12}
        fontWeight="600"
        color={ui.link}
        cursor="pointer"
        onPress={() => void location.refresh()}
      >
        Update
      </Text>
    </XStack>
  )
}
