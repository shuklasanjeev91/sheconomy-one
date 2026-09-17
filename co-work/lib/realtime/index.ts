export {
  MEETING_REALTIME_ARCHITECTURE,
  MEETING_REALTIME_LAYERS,
  isSfuMeetingArchitecture,
  meetingMediaTransport,
  meetingRealtimeLayerDescription,
  type MeetingMediaTransport,
  type MeetingRealtimeLayer,
} from '~/co-work/lib/realtime/layers'

export {
  composeMeetingRealtimeSession,
  createUnavailableMediaAdapter,
  type MeetingCollaborationAdapter,
  type MeetingMediaAdapter,
  type MeetingMediaSnapshot,
  type MeetingRealtimeSession,
} from '~/co-work/lib/realtime/meeting-session'

export { createLiveKitMeetingMediaAdapter } from '~/co-work/lib/realtime/livekit-media-adapter'
export {
  createPresenceCollaborationAdapter,
  type MeetingPresenceCollaborationSource,
} from '~/co-work/lib/realtime/presence-collaboration-adapter'
