import { useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

import { Button, Field, Text, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type NativeDateFieldProps = {
  value: string | null
  onChange: (isoDate: string | null) => void
  label?: string
  maximumDate?: Date
  minimumDate?: Date
}

/** YYYY-MM-DD or empty */
function toDateInputValue(value: string | null) {
  if (!value?.trim()) return ''
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDisplayDate(value: string | null) {
  if (!value?.trim()) return 'Select date'
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return 'Select date'
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Date-only picker — native DateTimePicker on iOS/Android, type=date on web. */
export function NativeDateField({
  value,
  onChange,
  label = 'Date of birth',
  maximumDate,
  minimumDate,
}: NativeDateFieldProps) {
  const ui = useAppUi()
  const inputValue = useMemo(() => toDateInputValue(value), [value])

  if (Platform.OS === 'web') {
    return (
      <Field label={label}>
        <input
          type="date"
          value={inputValue}
          max={maximumDate ? toDateInputValue(maximumDate.toISOString()) : undefined}
          min={minimumDate ? toDateInputValue(minimumDate.toISOString()) : undefined}
          onChange={(event) => {
            const next = event.target.value
            onChange(next ? next : null)
          }}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 14,
            border: `1px solid ${ui.borderSubtle}`,
            background: ui.surface,
            color: ui.text,
            fontSize: 15,
            fontFamily: 'inherit',
          }}
        />
      </Field>
    )
  }

  return (
    <NativeDateFieldNative
      value={value}
      onChange={onChange}
      label={label}
      maximumDate={maximumDate}
      minimumDate={minimumDate}
    />
  )
}

function NativeDateFieldNative({
  value,
  onChange,
  label,
  maximumDate,
  minimumDate,
}: NativeDateFieldProps) {
  const ui = useAppUi()
  const [showPicker, setShowPicker] = useState(false)
  const [DateTimePicker, setDateTimePicker] = useState<React.ComponentType<any> | null>(null)

  const currentDate = useMemo(() => {
    if (!value?.trim()) return new Date(2000, 0, 1)
    const parsed = new Date(value.includes('T') ? value : `${value}T12:00:00`)
    return Number.isNaN(parsed.getTime()) ? new Date(2000, 0, 1) : parsed
  }, [value])

  useEffect(() => {
    void import('@react-native-community/datetimepicker').then((module) =>
      setDateTimePicker(() => module.default),
    )
  }, [])

  return (
    <YStack gap="$2">
      <Field label={label}>
        <Button tone="outline" borderRadius={14} onPress={() => setShowPicker(true)}>
          <Text color={ui.text}>{formatDisplayDate(value)}</Text>
        </Button>
      </Field>

      {value ? (
        <Button tone="ghost" size="$2" alignSelf="flex-start" onPress={() => onChange(null)}>
          Clear date
        </Button>
      ) : null}

      {showPicker && DateTimePicker ? (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={(event: { type: string }, selected?: Date) => {
            if (Platform.OS === 'android') setShowPicker(false)
            if (event.type === 'dismissed' || !selected) {
              if (Platform.OS === 'ios') setShowPicker(false)
              return
            }
            const pad = (n: number) => String(n).padStart(2, '0')
            onChange(
              `${selected.getFullYear()}-${pad(selected.getMonth() + 1)}-${pad(selected.getDate())}`,
            )
            if (Platform.OS === 'ios') setShowPicker(false)
          }}
        />
      ) : null}
    </YStack>
  )
}
