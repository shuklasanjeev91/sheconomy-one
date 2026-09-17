import { useMemo, useState } from 'react'
import { ScrollView } from 'react-native'

import { AppBottomSheet, Button, Field, Icons, Input, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import {
  coerceIanaTimeZone,
  formatScheduleTimeZoneLabel,
  formatTimeZoneGmtOffset,
  isValidIanaTimeZone,
  listScheduleTimeZoneValues,
  resolveDeviceIanaTimeZone,
  SCHEDULE_TIMEZONE_OPTIONS,
} from '~/lib/calendar/timezone'

type ScheduleTimezoneFieldProps = {
  value: string
  onChange: (timeZone: string) => void
  error?: string
  label?: string
}

/** Zoom-style searchable global timezone picker for schedule / edit forms. */
export function ScheduleTimezoneField({
  value,
  onChange,
  error,
  label = 'Timezone',
}: ScheduleTimezoneFieldProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = coerceIanaTimeZone(value || resolveDeviceIanaTimeZone())
  const deviceZone = resolveDeviceIanaTimeZone()

  const options = useMemo(() => {
    const values = listScheduleTimeZoneValues(selected)
    const q = query.trim().toLowerCase()
    return values
      .map((zone) => {
        const meta = SCHEDULE_TIMEZONE_OPTIONS.find((row) => row.value === zone)
        return {
          value: zone,
          city: meta?.city ?? zone.split('/').pop()?.replace(/_/g, ' ') ?? zone,
          region: meta?.region ?? (zone === deviceZone ? 'This device' : 'Other'),
          offset: formatTimeZoneGmtOffset(zone),
        }
      })
      .filter((row) => {
        if (!q) return true
        return (
          row.value.toLowerCase().includes(q) ||
          row.city.toLowerCase().includes(q) ||
          row.region.toLowerCase().includes(q) ||
          row.offset.toLowerCase().includes(q)
        )
      })
  }, [deviceZone, query, selected])

  function selectZone(zone: string) {
    const next = coerceIanaTimeZone(zone)
    if (!isValidIanaTimeZone(next) && !next.includes('/')) return
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  return (
    <Field label={label} error={error} required>
      <XStack
        onPress={() => setOpen(true)}
        alignItems="center"
        gap="$3"
        minHeight={56}
        paddingHorizontal="$4"
        paddingVertical="$2.5"
        borderRadius={14}
        borderWidth={1}
        borderColor={error ? coworkUi.danger : coworkUi.borderSoft}
        backgroundColor="rgba(255,255,255,0.05)"
        cursor="pointer"
        aria-label="Choose timezone"
        hoverStyle={{ borderColor: coworkUi.brand }}
        pressStyle={{ opacity: 0.85 }}
      >
        <Icons.Globe size={18} color={coworkUi.brand} />
        <YStack flex={1} gap={2} minWidth={0}>
          <Text fontSize={15} fontWeight="600" color={coworkUi.text} numberOfLines={1}>
            {formatScheduleTimeZoneLabel(selected)}
          </Text>
          <Text fontSize={12} color={coworkUi.textMuted} numberOfLines={1}>
            {selected}
          </Text>
        </YStack>
        <Icons.ChevronDown size={18} color={coworkUi.textMuted} />
      </XStack>

      <Text fontSize={12} color={coworkUi.textMuted} marginTop="$2">
        You pick a wall clock in this timezone. Times are stored as UTC; each attendee sees them in
        their own local timezone.
      </Text>

      <AppBottomSheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery('')
        }}
        title="Select timezone"
        scrollable={false}
      >
        <YStack gap="$3" width="100%">
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search city or GMT offset"
            autoCapitalize="none"
            autoCorrect={false}
            backgroundColor="rgba(255,255,255,0.05)"
            borderColor={coworkUi.borderSoft}
            color={coworkUi.text}
            borderRadius={14}
          />
          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
            <YStack gap="$1" paddingBottom="$4">
              {options.map((row) => {
                const active = row.value === selected
                return (
                  <XStack
                    key={row.value}
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                    paddingVertical="$3"
                    paddingHorizontal="$3"
                    borderRadius={12}
                    backgroundColor={active ? 'rgba(255,255,255,0.08)' : 'transparent'}
                    onPress={() => selectZone(row.value)}
                    cursor="pointer"
                    pressStyle={{ opacity: 0.8 }}
                  >
                    <YStack flex={1} gap={2} minWidth={0}>
                      <Text fontSize={15} fontWeight="700" color={coworkUi.text} numberOfLines={1}>
                        ({row.offset}) {row.city}
                      </Text>
                      <Text fontSize={12} color={coworkUi.textMuted} numberOfLines={1}>
                        {row.region} · {row.value}
                      </Text>
                    </YStack>
                    {active ? <Icons.Check size={18} color={coworkUi.brand} /> : null}
                  </XStack>
                )
              })}
              {options.length === 0 ? (
                <Text fontSize={13} color={coworkUi.textMuted} padding="$3">
                  No matching timezones
                </Text>
              ) : null}
            </YStack>
          </ScrollView>
          <Button tone="outline" borderRadius={12} onPress={() => setOpen(false)}>
            Cancel
          </Button>
        </YStack>
      </AppBottomSheet>
    </Field>
  )
}
