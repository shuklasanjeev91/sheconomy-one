import { useEffect, useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDaysInMonth,
  isAfter,
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
import * as Icons from '~/components/ui/icons'
import { ScrollView, XStack, YStack } from 'tamagui'
import { Text } from '~/components/ui/Text'

import { useAppUi } from '~/lib/theme/useAppUi'

import { AppBottomSheet } from '~/components/ui/BottomSheet'
import { Button } from '~/components/ui/Button'
import { Field } from '~/components/ui/Input'

const DATE_FMT = 'yyyy-MM-dd'
const TIME_FMT = 'HH:mm'
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

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
  disabled?: boolean
  /** Disable dates before this day (date mode only). */
  minDate?: Date
  /** Disable dates after this day (date mode only). Useful for date of birth. */
  maxDate?: Date
  /**
   * Date picker UI. `ymd` shows Year / Month / Day columns (best for DOB).
   * `calendar` is the month grid (default for event/scheduling dates).
   */
  datePicker?: 'calendar' | 'ymd'
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
  disabled = false,
  minDate,
  maxDate,
  datePicker = 'calendar',
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
        onPress={() => {
          if (!disabled) setOpen(true)
        }}
        alignItems="center"
        gap="$2.5"
        height={48}
        paddingHorizontal="$4"
        borderWidth={error ? 1.5 : 1}
        borderColor={error ? '$red9' : ui.border}
        borderRadius="$6"
        backgroundColor={ui.surface}
        opacity={disabled ? 0.6 : 1}
        cursor={disabled ? 'default' : 'pointer'}
        hoverStyle={disabled ? undefined : { borderColor: ui.brand }}
        pressStyle={disabled ? undefined : { opacity: 0.9 }}
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
        {open && mode === 'date' && datePicker === 'ymd' ? (
          <YmdPicker
            value={parsed}
            minDate={minDate}
            maxDate={maxDate}
            onSelect={(d) => {
              onChange(format(d, DATE_FMT))
              setOpen(false)
            }}
          />
        ) : null}
        {open && mode === 'date' && datePicker === 'calendar' ? (
          <CalendarPicker
            value={parsed}
            minDate={minDate}
            maxDate={maxDate}
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

function clampDate(date: Date, minDate?: Date, maxDate?: Date): Date {
  let d = date
  if (minDate && isBefore(startOfDay(d), startOfDay(minDate))) d = startOfDay(minDate)
  if (maxDate && isAfter(startOfDay(d), startOfDay(maxDate))) d = startOfDay(maxDate)
  return d
}

/** Year / Month / Day columns — intended for date of birth and similar distant dates. */
function YmdPicker({
  value,
  minDate,
  maxDate,
  onSelect,
}: {
  value: Date | null
  minDate?: Date
  maxDate?: Date
  onSelect: (date: Date) => void
}) {
  const ui = useAppUi()
  const today = startOfDay(new Date())
  const max = maxDate ? startOfDay(maxDate) : today
  const min = minDate
    ? startOfDay(minDate)
    : new Date(max.getFullYear() - 100, 0, 1)

  const initial = clampDate(value ?? new Date(max.getFullYear() - 25, 0, 1), min, max)
  const [year, setYear] = useState(initial.getFullYear())
  const [month, setMonth] = useState(initial.getMonth()) // 0-11
  const [day, setDay] = useState(initial.getDate())

  const years = useMemo(() => {
    const from = min.getFullYear()
    const to = max.getFullYear()
    return Array.from({ length: to - from + 1 }, (_, i) => to - i)
  }, [min, max])

  const months = useMemo(() => {
    return MONTH_LABELS.map((label, index) => ({ label, index })).filter(({ index }) => {
      const first = new Date(year, index, 1)
      const last = new Date(year, index + 1, 0)
      return !isAfter(startOfDay(first), max) && !isBefore(startOfDay(last), min)
    })
  }, [year, min, max])

  const daysInMonth = getDaysInMonth(new Date(year, month, 1))
  const days = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1).filter((d) => {
      const candidate = startOfDay(new Date(year, month, d))
      return !isBefore(candidate, min) && !isAfter(candidate, max)
    })
  }, [year, month, daysInMonth, min, max])

  useEffect(() => {
    if (!months.some((m) => m.index === month) && months[0]) {
      setMonth(months[0].index)
    }
  }, [months, month])

  useEffect(() => {
    if (!days.includes(day)) {
      setDay(days[days.length - 1] ?? 1)
    }
  }, [days, day])

  const preview = clampDate(new Date(year, month, day), min, max)

  return (
    <YStack gap="$3" paddingBottom="$2">
      <Text fontSize={22} fontWeight="800" color={ui.text} alignSelf="center">
        {format(preview, 'd MMM yyyy')}
      </Text>
      <XStack gap="$2" height={220}>
        <WheelColumn
          label="Year"
          items={years}
          selected={year}
          format={(y) => String(y)}
          onSelect={setYear}
        />
        <WheelColumn
          label="Month"
          items={months.map((m) => m.index)}
          selected={month}
          format={(m) => MONTH_LABELS[m]?.slice(0, 3) ?? String(m + 1)}
          onSelect={setMonth}
        />
        <WheelColumn
          label="Day"
          items={days}
          selected={day}
          format={(d) => String(d).padStart(2, '0')}
          onSelect={setDay}
        />
      </XStack>
      <Button tone="primary" borderRadius={999} onPress={() => onSelect(preview)}>
        Set date
      </Button>
    </YStack>
  )
}

function CalendarPicker({
  value,
  minDate,
  maxDate,
  onSelect,
}: {
  value: Date | null
  minDate?: Date
  maxDate?: Date
  onSelect: (date: Date) => void
}) {
  const ui = useAppUi()
  const [month, setMonth] = useState(value ?? maxDate ?? new Date())
  const min = minDate ? startOfDay(minDate) : null
  const max = maxDate ? startOfDay(maxDate) : null
  const today = startOfDay(new Date())
  const todayAllowed =
    (!min || !isBefore(today, min)) && (!max || !isAfter(today, max))

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
              const disabled =
                (min ? isBefore(day, min) : false) || (max ? isAfter(day, max) : false)
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

      {todayAllowed ? (
        <Button
          tone="ghost"
          size="$3"
          alignSelf="center"
          onPress={() => onSelect(today)}
        >
          Today
        </Button>
      ) : null}
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
