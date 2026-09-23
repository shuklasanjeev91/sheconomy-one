import { describe, expect, it } from 'vitest'

import type { SignalPayload } from '~/co-work/lib/types'
import { transferHostCandidates } from '~/co-work/lib/meeting-transfer-host'
import type { MeetingParticipant } from '~/co-work/lib/types'

describe('meeting signals & host transfer parity', () => {
  it('constructs valid host-transferred signal payload', () => {
    const payload: SignalPayload = {
      type: 'host-transferred',
      from: 'user-host',
      newHostId: 'user-new-host',
      newHostName: 'Alice',
      timestamp: 1727000000000,
    }

    expect(payload.type).toBe('host-transferred')
    expect(payload.newHostId).toBe('user-new-host')
    expect(payload.from).toBe('user-host')
  })

  it('constructs valid recording-status signal payload', () => {
    const payload: SignalPayload = {
      type: 'recording-status',
      from: 'user-host',
      isRecording: true,
      timestamp: 1727000000000,
    }

    expect(payload.type).toBe('recording-status')
    expect(payload.isRecording).toBe(true)
  })

  it('filters admitted candidates for host transfer excluding self and existing hosts', () => {
    const participants: MeetingParticipant[] = [
      {
        id: 'p-1',
        meeting_id: 'm-1',
        user_id: 'host-1',
        status: 'admitted',
        is_host: true,
        role: 'host',
        is_muted: false,
        is_video_off: false,
        joined_at: null,
        left_at: null,
      },
      {
        id: 'p-2',
        meeting_id: 'm-1',
        user_id: 'user-2',
        status: 'admitted',
        is_host: false,
        role: 'participant',
        display_name: 'Bob',
        is_muted: true,
        is_video_off: false,
        joined_at: null,
        left_at: null,
      },
      {
        id: 'p-3',
        meeting_id: 'm-1',
        user_id: 'user-3',
        status: 'waiting',
        is_host: false,
        role: 'participant',
        display_name: 'Charlie (Waiting)',
        is_muted: true,
        is_video_off: true,
        joined_at: null,
        left_at: null,
      },
      {
        id: 'p-4',
        meeting_id: 'm-1',
        user_id: 'user-4',
        status: 'admitted',
        is_host: false,
        role: 'co_host',
        display_name: 'Dana (Co-Host)',
        is_muted: false,
        is_video_off: false,
        joined_at: null,
        left_at: null,
      },
    ]

    const candidates = transferHostCandidates(participants, 'host-1')
    expect(candidates).toHaveLength(2)
    expect(candidates.map((c) => c.user_id)).toEqual(['user-2', 'user-4'])
  })
})
