/** Shared invite/calendar timezone helpers for Deno edge functions. */

export function normalizeIanaTimeZone(value: string): string {
  const trimmed = value.trim()
  if (trimmed === 'UTC') return 'Etc/UTC'
  return trimmed
}

export function isValidIanaTimeZone(value: string): boolean {
  const timeZone = normalizeIanaTimeZone(value)
  if (!timeZone || !timeZone.includes('/')) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

export function resolveInviteDisplayTimeZone(input: {
  inviteeTimeZone?: string | null
  profileTimeZone?: string | null
}): { timeZone: string; source: 'invitee' | 'profile' | 'utc' } {
  const invitee = input.inviteeTimeZone ? normalizeIanaTimeZone(input.inviteeTimeZone) : ''
  if (invitee && isValidIanaTimeZone(invitee)) {
    return { timeZone: invitee, source: 'invitee' }
  }
  const profile = input.profileTimeZone ? normalizeIanaTimeZone(input.profileTimeZone) : ''
  if (profile && isValidIanaTimeZone(profile)) {
    return { timeZone: profile, source: 'profile' }
  }
  return { timeZone: 'Etc/UTC', source: 'utc' }
}

export function formatInviteWhen(input: {
  startsAt: string
  endsAt?: string | null
  inviteeTimeZone?: string | null
  profileTimeZone?: string | null
  hostTimeZone?: string | null
  locale?: string
}) {
  const resolved = resolveInviteDisplayTimeZone({
    inviteeTimeZone: input.inviteeTimeZone,
    profileTimeZone: input.profileTimeZone,
  })
  const locale = input.locale || 'en'
  const dateLabel = new Intl.DateTimeFormat(locale, {
    timeZone: resolved.timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(input.startsAt))
  const timeLabel = new Intl.DateTimeFormat(locale, {
    timeZone: resolved.timeZone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(input.startsAt))
  const whenLabel = `${dateLabel}, ${timeLabel}`
  const endsLabel = input.endsAt
    ? `Ends ${new Intl.DateTimeFormat(locale, {
        timeZone: resolved.timeZone,
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(new Date(input.endsAt))}`
    : null
  const hostZone = input.hostTimeZone ? normalizeIanaTimeZone(input.hostTimeZone) : ''
  const hostZoneHint =
    hostZone && isValidIanaTimeZone(hostZone) && hostZone !== resolved.timeZone
      ? `Host scheduled in ${hostZone}`
      : null
  return {
    timeZone: resolved.timeZone,
    source: resolved.source,
    dateLabel,
    timeLabel,
    whenLabel,
    endsLabel,
    hostZoneHint,
  }
}
