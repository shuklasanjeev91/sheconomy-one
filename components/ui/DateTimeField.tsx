import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isValid,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import * as Icons from '@tamagui/lucide-icons'
import { ScrollView, XStack, YStack } from 'tamagui'
import { Text } from './Text'

import { useAppUi } from '~/lib/theme/useAppUi'

import { AppBottomSheet } from './BottomSheet'
import { Button } from './Button'
import { Field } from './Input'

const DATE_FMT = 'yyyy-MM-dd'
const TIME_FMT = 'HH:mm'
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

type DateTimeFieldProps = {
  mode: 'date' | 'time'
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  required?: boolean
  hint?: string
  error?: string
  flex?: number
  minWidth?: number
  /** Disable dates before this day (date mode only). */
  minDate?: Date
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Date or time field that opens a bottom-sheet picker. Values are stored as
 * `yyyy-MM-dd` (date) or `HH:mm` (time) strings so they slot straight into
 * existing form validation and ISO date assembly.
 */
export function DateTimeField({
  mode,
  value,
  onChange,
  label,
  placeholder,
  required,
  hint,
  error,
  flex,
  minWidth,
  minDate,
}: DateTimeFieldProps) {
  const ui = useAppUi()
  const [open, setOpen] = useState(false)

  const parsed = useMemo(() => {
    if (!value) return null
    const d = parse(value, mode === 'date' ? DATE_FMT : TIME_FMT, new Date())
    return isValid(d) ? d : null
  }, [mode, value])

  const display = parsed
    ? mode === 'date'
      ? format(parsed, 'EEE, d MMM yyyy')
      : format(parsed, 'h:mm a')
    : placeholder ?? (mode === 'date' ? 'Select date' : 'Select time')

  const LeadIcon = mode === 'date' ? Icons.Calendar : Icons.Clock

  return (
    <Field
      label={label}
      required={required}
      hint={error ? undefined : hint}
      error={error}
      flex={flex}
      minWidth={minWidth}
    >
      <XStack
        onPress={() => setOpen(true)}
        alignItems="center"
        gap="$2.5"
        height={48}
        paddingHorizontal="$4"
        borderWidth={error ? 1.5 : 1}
        borderColor={error ? '$red9' : ui.border}
        borderRadius="$6"
        backgroundColor={ui.surface}
        cursor="pointer"
        hoverStyle={{ borderColor: ui.brand }}
        pressStyle={{ opacity: 0.9 }}
      >
        <LeadIcon size={18} color={ui.textMuted} />
        <Text flex={1} fontSize={15} color={parsed ? ui.text : ui.textMuted} numberOfLines={1}>
          {display}
        </Text>
        <Icons.ChevronDown size={18} color={ui.textMuted} />
      </XStack>

      <AppBottomSheet
        open={open}
        onOpenChange={setOpen}
        title={label ?? (mode === 'date' ? 'Select date' : 'Select time')}
        scrollable={false}
      >
        {open && mode === 'date' ? (
          <CalendarPicker
            value={parsed}
            minDate={minDate}
            onSelect={(d) => {
              onChange(format(d, DATE_FMT))
              setOpen(false)
            }}
          />
        ) : null}
        {open && mode === 'time' ? (
          <TimePicker
            value={parsed}
            onSelect={(d) => {
              onChange(format(d, TIME_FMT))
              setOpen(false)
            }}
          />
        ) : null}
      </AppBottomSheet>
    </Field>
  )
}

function CalendarPicker({
  value,
  minDate,
  onSelect,
}: {
  value: Date | null
  minDate?: Date
  onSelect: (date: Date) => void
}) {
  const ui = useAppUi()
  const [month, setMonth] = useState(value ?? new Date())
  const min = minDate ? startOfDay(minDate) : null

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
    return chunk(eachDayOfInterval({ start, end }), 7)
  }, [month])

  return (
    <YStack gap="$3" paddingBottom="$2">
      <XStack alignItems="center" justifyContent="space-between">
        <NavButton icon={Icons.ChevronLeft} onPress={() => setMonth((m) => subMonths(m, 1))} />
        <Text fontSize={16} fontWeight="700" color={ui.text}>
          {format(month, 'MMMM yyyy')}
        </Text>
        <NavButton icon={Icons.ChevronRight} onPress={() => setMonth((m) => addMonths(m, 1))} />
      </XStack>

      <XStack>
        {WEEKDAYS.map((w) => (
          <YStack key={w} flex={1} alignItems="center">
            <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
              {w}
            </Text>
          </YStack>
        ))}
      </XStack>

      <YStack gap={4}>
        {weeks.map((week) => (
          <XStack key={week[0].toISOString()} gap={4}>
            {week.map((day) => {
              const selected = value ? isSameDay(day, value) : false
              const outside = !isSameMonth(day, month)
              const disabled = min ? isBefore(day, min) : false
              return (
                <YStack
                  key={day.toISOString()}
                  flex={1}
                  height={40}
                  alignItems="center"
                  justifyContent="center"
                  borderRadius={999}
                  backgroundColor={selected ? ui.brand : 'transparent'}
                  opacity={disabled ? 0.3 : 1}
                  cursor={disabled ? 'default' : 'pointer'}
                  hoverStyle={!disabled && !selected ? { backgroundColor: ui.surfaceHover } : undefined}
                  onPress={disabled ? undefined : () => onSelect(day)}
                >
                  <Text
                    fontSize={14}
                    fontWeight={selected ? '700' : '500'}
                    color={selected ? 'white' : outside ? ui.textMuted : ui.text}
                  >
                    {format(day, 'd')}
                  </Text>
                </YStack>
              )
            })}
          </XStack>
        ))}
      </YStack>

      <Button
        tone="ghost"
        size="$3"
        alignSelf="center"
        onPress={() => onSelect(startOfDay(new Date()))}
      >
        Today
      </Button>
    </YStack>
  )
}

function TimePicker({ value, onSelect }: { value: Date | null; onSelect: (date: Date) => void }) {
  const ui = useAppUi()
  const [hour, setHour] = useState(value ? value.getHours() : 9)
  const [minute, setMinute] = useState(value ? Math.round(value.getMinutes() / 5) * 5 : 0)

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), [])

  function apply() {
    const d = new Date()
    d.setHours(hour, minute >= 60 ? 55 : minute, 0, 0)
    onSelect(d)
  }

  const previewDate = new Date()
  previewDate.setHours(hour, minute, 0, 0)

  return (
    <YStack gap="$3" paddingBottom="$2">
      <Text fontSize={26} fontWeight="800" color={ui.text} alignSelf="center">
        {format(previewDate, 'h:mm a')}
      </Text>
      <XStack gap="$3" height={200}>
        <WheelColumn
          label="Hour"
          items={hours}
          selected={hour}
          format={(h) => String(h).padStart(2, '0')}
          onSelect={setHour}
        />
        <WheelColumn
          label="Minute"
          items={minutes}
          selected={minute}
          format={(m) => String(m).padStart(2, '0')}
          onSelect={setMinute}
        />
      </XStack>
      <Button tone="primary" borderRadius={999} onPress={apply}>
        Set time
      </Button>
    </YStack>
  )
}

function WheelColumn({
  label,
  items,
  selected,
  format: fmt,
  onSelect,
}: {
  label: string
  items: number[]
  selected: number
  format: (value: number) => string
  onSelect: (value: number) => void
}) {
  const ui = useAppUi()
  return (
    <YStack flex={1} gap="$2">
      <Text fontSize={12} fontWeight="600" color={ui.textMuted} alignSelf="center">
        {label}
      </Text>
      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        borderWidth={1}
        borderColor={ui.border}
        borderRadius={12}
        backgroundColor={ui.surface}
      >
        <YStack paddingVertical={6}>
          {items.map((item) => {
            const active = item === selected
            return (
              <XStack
                key={item}
                height={40}
                alignItems="center"
                justifyContent="center"
                marginHorizontal={6}
                borderRadius={8}
                backgroundColor={active ? ui.brand : 'transparent'}
                cursor="pointer"
                hoverStyle={active ? undefined : { backgroundColor: ui.surfaceHover }}
                onPress={() => onSelect(item)}
              >
                <Text fontSize={16} fontWeight={active ? '700' : '500'} color={active ? 'white' : ui.text}>
                  {fmt(item)}
                </Text>
              </XStack>
            )
          })}
        </YStack>
      </ScrollView>
    </YStack>
  )
}

function NavButton({ icon: Icon, onPress }: { icon: typeof Icons.ChevronLeft; onPress: () => void }) {
  const ui = useAppUi()
  return (
    <XStack
      width={40}
      height={40}
      alignItems="center"
      justifyContent="center"
      borderRadius={999}
      cursor="pointer"
      hoverStyle={{ backgroundColor: ui.surfaceHover }}
      onPress={onPress}
    >
      <Icon size={20} color={ui.text} />
    </XStack>
  )
}
