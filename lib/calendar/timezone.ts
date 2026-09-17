export type ZonedWallTime = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second?: number
}

/** Map aliases so DB (`name LIKE '%/%'`) and Intl agree. */
export function normalizeIanaTimeZone(value: string): string {
  const trimmed = value.trim()
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

export function resolveDeviceIanaTimeZone(): string {
  const candidate = normalizeIanaTimeZone(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Etc/UTC',
  )
  return isValidIanaTimeZone(candidate) ? candidate : 'Etc/UTC'
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
  if (!isValidIanaTimeZone(timeZone)) throw new Error('A valid IANA timezone is required')
  const date = value instanceof Date ? value : new Date(assertUtcIso(String(value)))
  if (!Number.isFinite(date.getTime())) throw new Error('Date and time is invalid')
  return readZonedParts(date, timeZone)
}

/**
 * Convert a wall-clock date/time in `timeZone` into a canonical UTC ISO string.
 * Example: 10:00 in Asia/Kolkata → 2026-09-15T04:30:00.000Z
 */
export function zonedWallTimeToUtcIso(parts: ZonedWallTime, timeZone: string): string {
  if (!isValidIanaTimeZone(timeZone)) throw new Error('A valid IANA timezone is required')

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

  // Guess: treat the wall clock as UTC, then correct by the zone offset at that instant.
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second)
  for (let i = 0; i < 3; i += 1) {
    const seen = readZonedParts(new Date(utcMs), timeZone)
    const asUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second)
    const desired = Date.UTC(year, month - 1, day, hour, minute, second)
    utcMs += desired - asUtc
  }

  const verified = readZonedParts(new Date(utcMs), timeZone)
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
  if (!isValidIanaTimeZone(timeZone)) throw new Error('A valid IANA timezone is required')
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(new Date(assertUtcIso(value)))
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
  const timeZone = options?.timeZone ?? resolveDeviceIanaTimeZone()
  if (!isValidIanaTimeZone(timeZone)) throw new Error('A valid IANA timezone is required')

  if (options?.dateStyle || options?.timeStyle) {
    return new Intl.DateTimeFormat(options.locale, {
      dateStyle: options.dateStyle,
      timeStyle: options.timeStyle,
      timeZone,
    }).format(new Date(assertUtcIso(value)))
  }

  return new Intl.DateTimeFormat(options?.locale, {
    weekday: options?.weekday ?? 'short',
    month: options?.month ?? 'short',
    day: options?.day ?? 'numeric',
    hour: options?.hour ?? 'numeric',
    minute: options?.minute ?? '2-digit',
    timeZone,
    timeZoneName: options?.withTimeZoneName === false ? undefined : 'short',
  }).format(new Date(assertUtcIso(value)))
}

/** Common IANA zones offered in the schedule form (device zone is always first). */
export const SCHEDULE_TIMEZONE_OPTIONS = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Australia/Sydney',
  'Etc/UTC',
] as const
