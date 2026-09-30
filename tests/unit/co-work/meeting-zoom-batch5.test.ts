import { describe, expect, it } from 'vitest'

import {
  buildMeetingChatArchive,
  chatArchiveToPlainText,
} from '~/co-work/lib/meeting-chat-archive'
import {
  parseMeetingMediaPrefs,
  meetingAudioCaptureConstraints,
} from '~/co-work/lib/meeting-media-prefs'
import {
  MEETING_KEYBOARD_SHORTCUTS,
  resolveMeetingKeyboardAction,
} from '~/co-work/lib/meeting-keyboard-shortcuts'
import { participantRowActions } from '~/co-work/lib/meeting-participant-actions'
import { meetingShareContentItems } from '~/co-work/lib/meeting-share-content'
import type { MeetingChatMessage } from '~/co-work/lib/types'

describe('Zoom parity batch 5 — share options, chat export, waiting room, shortcuts', () => {
  it('lists Zoom share content kinds with attachments above whiteboard', () => {
    expect(meetingShareContentItems().map((item) => item.kind)).toEqual([
      'screen',
      'photos',
      'video',
      'files',
      'whiteboard',
    ])
    expect(meetingShareContentItems({ supportsScreenShare: false }).map((i) => i.kind)).toEqual([
      'photos',
      'video',
      'files',
      'whiteboard',
    ])
  })

  it('parses share computer sound + optimize-for-video prefs', () => {
    expect(
      parseMeetingMediaPrefs({
        shareComputerSound: true,
        optimizeShareForVideo: true,
        annotateAfterShare: true,
      }),
    ).toMatchObject({
      shareComputerSound: true,
      optimizeShareForVideo: true,
      annotateAfterShare: true,
    })
    // Original sound constraints remain independent of share prefs.
    expect(meetingAudioCaptureConstraints({ originalSound: true }).noiseSuppression).toBe(false)
  })

  it('builds a plain-text chat archive for export', () => {
    const messages: MeetingChatMessage[] = [
      {
        id: '1',
        meeting_id: 'm1',
        sender_id: 'u1',
        message_text: 'Hello room',
        message_type: 'text',
        created_at: '2026-09-22T10:00:00.000Z',
        audience: 'everyone',
        sender: { full_name: 'Ada', username: 'ada', avatar_url: null },
      },
      {
        id: '2',
        meeting_id: 'm1',
        sender_id: 'system',
        message_text: 'Ada joined',
        message_type: 'system',
        created_at: '2026-09-22T10:01:00.000Z',
        audience: 'system',
      },
    ]
    const archive = buildMeetingChatArchive('m1', messages, { u1: 'Ada Lovelace' })
    const text = chatArchiveToPlainText(archive)
    expect(text).toContain('Ada Lovelace: Hello room')
    expect(text).toContain('System: Ada joined')
  })

  it('exposes put_in_waiting_room for host moderators', () => {
    expect(
      participantRowActions({
        viewerRole: 'host',
        targetRole: 'participant',
        isSelf: false,
        isMuted: false,
        isVideoOff: true,
      }),
    ).toContain('put_in_waiting_room')
  })

  it('maps expanded Alt shortcuts for captions, whiteboard, gallery, record', () => {
    expect(
      resolveMeetingKeyboardAction({
        key: 'c',
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      }),
    ).toBe('toggle_captions')
    expect(
      resolveMeetingKeyboardAction({
        key: 'w',
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      }),
    ).toBe('toggle_whiteboard')
    expect(
      resolveMeetingKeyboardAction({
        key: 'g',
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      }),
    ).toBe('toggle_gallery')
    expect(
      resolveMeetingKeyboardAction({
        key: 'e',
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: true,
      }),
    ).toBe('toggle_record')
    expect(
      resolveMeetingKeyboardAction({
        key: 'e',
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      }),
    ).toBeNull()

    for (const action of [
      'toggle_captions',
      'toggle_whiteboard',
      'toggle_gallery',
      'toggle_record',
    ] as const) {
      expect(MEETING_KEYBOARD_SHORTCUTS.some((row) => row.action === action)).toBe(true)
    }
  })
})
