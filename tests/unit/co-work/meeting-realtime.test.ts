import { describe, expect, it, vi } from 'vitest'

import {
  MEETING_REALTIME_ARCHITECTURE,
  MEETING_REALTIME_LAYERS,
  composeMeetingRealtimeSession,
  createPresenceCollaborationAdapter,
  isSfuMeetingArchitecture,
  meetingMediaTransport,
  meetingRealtimeLayerDescription,
} from '~/co-work/lib/realtime'
import type { MeetingMediaAdapter } from '~/co-work/lib/realtime'
import { createMediaSession } from '~/co-work/lib/media'
import type { MeetingParticipant } from '~/co-work/lib/types'

describe('meeting realtime architecture', () => {
  it('declares SFU as the production media transport', () => {
    expect(MEETING_REALTIME_ARCHITECTURE).toBe('sfu')
    expect(meetingMediaTransport()).toBe('sfu')
    expect(isSfuMeetingArchitecture()).toBe(true)
  })

  it('keeps signaling, media, presence, chat, meeting and participant layers separate', () => {
    expect(MEETING_REALTIME_LAYERS).toEqual([
      'signaling',
      'media',
      'presence',
      'chat',
      'meeting_state',
      'participant_state',
    ])
    for (const layer of MEETING_REALTIME_LAYERS) {
      expect(meetingRealtimeLayerDescription(layer).length).toBeGreaterThan(10)
    }
  })

  it('disables peer-to-peer mesh media session creation', () => {
    expect(createMediaSession('user', () => {}, {
      onRemoteStream: () => {},
      onRemoteScreenStream: () => {},
      onPeerDisconnected: () => {},
    })).toBeNull()
  })

  it('composes a MeetingRealtimeSession from replaceable adapters', async () => {
    const toggleMic = vi.fn()
    const toggleCamera = vi.fn()
    const startScreenShare = vi.fn(async () => {})
    const stopScreenShare = vi.fn(async () => {})
    const changeAudioDevice = vi.fn(async () => {})
    const changeVideoDevice = vi.fn(async () => {})
    const disconnect = vi.fn(async () => {})
    const connect = vi.fn(async () => {})

    const media: MeetingMediaAdapter = {
      connect,
      disconnect,
      toggleMic,
      toggleCamera,
      startScreenShare,
      stopScreenShare,
      changeAudioDevice,
      changeVideoDevice,
      getMediaSnapshot: () => ({
        audioEnabled: true,
        videoEnabled: false,
        screenSharing: false,
        speakerOn: true,
      }),
    }

    const participants: MeetingParticipant[] = [
      {
        id: '1',
        meeting_id: 'm1',
        user_id: 'u1',
        display_name: 'Ada',
        role: 'host',
        status: 'joined',
        is_host: true,
        is_muted: false,
        is_video_off: false,
        joined_at: null,
        left_at: null,
        session_id: null,
      } as MeetingParticipant,
    ]

    const sendChat = vi.fn(async () => {})
    const toggleHandRaise = vi.fn()
    const leave = vi.fn(async () => {})

    const collaboration = createPresenceCollaborationAdapter(() => ({
      participants,
      handRaised: false,
      sendChat,
      toggleHandRaise,
      leave,
    }))

    const session = composeMeetingRealtimeSession({ media, collaboration })

    expect(session.hasMedia()).toBe(true)
    expect(session.hasCollaboration()).toBe(true)
    expect(session.getParticipants()).toEqual(participants)
    expect(session.getMediaSnapshot()?.audioEnabled).toBe(true)

    await session.connect()
    expect(connect).toHaveBeenCalled()

    session.toggleMic()
    session.toggleCamera()
    await session.startScreenShare()
    await session.stopScreenShare()
    await session.changeAudioDevice('mic-1')
    await session.changeVideoDevice('cam-1')
    session.raiseHand()
    expect(toggleMic).toHaveBeenCalled()
    expect(toggleCamera).toHaveBeenCalled()
    expect(startScreenShare).toHaveBeenCalled()
    expect(stopScreenShare).toHaveBeenCalled()
    expect(changeAudioDevice).toHaveBeenCalledWith('mic-1')
    expect(changeVideoDevice).toHaveBeenCalledWith('cam-1')
    expect(toggleHandRaise).toHaveBeenCalled()

    await session.sendChatMessage('hello')
    expect(sendChat).toHaveBeenCalledWith('hello', 'everyone', null)

    await session.leaveMeeting()
    expect(disconnect).toHaveBeenCalled()
    expect(leave).toHaveBeenCalled()
  })

  it('keeps media and collaboration independently replaceable', () => {
    const session = composeMeetingRealtimeSession({ media: null, collaboration: null })
    expect(session.hasMedia()).toBe(false)
    expect(session.hasCollaboration()).toBe(false)
    expect(() => session.toggleMic()).toThrow(/media/i)
    expect(() => session.getParticipants()).toThrow(/presence/i)
  })
})
