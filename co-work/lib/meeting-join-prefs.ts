/**
 * Carry Zoom-style join checkboxes from the Join Meeting page into the lobby.
 * Session storage so a refresh does not silently re-join muted.
 */

export type MeetingJoinPrefs = {
  audioEnabled: boolean
  videoEnabled: boolean
  displayName?: string
}

const STORAGE_KEY = 'sheconomy.meetingJoinPrefs.v1'

export function meetingJoinPrefsFromCheckboxes(input: {
  doNotConnectAudio: boolean
  turnOffVideo: boolean
}): Pick<MeetingJoinPrefs, 'audioEnabled' | 'videoEnabled'> {
  return {
    audioEnabled: !input.doNotConnectAudio,
    videoEnabled: !input.turnOffVideo,
  }
}

export function parseMeetingJoinPrefs(raw: unknown): MeetingJoinPrefs | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  return {
    audioEnabled: value.audioEnabled !== false,
    videoEnabled: value.videoEnabled !== false,
    displayName: typeof value.displayName === 'string' && value.displayName.trim()
      ? value.displayName.trim()
      : undefined,
  }
}

function storage(): Storage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    return sessionStorage
  } catch {
    return null
  }
}

export function saveMeetingJoinPrefs(prefs: MeetingJoinPrefs): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Private mode / quota — lobby still has its own checkboxes.
  }
}

export function loadMeetingJoinPrefs(): MeetingJoinPrefs | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return null
    return parseMeetingJoinPrefs(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}
