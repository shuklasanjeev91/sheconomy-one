import type { MeetingChatMessage, MeetingParticipant } from '~/co-work/lib/types'

/**
 * Replaceable media transport for Co-Work meetings.
 * Production implementation: mediasoup SFU controls via `createSfuMeetingMediaAdapter`.
 * UI must depend on this interface — never on SFU client types directly
 * for mic/camera/share/device control.
 */
export type MeetingMediaAdapter = {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  toggleMic: () => void | Promise<void>
  toggleCamera: () => void | Promise<void>
  startScreenShare: () => void | Promise<void>
  stopScreenShare: () => void | Promise<void>
  changeAudioDevice: (deviceId: string) => Promise<void>
  changeVideoDevice: (deviceId: string) => Promise<void>
  /** Optional readouts for UI overlay (not required to swap transports). */
  getMediaSnapshot?: () => MeetingMediaSnapshot
}

export type MeetingMediaSnapshot = {
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  speakerOn: boolean
}

/**
 * Presence + chat + hand-raise — kept off the media adapter so chat/people
 * keep working if the SFU is reconnecting.
 */
export type MeetingCollaborationAdapter = {
  getParticipants: () => MeetingParticipant[]
  sendChatMessage: (
    message: string,
    recipientId?: string | null,
  ) => Promise<MeetingChatMessage>
  raiseHand: () => void
  lowerHand: () => void
  joinMeeting?: () => Promise<void>
  leaveMeeting?: () => Promise<void>
}

/**
 * Unified session surface from the #31 spec.
 * Composed from media + collaboration adapters so either layer can be replaced.
 */
export type MeetingRealtimeSession = {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  joinMeeting: () => Promise<void>
  leaveMeeting: () => Promise<void>
  toggleMic: () => void | Promise<void>
  toggleCamera: () => void | Promise<void>
  startScreenShare: () => void | Promise<void>
  stopScreenShare: () => void | Promise<void>
  changeAudioDevice: (deviceId: string) => Promise<void>
  changeVideoDevice: (deviceId: string) => Promise<void>
  getParticipants: () => MeetingParticipant[]
  sendChatMessage: (
    message: string,
    recipientId?: string | null,
  ) => Promise<MeetingChatMessage>
  raiseHand: () => void
  lowerHand: () => void
  /** True when an SFU media adapter is bound. */
  hasMedia: () => boolean
  /** True when presence/chat adapter is bound. */
  hasCollaboration: () => boolean
  getMediaSnapshot: () => MeetingMediaSnapshot | null
}

export function createUnavailableMediaAdapter(reason: string): MeetingMediaAdapter {
  const fail = async () => {
    throw new Error(reason)
  }
  return {
    connect: fail,
    disconnect: async () => {},
    toggleMic: () => {
      throw new Error(reason)
    },
    toggleCamera: () => {
      throw new Error(reason)
    },
    startScreenShare: fail,
    stopScreenShare: async () => {},
    changeAudioDevice: fail,
    changeVideoDevice: fail,
  }
}

export function composeMeetingRealtimeSession(input: {
  media: MeetingMediaAdapter | null
  collaboration: MeetingCollaborationAdapter | null
}): MeetingRealtimeSession {
  const mediaOrThrow = (): MeetingMediaAdapter => {
    if (!input.media) {
      throw new Error('Meeting media is not connected yet. Wait for the SFU room to join.')
    }
    return input.media
  }
  const collabOrThrow = (): MeetingCollaborationAdapter => {
    if (!input.collaboration) {
      throw new Error('Meeting presence is not ready yet.')
    }
    return input.collaboration
  }

  return {
    connect: async () => {
      await input.media?.connect()
    },
    disconnect: async () => {
      await input.media?.disconnect()
    },
    joinMeeting: async () => {
      await input.collaboration?.joinMeeting?.()
      await input.media?.connect()
    },
    leaveMeeting: async () => {
      try {
        await input.media?.disconnect()
      } finally {
        await input.collaboration?.leaveMeeting?.()
      }
    },
    toggleMic: () => mediaOrThrow().toggleMic(),
    toggleCamera: () => mediaOrThrow().toggleCamera(),
    startScreenShare: () => mediaOrThrow().startScreenShare(),
    stopScreenShare: () => mediaOrThrow().stopScreenShare(),
    changeAudioDevice: (deviceId) => mediaOrThrow().changeAudioDevice(deviceId),
    changeVideoDevice: (deviceId) => mediaOrThrow().changeVideoDevice(deviceId),
    getParticipants: () => collabOrThrow().getParticipants(),
    sendChatMessage: (message, recipientId) =>
      collabOrThrow().sendChatMessage(message, recipientId),
    raiseHand: () => collabOrThrow().raiseHand(),
    lowerHand: () => collabOrThrow().lowerHand(),
    hasMedia: () => !!input.media,
    hasCollaboration: () => !!input.collaboration,
    getMediaSnapshot: () => input.media?.getMediaSnapshot?.() ?? null,
  }
}
