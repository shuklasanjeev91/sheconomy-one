export type MeetingFeatureFlags = {
  enhancedLayouts: boolean
  nativeBroadcast: boolean
  captionsV2: boolean
  roleControls: boolean
  audienceChat: boolean
  calendarSync: boolean
}

function enabled(value: string | undefined, defaultValue = true): boolean {
  if (value == null || value === '') return defaultValue
  return !['0', 'false', 'off', 'disabled'].includes(value.toLowerCase())
}

/** Production kill switches; features default on for the combined release. */
export const meetingFeatureFlags: MeetingFeatureFlags = {
  enhancedLayouts: enabled(process.env.EXPO_PUBLIC_MEETING_LAYOUTS_V2),
  nativeBroadcast: enabled(process.env.EXPO_PUBLIC_MEETING_NATIVE_BROADCAST),
  captionsV2: enabled(process.env.EXPO_PUBLIC_MEETING_CAPTIONS_V2),
  roleControls: enabled(process.env.EXPO_PUBLIC_MEETING_ROLE_CONTROLS),
  audienceChat: enabled(process.env.EXPO_PUBLIC_MEETING_AUDIENCE_CHAT),
  calendarSync: enabled(process.env.EXPO_PUBLIC_MEETING_CALENDAR_SYNC),
}
