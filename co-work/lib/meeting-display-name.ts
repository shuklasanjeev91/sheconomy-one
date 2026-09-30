import { readPersistentValue, writePersistentValue } from '~/lib/platform/storage'

const INTERNAL_USER_NAME = /^user_[a-z0-9]+$/i
const DATABASE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REMEMBERED_MEETING_NAME_KEY = 'cowork.remembered-display-name.v1'

export function normalizeMeetingDisplayName(value: string | null | undefined): string {
  const name = value?.trim().slice(0, 80) ?? ''
  if (!name || INTERNAL_USER_NAME.test(name) || DATABASE_ID.test(name)) return ''
  return name
}

export function safeMeetingDisplayName(
  value: string | null | undefined,
  fallback = 'Guest',
): string {
  return normalizeMeetingDisplayName(value) || fallback
}

const PLACEHOLDER_NAME = /^guest$/i

export type MeetingNameAccount = {
  is_anonymous?: boolean
  user_metadata?: Record<string, unknown> | null
} | null | undefined

/**
 * Name a participant joins with: what they typed in the preview, the name they
 * asked us to remember, then their account. The "Guest" placeholder never wins
 * over a real name. Email is private and never used. '' when nothing is known.
 */
export function resolveMeetingDisplayName(input: {
  typed?: string | null
  remembered?: string | null
  profile?: { full_name?: string | null; username?: string | null } | null
  user?: MeetingNameAccount
}): string {
  const real = (value: unknown) => {
    const name = normalizeMeetingDisplayName(typeof value === 'string' ? value : '')
    return PLACEHOLDER_NAME.test(name) ? '' : name
  }
  const metadata = input.user?.user_metadata ?? {}
  return (
    real(input.typed) ||
    real(input.remembered) ||
    real(input.profile?.full_name) ||
    real(input.profile?.username) ||
    real(metadata.full_name) ||
    real(metadata.name) ||
    ''
  )
}

export async function loadRememberedMeetingDisplayName(): Promise<string> {
  return normalizeMeetingDisplayName(await readPersistentValue(REMEMBERED_MEETING_NAME_KEY))
}

export async function saveRememberedMeetingDisplayName(value: string | null): Promise<void> {
  await writePersistentValue(
    REMEMBERED_MEETING_NAME_KEY,
    value ? normalizeMeetingDisplayName(value) : '',
  )
}
