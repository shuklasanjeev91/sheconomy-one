/**
 * Co-Work real-time architecture — production meetings use an SFU (LiveKit).
 *
 * Layers are intentionally separate so UI never talks to WebRTC peers directly
 * and the media backend can be swapped without rewriting screens.
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ UI (MeetingRoomScreen, panels, toolbar)                     │
 *   └───────────────────────────┬─────────────────────────────────┘
 *                               │ MeetingRealtimeSession
 *   ┌───────────────────────────▼─────────────────────────────────┐
 *   │ Meeting state     │ Participant state │ Chat                │
 *   │ (state machine)   │ (presence rows)   │ (meeting_chat)      │
 *   └─────────┬─────────┴─────────┬─────────┴──────────┬──────────┘
 *             │                   │                    │
 *   ┌─────────▼─────────┐ ┌───────▼────────┐ ┌─────────▼──────────┐
 *   │ Signaling         │ │ Presence       │ │ Media (SFU only)   │
 *   │ Supabase Realtime │ │ participants + │ │ LiveKit adapter    │
 *   │ broadcast/postgres│ │ waiting room   │ │ (replaceable)      │
 *   └───────────────────┘ └────────────────┘ └────────────────────┘
 *
 * Do NOT use a peer-to-peer mesh for large meetings. Mesh is legacy/disabled
 * for production Co-Work rooms — see `createMediaSession`.
 */

export const MEETING_REALTIME_ARCHITECTURE = 'sfu' as const

export type MeetingRealtimeLayer =
  | 'signaling'
  | 'media'
  | 'presence'
  | 'chat'
  | 'meeting_state'
  | 'participant_state'

export const MEETING_REALTIME_LAYERS: readonly MeetingRealtimeLayer[] = [
  'signaling',
  'media',
  'presence',
  'chat',
  'meeting_state',
  'participant_state',
] as const

export type MeetingMediaTransport = 'sfu' | 'mesh_legacy_disabled'

/** Production Co-Work meetings always use SFU media (LiveKit). */
export function meetingMediaTransport(): MeetingMediaTransport {
  return 'sfu'
}

export function isSfuMeetingArchitecture(): boolean {
  return meetingMediaTransport() === 'sfu'
}

export function meetingRealtimeLayerDescription(layer: MeetingRealtimeLayer): string {
  switch (layer) {
    case 'signaling':
      return 'Supabase Realtime channel for control signals and postgres change fan-out.'
    case 'media':
      return 'LiveKit SFU for audio, video, and screen share — never a P2P mesh for meetings.'
    case 'presence':
      return 'meeting_participants rows + channel presence for who is in / waiting.'
    case 'chat':
      return 'meeting_chat messages over postgres + Realtime, independent of media.'
    case 'meeting_state':
      return 'Centralized lifecycle state machine (LOBBY → CONNECTED → ENDED, etc.).'
    case 'participant_state':
      return 'Per-participant mute/camera/role/hand state synced via presence + controls.'
  }
}
