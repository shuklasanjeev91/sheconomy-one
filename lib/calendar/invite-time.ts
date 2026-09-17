import {
  formatMeetingInstantForViewer,
  isValidIanaTimeZone,
  normalizeIanaTimeZone,
} from '~/lib/calendar/timezone'

export type InviteTimeZoneSource = 'invitee' | 'profile' | 'utc'

export type ResolvedInviteDisplayTime = {
  timeZone: string
  source: InviteTimeZoneSource
  dateLabel: string
  timeLabel: string
  whenLabel: string
  endsLabel: string | null
  /** Secondary line so host intent stays visible when recipient zone differs. */
  hostZoneHint: string | null
}

/**
 * Pick the timezone used in invite email / calendar copy.
 * Never falls back to the host zone as if it were the recipient's local time.
 */
export function resolveInviteDisplayTimeZone(input: {
  inviteeTimeZone?: string | null
  profileTimeZone?: string | null
}): { timeZone: string; source: InviteTimeZoneSource } {
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

export function formatInviteDisplayTime(input: {
  startsAt: string
  endsAt?: string | null
  inviteeTimeZone?: string | null
  profileTimeZone?: string | null
  hostTimeZone?: string | null
  locale?: string
}): ResolvedInviteDisplayTime {
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
  const whenLabel = formatMeetingInstantForViewer(input.startsAt, {
    timeZone: resolved.timeZone,
    locale,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    withTimeZoneName: true,
  })
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
    hostZone &&
    isValidIanaTimeZone(hostZone) &&
    hostZone !== resolved.timeZone
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
