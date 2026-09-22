import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'sheconomy.meeting.media-prefs.v1'

export type MeetingMediaPrefs = {
  /** Zoom "Original Sound" — relaxes noise suppression / AGC. */
  originalSound?: boolean
  noiseSuppression?: boolean
  /** Prefer HIGH subscribe quality for remote cameras. */
  hdVideo?: boolean
  /** Fitzpatrick tone modifier for reactions ('' | '🏻' | '🏼' | '🏽' | '🏾' | '🏿'). */
  reactionTone?: string
  /** Zoom: stop rendering remote camera video (avatars only) to save bandwidth. */
  stopIncomingVideo?: boolean
  /** Play a soft chime when someone joins or leaves. */
  enterExitSound?: boolean
  /** Include tab/system audio when starting screen share (when the OS allows). */
  shareComputerSound?: boolean
  /** Prefer motion encoding for screen share (video clips / demos). */
  optimizeShareForVideo?: boolean
  /** Open annotation overlay automatically after screen share starts. */
  annotateAfterShare?: boolean
}

export const MEETING_REACTION_TONES = [
  { id: '', label: 'Default', swatch: '#F5D0A9' },
  { id: '🏻', label: 'Light', swatch: '#FADCBC' },
  { id: '🏼', label: 'Medium-light', swatch: '#E0BB95' },
  { id: '🏽', label: 'Medium', swatch: '#C68642' },
  { id: '🏾', label: 'Medium-dark', swatch: '#8D5524' },
  { id: '🏿', label: 'Dark', swatch: '#5C3317' },
] as const

export function parseMeetingMediaPrefs(raw: unknown): MeetingMediaPrefs {
  if (!raw || typeof raw !== 'object') return {}
  const value = raw as Record<string, unknown>
  return {
    originalSound: typeof value.originalSound === 'boolean' ? value.originalSound : undefined,
    noiseSuppression:
      typeof value.noiseSuppression === 'boolean' ? value.noiseSuppression : undefined,
    hdVideo: typeof value.hdVideo === 'boolean' ? value.hdVideo : undefined,
    reactionTone: typeof value.reactionTone === 'string' ? value.reactionTone : undefined,
    stopIncomingVideo:
      typeof value.stopIncomingVideo === 'boolean' ? value.stopIncomingVideo : undefined,
    enterExitSound: typeof value.enterExitSound === 'boolean' ? value.enterExitSound : undefined,
    shareComputerSound:
      typeof value.shareComputerSound === 'boolean' ? value.shareComputerSound : undefined,
    optimizeShareForVideo:
      typeof value.optimizeShareForVideo === 'boolean' ? value.optimizeShareForVideo : undefined,
    annotateAfterShare:
      typeof value.annotateAfterShare === 'boolean' ? value.annotateAfterShare : undefined,
  }
}

export async function loadMeetingMediaPrefs(): Promise<MeetingMediaPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return { noiseSuppression: true, hdVideo: true, reactionTone: '', enterExitSound: true }
    return {
      noiseSuppression: true,
      hdVideo: true,
      reactionTone: '',
      enterExitSound: true,
      ...parseMeetingMediaPrefs(JSON.parse(raw)),
    }
  } catch {
    return { noiseSuppression: true, hdVideo: true, reactionTone: '', enterExitSound: true }
  }
}

export async function saveMeetingMediaPrefs(prefs: MeetingMediaPrefs): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

/** Capture constraints for LiveKit / getUserMedia based on prefs. */
export function meetingAudioCaptureConstraints(prefs: MeetingMediaPrefs): {
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
} {
  if (prefs.originalSound) {
    return {
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: false,
    }
  }
  return {
    echoCancellation: true,
    noiseSuppression: prefs.noiseSuppression !== false,
    autoGainControl: true,
  }
}
