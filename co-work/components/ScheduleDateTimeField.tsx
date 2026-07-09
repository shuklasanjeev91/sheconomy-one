import { Platform } from 'react-native'
import { useMemo } from 'react'

import { Field, Input, Text, XStack, YStack } from '~/components/ui'
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

/** Cross-platform date/time picker — datetime-local on web, split fields on native. */
export function ScheduleDateTimeField({ value, onChange, label = 'Date & time' }: ScheduleDateTimeFieldProps) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
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

  const [datePart = '', timePart = ''] = localValue.split('T')

  return (
    <YStack gap="$2">
      <Field label={label}>
        <XStack gap="$2">
          <Input
            flex={1}
            value={datePart}
            onChangeText={(date) => onChange(fromLocalInputValue(`${date}T${timePart || '09:00'}`))}
            placeholder="YYYY-MM-DD"
            backgroundColor="rgba(255,255,255,0.05)"
            borderColor={coworkUi.borderSoft}
            color={coworkUi.text}
            borderRadius={14}
          />
          <Input
            width={110}
            value={timePart}
            onChangeText={(time) => onChange(fromLocalInputValue(`${datePart || new Date().toISOString().slice(0, 10)}T${time}`))}
            placeholder="HH:MM"
            backgroundColor="rgba(255,255,255,0.05)"
            borderColor={coworkUi.borderSoft}
            color={coworkUi.text}
            borderRadius={14}
          />
        </XStack>
      </Field>
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