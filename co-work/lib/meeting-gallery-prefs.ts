import AsyncStorage from '@react-native-async-storage/async-storage'

import type { MeetingViewMode } from '~/co-work/lib/meeting-state-machine'

const STORAGE_KEY = 'sheconomy.meeting.gallery-prefs.v1'

export type MeetingGalleryPrefs = {
  viewMode?: MeetingViewMode
  denseGallery?: boolean
  hideSelfView?: boolean
  /** Zoom: hide participants whose camera is off from the gallery. */
  hideNonVideoParticipants?: boolean
  /** Prefer filmstrip beside the stage during speaker / screen-share (side-by-side). */
  sideBySideShare?: boolean
  /** Gallery shows only active speakers (+ pins / spotlight / self). */
  activeSpeakersOnly?: boolean
  participantStripMinimized?: boolean
}

export function parseMeetingGalleryPrefs(raw: unknown): MeetingGalleryPrefs {
  if (!raw || typeof raw !== 'object') return {}
  const value = raw as Record<string, unknown>
  const viewMode =
    value.viewMode === 'gallery' || value.viewMode === 'speaker' || value.viewMode === 'screen-share'
      ? value.viewMode
      : undefined
  return {
    viewMode,
    denseGallery: typeof value.denseGallery === 'boolean' ? value.denseGallery : undefined,
    hideSelfView: typeof value.hideSelfView === 'boolean' ? value.hideSelfView : undefined,
    hideNonVideoParticipants:
      typeof value.hideNonVideoParticipants === 'boolean'
        ? value.hideNonVideoParticipants
        : undefined,
    sideBySideShare:
      typeof value.sideBySideShare === 'boolean' ? value.sideBySideShare : undefined,
    activeSpeakersOnly:
      typeof value.activeSpeakersOnly === 'boolean' ? value.activeSpeakersOnly : undefined,
    participantStripMinimized:
      typeof value.participantStripMinimized === 'boolean'
        ? value.participantStripMinimized
        : undefined,
  }
}

export async function loadMeetingGalleryPrefs(): Promise<MeetingGalleryPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return parseMeetingGalleryPrefs(JSON.parse(raw))
  } catch {
    return {}
  }
}

export async function saveMeetingGalleryPrefs(prefs: MeetingGalleryPrefs): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}
