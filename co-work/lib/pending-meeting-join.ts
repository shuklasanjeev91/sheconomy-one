import AsyncStorage from '@react-native-async-storage/async-storage'

import { pathFromIncomingUrl } from '~/lib/platform/path-from-incoming-url'

const STORAGE_KEY = '@sheconomy/co-work/pending-meeting-join/v1'
export const PENDING_MEETING_JOIN_MAX_AGE_MS = 24 * 60 * 60 * 1000

export type PendingMeetingJoin = {
  path: string
  code: string
  capturedAt: number
}

function splitPath(value: string): { pathname: string; suffix: string } {
  const queryIndex = value.indexOf('?')
  const hashIndex = value.indexOf('#')
  const suffixStart =
    queryIndex === -1 ? hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex)
  if (suffixStart === -1) return { pathname: value, suffix: '' }
  return { pathname: value.slice(0, suffixStart), suffix: value.slice(suffixStart) }
}

export function meetingAutoJoinFromPath(path: string | null): PendingMeetingJoin | null {
  if (!path) return null
  const normalized = path.startsWith('/') ? path : `/${path}`
  const { pathname, suffix } = splitPath(normalized)
  const match = pathname.match(/^\/co-?work\/meeting\/([^/?#]+)(?:\/(live|ended))?\/?$/i)
  if (!match) return null
  if (match[2]?.toLowerCase() === 'ended') return null

  const code = decodeURIComponent(match[1] ?? '').trim()
  if (!code) return null

  return {
    path: `/co-work/meeting/${encodeURIComponent(code)}/live${suffix}`,
    code,
    capturedAt: Date.now(),
  }
}

export function meetingAutoJoinFromIncomingUrl(url: string | null): PendingMeetingJoin | null {
  return meetingAutoJoinFromPath(url ? pathFromIncomingUrl(url) : null)
}

export async function savePendingMeetingJoinFromUrl(url: string | null): Promise<boolean> {
  const pending = meetingAutoJoinFromIncomingUrl(url)
  if (!pending) return false
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
  return true
}

export async function consumePendingMeetingJoin(
  now = Date.now(),
): Promise<PendingMeetingJoin | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  await AsyncStorage.removeItem(STORAGE_KEY)

  try {
    const parsed = JSON.parse(raw) as PendingMeetingJoin
    if (!parsed?.path || !parsed?.code || typeof parsed.capturedAt !== 'number') return null
    if (now - parsed.capturedAt > PENDING_MEETING_JOIN_MAX_AGE_MS) return null
    return parsed
  } catch {
    return null
  }
}
