export type ZonedWallTime = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second?: number
}

export type ScheduleTimeZoneOption = {
  value: string
  city: string
  region: string
}

/** Map aliases so DB (`name LIKE '%/%'`) and Intl agree. */
export function normalizeIanaTimeZone(value: string): string {
  const trimmed = (value ?? '').trim()
  if (trimmed === 'UTC') return 'Etc/UTC'
  return trimmed
}

export function isValidIanaTimeZone(value: string): boolean {
  const timeZone = normalizeIanaTimeZone(value)
  // DB trigger requires a slash (e.g. Asia/Kolkata, Etc/UTC).
  if (!timeZone || !timeZone.includes('/')) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

/** Always returns a slash-form IANA id suitable for DB storage. */
export function coerceIanaTimeZone(value?: string | null): string {
  const normalized = normalizeIanaTimeZone(value ?? '')
  if (isValidIanaTimeZone(normalized)) return normalized
  if (normalized.includes('/') && normalized.length > 3) {
    // Keep host-selected ids even when this runtime's Intl lacks the zone data.
    return normalized
  }
  return resolveDeviceIanaTimeZone()
}

function readLocalWallParts(date: Date): Required<ZonedWallTime> {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  }
}

export function resolveDeviceIanaTimeZone(): string {
  let candidate = ''
  try {
    candidate = normalizeIanaTimeZone(
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    )
  } catch {
    candidate = ''
  }
  if (isValidIanaTimeZone(candidate)) return candidate
  // Prefer a real city zone when Intl works but the device string was empty/invalid.
  for (const fallback of ['Etc/UTC', 'Asia/Kolkata', 'America/New_York'] as const) {
    if (isValidIanaTimeZone(fallback)) return fallback
  }
  // Last resort for Hermes builds without ICU timezone data — still DB-valid.
  return 'Etc/UTC'
}

export function assertUtcIso(value: string, label = 'Date and time'): string {
  const parsed = new Date(value)
  if (!value || !Number.isFinite(parsed.getTime())) {
    throw new Error(`${label} is invalid`)
  }
  return parsed.toISOString()
}

function readZonedParts(date: Date, timeZone: string): Required<ZonedWallTime> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const read = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value
    return value ? Number.parseInt(value, 10) : Number.NaN
  }

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  }
}

/** Calendar wall-clock parts for an absolute instant in `timeZone`. */
export function getZonedWallTime(value: string | Date, timeZone: string): Required<ZonedWallTime> {
  const date = value instanceof Date ? value : new Date(assertUtcIso(String(value)))
  if (!Number.isFinite(date.getTime())) throw new Error('Date and time is invalid')

  const zone = coerceIanaTimeZone(timeZone)
  if (isValidIanaTimeZone(zone)) {
    try {
      return readZonedParts(date, zone)
    } catch {
      // Hermes / incomplete ICU: fall through to device-local wall clock.
    }
  }
  return readLocalWallParts(date)
}

/**
 * Convert a wall-clock date/time in `timeZone` into a canonical UTC ISO string.
 * Example: 10:00 in Asia/Kolkata → 2026-09-15T04:30:00.000Z
 */
export function zonedWallTimeToUtcIso(parts: ZonedWallTime, timeZone: string): string {
  const year = parts.year
  const month = parts.month
  const day = parts.day
  const hour = parts.hour
  const minute = parts.minute
  const second = parts.second ?? 0

  if (
    ![year, month, day, hour, minute, second].every((n) => Number.isFinite(n)) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    throw new Error('Date and time is invalid')
  }

  const zone = coerceIanaTimeZone(timeZone)
  if (!isValidIanaTimeZone(zone)) {
    // Device-local interpretation when Intl cannot resolve the IANA zone.
    return new Date(year, month - 1, day, hour, minute, second).toISOString()
  }

  try {
    // Guess: treat the wall clock as UTC, then correct by the zone offset at that instant.
    let utcMs = Date.UTC(year, month - 1, day, hour, minute, second)
    for (let i = 0; i < 3; i += 1) {
      const seen = readZonedParts(new Date(utcMs), zone)
      const asUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second)
      const desired = Date.UTC(year, month - 1, day, hour, minute, second)
      utcMs += desired - asUtc
    }

    const verified = readZonedParts(new Date(utcMs), zone)
    if (
      verified.year !== year ||
      verified.month !== month ||
      verified.day !== day ||
      verified.hour !== hour ||
      verified.minute !== minute
    ) {
      throw new Error('Date and time is invalid in the selected timezone')
    }

    return new Date(utcMs).toISOString()
  } catch (error) {
    if (error instanceof Error && error.message.includes('invalid in the selected')) {
      throw error
    }
    return new Date(year, month - 1, day, hour, minute, second).toISOString()
  }
}

/**
 * Re-interpret an existing UTC instant's wall clock from `fromTimeZone` into
 * `toTimeZone` (keep 10:00 as 10:00 when the host changes the IANA zone).
 */
export function rebaseUtcIsoWallClock(
  utcIso: string,
  fromTimeZone: string,
  toTimeZone: string,
): string {
  if (fromTimeZone === toTimeZone) return assertUtcIso(utcIso)
  const wall = getZonedWallTime(utcIso, fromTimeZone)
  return zonedWallTimeToUtcIso(wall, toTimeZone)
}

export function formatZonedDateTime(
  value: string,
  timeZone: string,
  locale = 'en-IN',
): string {
  const zone = coerceIanaTimeZone(timeZone)
  const date = new Date(assertUtcIso(value))
  if (isValidIanaTimeZone(zone)) {
    try {
      return new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: zone,
        timeZoneName: 'short',
      }).format(date)
    } catch {
      // fall through
    }
  }
  return date.toLocaleString(locale)
}

/**
 * Display a stored UTC meeting instant in the viewer's local timezone.
 * Host in IST and participant in US Eastern see different wall clocks for the same instant.
 */
export function formatMeetingInstantForViewer(
  value: string,
  options?: {
    locale?: string
    /** Override viewer zone (defaults to the device IANA timezone). */
    timeZone?: string
    dateStyle?: 'full' | 'long' | 'medium' | 'short'
    timeStyle?: 'full' | 'long' | 'medium' | 'short'
    weekday?: 'long' | 'short' | 'narrow'
    month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow'
    day?: 'numeric' | '2-digit'
    hour?: 'numeric' | '2-digit'
    minute?: 'numeric' | '2-digit'
    withTimeZoneName?: boolean
  },
): string {
  const timeZone = coerceIanaTimeZone(options?.timeZone ?? resolveDeviceIanaTimeZone())
  const date = new Date(assertUtcIso(value))

  const formatWithZone = (zone: string) => {
    if (options?.dateStyle || options?.timeStyle) {
      return new Intl.DateTimeFormat(options.locale, {
        dateStyle: options.dateStyle,
        timeStyle: options.timeStyle,
        timeZone: zone,
      }).format(date)
    }
    return new Intl.DateTimeFormat(options?.locale, {
      weekday: options?.weekday ?? 'short',
      month: options?.month ?? 'short',
      day: options?.day ?? 'numeric',
      hour: options?.hour ?? 'numeric',
      minute: options?.minute ?? '2-digit',
      timeZone: zone,
      timeZoneName: options?.withTimeZoneName === false ? undefined : 'short',
    }).format(date)
  }

  if (isValidIanaTimeZone(timeZone)) {
    try {
      return formatWithZone(timeZone)
    } catch {
      // fall through
    }
  }
  return date.toLocaleString(options?.locale)
}

/** GMT offset label for a zone at the current instant (e.g. "GMT+5:30"). */
export function formatTimeZoneGmtOffset(timeZone: string, at = new Date()): string {
  const zone = coerceIanaTimeZone(timeZone)
  if (!isValidIanaTimeZone(zone)) return 'GMT'
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'shortOffset',
    }).formatToParts(at)
    const raw = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
    return raw.replace('UTC', 'GMT')
  } catch {
    return 'GMT'
  }
}

export function formatScheduleTimeZoneLabel(timeZone: string): string {
  const zone = coerceIanaTimeZone(timeZone)
  const option = SCHEDULE_TIMEZONE_OPTIONS.find((row) => row.value === zone)
  const city = option?.city ?? zone.split('/').pop()?.replace(/_/g, ' ') ?? zone
  return `(${formatTimeZoneGmtOffset(zone)}) ${city}`
}

/** Common global IANA zones for the Zoom-style timezone picker. */
export const SCHEDULE_TIMEZONE_OPTIONS: readonly ScheduleTimeZoneOption[] = [
  { value: 'Pacific/Honolulu', city: 'Honolulu', region: 'Pacific' },
  { value: 'America/Anchorage', city: 'Anchorage', region: 'Americas' },
  { value: 'America/Los_Angeles', city: 'Los Angeles', region: 'Americas' },
  { value: 'America/Denver', city: 'Denver', region: 'Americas' },
  { value: 'America/Chicago', city: 'Chicago', region: 'Americas' },
  { value: 'America/New_York', city: 'New York', region: 'Americas' },
  { value: 'America/Toronto', city: 'Toronto', region: 'Americas' },
  { value: 'America/Sao_Paulo', city: 'São Paulo', region: 'Americas' },
  { value: 'Atlantic/Reykjavik', city: 'Reykjavik', region: 'Atlantic' },
  { value: 'Europe/London', city: 'London', region: 'Europe' },
  { value: 'Europe/Paris', city: 'Paris', region: 'Europe' },
  { value: 'Europe/Berlin', city: 'Berlin', region: 'Europe' },
  { value: 'Europe/Madrid', city: 'Madrid', region: 'Europe' },
  { value: 'Europe/Rome', city: 'Rome', region: 'Europe' },
  { value: 'Europe/Moscow', city: 'Moscow', region: 'Europe' },
  { value: 'Africa/Cairo', city: 'Cairo', region: 'Africa' },
  { value: 'Africa/Johannesburg', city: 'Johannesburg', region: 'Africa' },
  { value: 'Africa/Lagos', city: 'Lagos', region: 'Africa' },
  { value: 'Asia/Dubai', city: 'Dubai', region: 'Asia' },
  { value: 'Asia/Karachi', city: 'Karachi', region: 'Asia' },
  { value: 'Asia/Kolkata', city: 'Kolkata', region: 'Asia' },
  { value: 'Asia/Dhaka', city: 'Dhaka', region: 'Asia' },
  { value: 'Asia/Bangkok', city: 'Bangkok', region: 'Asia' },
  { value: 'Asia/Singapore', city: 'Singapore', region: 'Asia' },
  { value: 'Asia/Hong_Kong', city: 'Hong Kong', region: 'Asia' },
  { value: 'Asia/Shanghai', city: 'Shanghai', region: 'Asia' },
  { value: 'Asia/Tokyo', city: 'Tokyo', region: 'Asia' },
  { value: 'Asia/Seoul', city: 'Seoul', region: 'Asia' },
  { value: 'Australia/Perth', city: 'Perth', region: 'Australia' },
  { value: 'Australia/Sydney', city: 'Sydney', region: 'Australia' },
  { value: 'Pacific/Auckland', city: 'Auckland', region: 'Pacific' },
  { value: 'Etc/UTC', city: 'UTC', region: 'Universal' },
] as const

/** Ordered list used by pickers (device zone prepended by the UI). */
export function listScheduleTimeZoneValues(preferred?: string): string[] {
  const device = resolveDeviceIanaTimeZone()
  const preferredZone = preferred ? coerceIanaTimeZone(preferred) : null
  const values = [
    device,
    ...(preferredZone ? [preferredZone] : []),
    ...SCHEDULE_TIMEZONE_OPTIONS.map((row) => row.value),
  ]
  return values.filter((zone, index, all) => all.indexOf(zone) === index)
}
