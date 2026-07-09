import { Platform } from 'react-native'
import { useEffect, useMemo, useState } from 'react'

import { Button, Field, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type ScheduleDateTimeFieldProps = {
  value: string
  onChange: (iso: string) => void
  label?: string
}

function toLocalInputValue(iso: string) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInputValue(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

function formatDisplayDate(iso: string) {
  if (!iso) return 'Select date & time'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Select date & time'
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Cross-platform date/time picker — datetime-local on web, native picker on iOS/Android. */
export function ScheduleDateTimeField({ value, onChange, label = 'Date & time' }: ScheduleDateTimeFieldProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const localValue = useMemo(() => toLocalInputValue(value), [value])

  if (Platform.OS === 'web') {
    return (
      <Field label={label}>
        <input
          type="datetime-local"
          value={localValue}
          onChange={(event) => onChange(fromLocalInputValue(event.target.value))}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 14,
            border: `1px solid ${coworkUi.borderSoft}`,
            background: 'rgba(255,255,255,0.05)',
            color: coworkUi.text,
            fontSize: 15,
            fontFamily: 'inherit',
          }}
        />
      </Field>
    )
  }

  return <NativeScheduleDateTimeField value={value} onChange={onChange} label={label} />
}

function NativeScheduleDateTimeField({ value, onChange, label }: ScheduleDateTimeFieldProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [showPicker, setShowPicker] = useState(false)
  const [mode, setMode] = useState<'date' | 'time'>('date')
  const [DateTimePicker, setDateTimePicker] = useState<React.ComponentType<any> | null>(null)

  const currentDate = useMemo(() => {
    const parsed = value ? new Date(value) : new Date()
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed
  }, [value])

  useEffect(() => {
    void import('@react-native-community/datetimepicker').then((module) =>
      setDateTimePicker(() => module.default),
    )
  }, [])

  function openDatePicker() {
    setMode('date')
    setShowPicker(true)
  }

  function openTimePicker() {
    setMode('time')
    setShowPicker(true)
  }

  return (
    <YStack gap="$2">
      <Field label={label}>
        <YStack gap="$2">
          <Button
            tone="outline"
            borderRadius={14}
            borderColor={coworkUi.borderSoft}
            backgroundColor="rgba(255,255,255,0.05)"
            onPress={openDatePicker}
          >
            <Text color={coworkUi.text}>{formatDisplayDate(value)}</Text>
          </Button>
          <XStack gap="$2">
            <Button flex={1} tone="ghost" size="$3" onPress={openDatePicker}>
              Change date
            </Button>
            <Button flex={1} tone="ghost" size="$3" onPress={openTimePicker}>
              Change time
            </Button>
          </XStack>
        </YStack>
      </Field>

      {showPicker && DateTimePicker ? (
        <DateTimePicker
          value={currentDate}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event: { type: string }, selected?: Date) => {
            if (Platform.OS === 'android') setShowPicker(false)
            if (event.type === 'dismissed' || !selected) {
              if (Platform.OS === 'ios') setShowPicker(false)
              return
            }
            onChange(selected.toISOString())
            if (Platform.OS === 'ios' && mode === 'date') {
              setMode('time')
              return
            }
            if (Platform.OS === 'ios') setShowPicker(false)
          }}
        />
      ) : null}

      <Text fontSize={11} color={coworkUi.textMuted}>
        Uses your device timezone
      </Text>
    </YStack>
  )
}

export function defaultScheduleDateTime() {
  const next = new Date()
  next.setMinutes(0, 0, 0)
  next.setHours(next.getHours() + 1)
  return next.toISOString()
}
