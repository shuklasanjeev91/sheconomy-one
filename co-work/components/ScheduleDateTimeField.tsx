import { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView } from 'react-native'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'

import { AppBottomSheet, Button, Field, Icons, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import {
  coerceIanaTimeZone,
  getZonedWallTime,
  isValidIanaTimeZone,
  resolveDeviceIanaTimeZone,
  zonedWallTimeToUtcIso,
  type ZonedWallTime,
} from '~/lib/calendar/timezone'

type ScheduleDateTimeFieldProps = {
  value: string
  onChange: (iso: string) => void
  /** IANA zone used to interpret the wall-clock picker (stored separately on the meeting). */
  timeZone?: string
  label?: string
  /** Earliest selectable day. Defaults to today so meetings cannot be booked in the past. */
  minDate?: Date
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MINUTE_STEP = 5
const CELL_HEIGHT = 40
const CELL_GAP = 4
const WHEEL_HEIGHT = 232
const ROW_HEIGHT = 44
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP)
const QUICK_TIMES = [
  { label: '9:00 AM', hours: 9 },
  { label: '12:00 PM', hours: 12 },
  { label: '3:00 PM', hours: 15 },
  { label: '6:00 PM', hours: 18 },
]

type DraftWall = Required<ZonedWallTime>

function wallToUtcIso(wall: DraftWall, timeZone: string): string {
  return zonedWallTimeToUtcIso(wall, timeZone)
}

function wallFromUtcIso(iso: string, timeZone: string): DraftWall {
  return getZonedWallTime(iso, timeZone)
}

function nextFullHourWall(timeZone: string): DraftWall {
  const zone = coerceIanaTimeZone(timeZone)
  try {
    const now = getZonedWallTime(new Date().toISOString(), zone)
    let hour = now.hour + 1
    let { year, month, day } = now
    if (hour >= 24) {
      hour = 0
      const nextDay = new Date(Date.UTC(year, month - 1, day + 1))
      year = nextDay.getUTCFullYear()
      month = nextDay.getUTCMonth() + 1
      day = nextDay.getUTCDate()
    }
    return { year, month, day, hour, minute: 0, second: 0 }
  } catch {
    const local = new Date()
    local.setMinutes(0, 0, 0)
    local.setHours(local.getHours() + 1)
    return {
      year: local.getFullYear(),
      month: local.getMonth() + 1,
      day: local.getDate(),
      hour: local.getHours(),
      minute: 0,
      second: 0,
    }
  }
}

function snapWall(wall: DraftWall): DraftWall {
  const minutes = Math.round(wall.minute / MINUTE_STEP) * MINUTE_STEP
  if (minutes >= 60) {
    return { ...wall, hour: (wall.hour + 1) % 24, minute: 0, second: 0 }
  }
  return { ...wall, minute: minutes, second: 0 }
}

function parseWall(iso: string, timeZone: string): DraftWall | null {
  if (!iso) return null
  try {
    return snapWall(wallFromUtcIso(iso, timeZone))
  } catch {
    return null
  }
}

function wallAsLocalDate(wall: DraftWall): Date {
  // Local Date used only for calendar UI (date-fns); not for UTC conversion.
  return new Date(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0, 0)
}

function formatWallDate(wall: DraftWall): string {
  return format(wallAsLocalDate(wall), 'EEE, d MMM yyyy')
}

function formatWallTime(wall: DraftWall): string {
  return format(wallAsLocalDate(wall), 'h:mm a')
}

function withDay(day: Date, wall: DraftWall): DraftWall {
  return {
    ...wall,
    year: day.getFullYear(),
    month: day.getMonth() + 1,
    day: day.getDate(),
    second: 0,
  }
}

function withTime(wall: DraftWall, hours: number, minutes: number): DraftWall {
  return { ...wall, hour: hours, minute: minutes, second: 0 }
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Date/time picker for scheduling — one Tamagui sheet for web, iOS and Android.
 *
 * Wall-clock values are interpreted in `timeZone` and converted to UTC ISO on confirm.
 *
 * `@react-native-community/datetimepicker` cannot be used here: Metro stubs its
 * native component and TurboModules (`lib/metro-stubs/datetimepicker-*`) and the
 * VxRN release bundle aliases the whole package to a no-op (`vite.config.ts`).
 *
 * Layout note: the sheet body sizes itself to its content, so nothing in here
 * may use `flex` for vertical space — a `flex` child would resolve to zero
 * height and every row would paint on top of the next. Heights are explicit.
 */
export function ScheduleDateTimeField({
  value,
  onChange,
  timeZone: timeZoneProp,
  label = 'Date & time',
  minDate,
}: ScheduleDateTimeFieldProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const timeZone =
    timeZoneProp && isValidIanaTimeZone(timeZoneProp)
      ? coerceIanaTimeZone(timeZoneProp)
      : timeZoneProp && timeZoneProp.includes('/')
        ? coerceIanaTimeZone(timeZoneProp)
        : resolveDeviceIanaTimeZone()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'date' | 'time'>('date')
  const [draft, setDraft] = useState<DraftWall>(() =>
    parseWall(value, timeZone) ?? nextFullHourWall(timeZone),
  )

  const selected = useMemo(() => parseWall(value, timeZone), [timeZone, value])
  const minDay = useMemo(() => startOfDay(minDate ?? new Date()), [minDate])

  useEffect(() => {
    if (!open) {
      setDraft(parseWall(value, timeZone) ?? nextFullHourWall(timeZone))
    }
  }, [open, timeZone, value])

  function openSheet() {
    setDraft(parseWall(value, timeZone) ?? nextFullHourWall(timeZone))
    setStep('date')
    setOpen(true)
  }

  function confirm() {
    try {
      onChange(wallToUtcIso(snapWall(draft), timeZone))
      setOpen(false)
    } catch {
      // Keep the sheet open if the wall clock is invalid in this zone.
    }
  }

  return (
    <Field label={label}>
      <YStack gap="$2">
        <XStack
          onPress={openSheet}
          alignItems="center"
          gap="$3"
          minHeight={56}
          paddingHorizontal="$4"
          paddingVertical="$2.5"
          borderRadius={14}
          borderWidth={1}
          borderColor={coworkUi.borderSoft}
          backgroundColor="rgba(255,255,255,0.05)"
          cursor="pointer"
          aria-label="Choose meeting date and time"
          hoverStyle={{ borderColor: coworkUi.brand }}
          pressStyle={{ opacity: 0.85 }}
        >
          <Icons.CalendarDays size={18} color={coworkUi.brand} />
          <YStack flex={1} gap={2}>
            <Text
              fontSize={15}
              fontWeight="600"
              color={selected ? coworkUi.text : coworkUi.textMuted}
              numberOfLines={1}
            >
              {selected ? formatWallDate(selected) : 'Select date & time'}
            </Text>
            {selected ? (
              <Text fontSize={12} color={coworkUi.textMuted}>
                {formatWallTime(selected)} · {timeZone}
              </Text>
            ) : null}
          </YStack>
          <Icons.ChevronDown size={18} color={coworkUi.textMuted} />
        </XStack>

        <Text fontSize={11} color={coworkUi.textMuted}>
          Wall clock in {timeZone}; stored as UTC.
        </Text>
      </YStack>

      <AppBottomSheet
        open={open}
        onOpenChange={setOpen}
        title={label}
        // The calendar is the tall step and has no inner scroller, so it may use
        // the sheet's. The time step scrolls inside its own wheels instead.
        scrollable={step === 'date'}
        footer={
          <XStack gap="$3">
            <Button flex={1} tone="outline" borderRadius={999} onPress={() => setOpen(false)}>
              Cancel
            </Button>
            <Button flex={1} tone="primary" borderRadius={999} onPress={confirm}>
              Confirm
            </Button>
          </XStack>
        }
      >
        <YStack gap="$4" width="100%">
          <YStack gap="$1" alignItems="center" minHeight={56}>
            <Text fontSize={20} fontWeight="800" color={coworkUi.text} letterSpacing={-0.4}>
              {formatWallDate(draft)}
            </Text>
            <Text fontSize={16} fontWeight="700" color={coworkUi.brand}>
              {formatWallTime(draft)}
            </Text>
            <Text fontSize={12} color={coworkUi.textMuted}>
              {timeZone}
            </Text>
          </YStack>

          <XStack
            gap="$2"
            height={48}
            padding={4}
            borderRadius={999}
            borderWidth={1}
            borderColor={coworkUi.borderSoft}
            backgroundColor={coworkUi.surfaceMuted}
          >
            <StepTab
              label="Date"
              icon={Icons.Calendar}
              active={step === 'date'}
              onPress={() => setStep('date')}
            />
            <StepTab
              label="Time"
              icon={Icons.Clock}
              active={step === 'time'}
              onPress={() => setStep('time')}
            />
          </XStack>

          {step === 'date' ? (
            <CalendarPanel
              value={wallAsLocalDate(draft)}
              minDay={minDay}
              onSelect={(day) => {
                setDraft(withDay(day, draft))
                setStep('time')
              }}
            />
          ) : (
            <TimePanel value={draft} onChange={setDraft} />
          )}
        </YStack>
      </AppBottomSheet>
    </Field>
  )
}

function StepTab({
  label,
  icon: Icon,
  active,
  onPress,
}: {
  label: string
  icon: typeof Icons.Calendar
  active: boolean
  onPress: () => void
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  return (
    <XStack
      flex={1}
      minHeight={40}
      alignItems="center"
      justifyContent="center"
      gap="$2"
      borderRadius={999}
      backgroundColor={active ? coworkUi.brand : 'transparent'}
      cursor="pointer"
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
    >
      <Icon size={16} color={active ? 'white' : coworkUi.textMuted} />
      <Text fontSize={14} fontWeight="700" color={active ? 'white' : coworkUi.textMuted}>
        {label}
      </Text>
    </XStack>
  )
}

function CalendarPanel({
  value,
  minDay,
  onSelect,
}: {
  value: Date
  minDay: Date
  onSelect: (day: Date) => void
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [month, setMonth] = useState(() => startOfMonth(value))

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
    return chunk(eachDayOfInterval({ start, end }), 7)
  }, [month])

  const quickDays = useMemo(
    () => [
      { label: 'Today', day: startOfDay(new Date()) },
      { label: 'Tomorrow', day: startOfDay(addDays(new Date(), 1)) },
      { label: 'Next week', day: startOfDay(addDays(new Date(), 7)) },
    ],
    [],
  )

  const canGoBack = !isBefore(endOfMonth(subMonths(month, 1)), minDay)
  const today = startOfDay(new Date())

  return (
    <YStack gap="$3" width="100%">
      <XStack height={44} alignItems="center" justifyContent="space-between">
        <NavButton
          icon={Icons.ChevronLeft}
          disabled={!canGoBack}
          onPress={() => setMonth((current) => subMonths(current, 1))}
        />
        <Text fontSize={16} fontWeight="700" color={coworkUi.text}>
          {format(month, 'MMMM yyyy')}
        </Text>
        <NavButton
          icon={Icons.ChevronRight}
          onPress={() => setMonth((current) => addMonths(current, 1))}
        />
      </XStack>

      <XStack height={22} gap={CELL_GAP}>
        {WEEKDAYS.map((weekday) => (
          <XStack key={weekday} flex={1} alignItems="center" justifyContent="center">
            <Text fontSize={12} fontWeight="700" color={coworkUi.textMuted}>
              {weekday}
            </Text>
          </XStack>
        ))}
      </XStack>

      <YStack gap={CELL_GAP} height={weeks.length * (CELL_HEIGHT + CELL_GAP)}>
        {weeks.map((week) => (
          <XStack key={week[0].toISOString()} height={CELL_HEIGHT} gap={CELL_GAP}>
            {week.map((day) => {
              const isSelected = isSameDay(day, value)
              const isToday = isSameDay(day, today)
              const outside = !isSameMonth(day, month)
              const disabled = isBefore(day, minDay)
              return (
                <XStack
                  key={day.toISOString()}
                  flex={1}
                  height={CELL_HEIGHT}
                  alignItems="center"
                  justifyContent="center"
                  borderRadius={999}
                  borderWidth={isToday && !isSelected ? 1 : 0}
                  borderColor={coworkUi.brand}
                  backgroundColor={isSelected ? coworkUi.brand : 'transparent'}
                  opacity={disabled ? 0.28 : 1}
                  cursor={disabled ? 'default' : 'pointer'}
                  pressStyle={disabled ? undefined : { opacity: 0.7 }}
                  onPress={disabled ? undefined : () => onSelect(day)}
                >
                  <Text
                    fontSize={14}
                    fontWeight={isSelected ? '800' : '500'}
                    color={isSelected ? 'white' : outside ? coworkUi.textMuted : coworkUi.text}
                  >
                    {format(day, 'd')}
                  </Text>
                </XStack>
              )
            })}
          </XStack>
        ))}
      </YStack>

      <XStack gap="$2" minHeight={36}>
        {quickDays.map((quick) => {
          const disabled = isBefore(quick.day, minDay)
          return (
            <Chip
              key={quick.label}
              label={quick.label}
              disabled={disabled}
              active={isSameDay(quick.day, value)}
              onPress={() => {
                setMonth(startOfMonth(quick.day))
                onSelect(quick.day)
              }}
            />
          )
        })}
      </XStack>
    </YStack>
  )
}

function TimePanel({
  value,
  onChange,
}: {
  value: DraftWall
  onChange: (next: DraftWall) => void
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const hour = value.hour
  const minute = Math.min(55, Math.round(value.minute / MINUTE_STEP) * MINUTE_STEP)

  return (
    <YStack gap="$3" width="100%">
      <XStack gap="$3" height={WHEEL_HEIGHT}>
        <WheelColumn
          label="Hour"
          items={HOURS}
          selected={hour}
          formatItem={(item) => format(wallAsLocalDate(withTime(value, item, 0)), 'h a')}
          onSelect={(item) => onChange(withTime(value, item, minute))}
        />
        <WheelColumn
          label="Minute"
          items={MINUTES}
          selected={minute}
          formatItem={(item) => String(item).padStart(2, '0')}
          onSelect={(item) => onChange(withTime(value, hour, item))}
        />
      </XStack>

      <XStack gap="$2" minHeight={36}>
        {QUICK_TIMES.map((quick) => (
          <Chip
            key={quick.label}
            label={quick.label}
            active={hour === quick.hours && minute === 0}
            onPress={() => onChange(withTime(value, quick.hours, 0))}
          />
        ))}
      </XStack>

      <Text fontSize={12} color={coworkUi.textMuted}>
        Times are interpreted in the selected timezone, then stored as UTC.
      </Text>
    </YStack>
  )
}

function WheelColumn({
  label,
  items,
  selected,
  formatItem,
  onSelect,
}: {
  label: string
  items: number[]
  selected: number
  formatItem: (item: number) => string
  onSelect: (item: number) => void
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const scrollRef = useRef<ScrollView | null>(null)
  const aligned = useRef(false)
  const index = items.indexOf(selected)

  return (
    <YStack flex={1} height={WHEEL_HEIGHT} gap="$2">
      <Text
        height={18}
        fontSize={12}
        fontWeight="700"
        color={coworkUi.textMuted}
        alignSelf="center"
      >
        {label}
      </Text>
      <YStack
        height={WHEEL_HEIGHT - 26}
        borderWidth={1}
        borderColor={coworkUi.borderSoft}
        borderRadius={14}
        backgroundColor={coworkUi.surfaceMuted}
        overflow="hidden"
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: 6 }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          onContentSizeChange={() => {
            if (aligned.current || index < 0) return
            aligned.current = true
            scrollRef.current?.scrollTo({
              y: Math.max(0, index * (ROW_HEIGHT + 4) - ROW_HEIGHT),
              animated: false,
            })
          }}
        >
          {items.map((item) => {
            const active = item === selected
            return (
              <XStack
                key={item}
                height={ROW_HEIGHT}
                alignItems="center"
                justifyContent="center"
                marginHorizontal={6}
                marginVertical={2}
                borderRadius={10}
                backgroundColor={active ? coworkUi.brand : 'transparent'}
                cursor="pointer"
                pressStyle={{ opacity: 0.75 }}
                onPress={() => onSelect(item)}
              >
                <Text
                  fontSize={16}
                  fontWeight={active ? '800' : '500'}
                  color={active ? 'white' : coworkUi.text}
                >
                  {formatItem(item)}
                </Text>
              </XStack>
            )
          })}
        </ScrollView>
      </YStack>
    </YStack>
  )
}

function Chip({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  return (
    <XStack
      flex={1}
      height={36}
      paddingHorizontal="$2"
      alignItems="center"
      justifyContent="center"
      borderRadius={999}
      borderWidth={1}
      borderColor={active ? coworkUi.brand : coworkUi.borderSoft}
      backgroundColor={active ? coworkUi.brandMuted : 'transparent'}
      opacity={disabled ? 0.4 : 1}
      cursor={disabled ? 'default' : 'pointer'}
      pressStyle={disabled ? undefined : { opacity: 0.75 }}
      onPress={disabled ? undefined : onPress}
    >
      <Text
        fontSize={13}
        fontWeight="600"
        numberOfLines={1}
        color={active ? coworkUi.text : coworkUi.textSecondary}
      >
        {label}
      </Text>
    </XStack>
  )
}

function NavButton({
  icon: Icon,
  disabled,
  onPress,
}: {
  icon: typeof Icons.ChevronLeft
  disabled?: boolean
  onPress: () => void
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  return (
    <XStack
      width={40}
      height={40}
      alignItems="center"
      justifyContent="center"
      borderRadius={999}
      borderWidth={1}
      borderColor={coworkUi.borderSoft}
      opacity={disabled ? 0.35 : 1}
      cursor={disabled ? 'default' : 'pointer'}
      pressStyle={disabled ? undefined : { opacity: 0.7 }}
      onPress={disabled ? undefined : onPress}
    >
      <Icon size={20} color={coworkUi.text} />
    </XStack>
  )
}

export function defaultScheduleDateTime(timeZone = resolveDeviceIanaTimeZone()) {
  return wallToUtcIso(nextFullHourWall(timeZone), timeZone)
}
