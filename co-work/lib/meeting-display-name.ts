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

export async function loadRememberedMeetingDisplayName(): Promise<string> {
  return normalizeMeetingDisplayName(await readPersistentValue(REMEMBERED_MEETING_NAME_KEY))
}

export async function saveRememberedMeetingDisplayName(value: string | null): Promise<void> {
  await writePersistentValue(
    REMEMBERED_MEETING_NAME_KEY,
    value ? normalizeMeetingDisplayName(value) : '',
  )
}
