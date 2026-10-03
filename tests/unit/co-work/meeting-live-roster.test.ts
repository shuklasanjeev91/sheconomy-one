import { describe, expect, it } from 'vitest'

import {
  meetingLiveAdmittedCount,
  meetingLiveParticipants,
  meetingOnlineRemoteParticipants,
  sameUserIdSet,
} from '~/co-work/lib/meeting-live-roster'
import {
  withMediasoupRosterPlaceholders,
  type MediasoupTrackRef,
} from '~/co-work/lib/mediasoup/mediasoup-stage-tracks'
import type { MeetingParticipant } from '~/co-work/lib/types'

function row(userId: string, overrides: Partial<MeetingParticipant> = {}): MeetingParticipant {
  return {
    id: `row-${userId}`,
    meeting_id: 'm1',
    user_id: userId,
    display_name: `Name ${userId}`,
    status: 'admitted',
    is_host: false,
    is_muted: false,
    is_video_off: false,
    joined_at: null,
    left_at: null,
    role: 'participant',
    profile: { full_name: null, username: null, avatar_url: `https://img/${userId}.png` },
    ...overrides,
  }
}

function cameraRef(identity: string): MediasoupTrackRef {
  return {
    source: 'camera',
    consumerId: null,
    participant: {
      identity,
      peerId: `peer-${identity}`,
      name: identity,
      avatarUrl: null,
      isLocal: false,
      isSpeaking: false,
      isCameraEnabled: false,
      isMicrophoneEnabled: false,
    },
  }
}

describe('meetingLiveParticipants', () => {
  const rows = [row('me'), row('alice'), row('ghost'), row('bob'), row('waiter', { status: 'waiting' })]

  it('trusts the table until presence has synced', () => {
    expect(meetingLiveParticipants(rows, { localUserId: 'me', onlineUserIds: null })).toHaveLength(5)
  })

  it('drops admitted rows nobody can see (closed tab / killed app)', () => {
    const live = meetingLiveParticipants(rows, { localUserId: 'me', onlineUserIds: ['me', 'alice', 'bob'] })
    expect(live.map((p) => p.user_id)).toEqual(['me', 'alice', 'bob', 'waiter'])
    expect(meetingLiveAdmittedCount(live)).toBe(3)
  })

  it('keeps someone on the media server even if presence dropped them', () => {
    const live = meetingLiveParticipants(rows, {
      localUserId: 'me',
      onlineUserIds: ['me', 'alice'],
      mediaUserIds: ['bob'],
    })
    expect(live.map((p) => p.user_id)).toEqual(['me', 'alice', 'bob', 'waiter'])
  })

  it('always keeps self', () => {
    const live = meetingLiveParticipants([row('me')], { localUserId: 'me', onlineUserIds: ['other'] })
    expect(live).toHaveLength(1)
  })

  it('dedupes admitted rows per user', () => {
    const live = meetingLiveParticipants([row('me'), row('alice'), row('alice', { id: 'dup' })], {
      localUserId: 'me',
      onlineUserIds: ['me', 'alice'],
    })
    expect(meetingLiveAdmittedCount(live)).toBe(2)
  })
})

describe('meetingOnlineRemoteParticipants', () => {
  it('is empty before presence syncs', () => {
    expect(meetingOnlineRemoteParticipants([row('me'), row('alice')], { localUserId: 'me', onlineUserIds: null })).toEqual([])
  })

  it('lists online remote admitted people, not self, ghosts or waiting', () => {
    const out = meetingOnlineRemoteParticipants(
      [row('me'), row('alice'), row('ghost'), row('waiter', { status: 'waiting' })],
      { localUserId: 'me', onlineUserIds: ['me', 'alice', 'waiter'] },
    )
    expect(out).toEqual([{ identity: 'alice', name: 'Name alice', avatarUrl: 'https://img/alice.png' }])
  })

  it('falls back to profile name', () => {
    const out = meetingOnlineRemoteParticipants(
      [row('alice', { display_name: null, profile: { full_name: 'Alice A', username: 'a', avatar_url: null } })],
      { localUserId: 'me', onlineUserIds: ['me', 'alice'] },
    )
    expect(out[0]?.name).toBe('Alice A')
  })
})

describe('withMediasoupRosterPlaceholders', () => {
  it('adds a connecting tile only for roster people without a media tile', () => {
    const refs = [cameraRef('me'), cameraRef('alice')]
    const out = withMediasoupRosterPlaceholders(refs, [
      { identity: 'alice', name: 'Alice', avatarUrl: null },
      { identity: 'host', name: 'Host', avatarUrl: 'https://img/host.png' },
    ])
    expect(out).toHaveLength(3)
    expect(out[2]?.participant).toMatchObject({
      identity: 'host',
      peerId: 'pending:host',
      name: 'Host',
      isConnecting: true,
      isCameraEnabled: false,
    })
    expect(out[2]?.publication).toBeUndefined()
  })

  it('returns the same array when nothing is missing', () => {
    const refs = [cameraRef('me'), cameraRef('alice')]
    expect(withMediasoupRosterPlaceholders(refs, [{ identity: 'alice', name: 'A', avatarUrl: null }])).toBe(refs)
    expect(withMediasoupRosterPlaceholders(refs, [])).toBe(refs)
  })
})

describe('sameUserIdSet', () => {
  it('ignores order and detects changes', () => {
    expect(sameUserIdSet(['a', 'b'], ['b', 'a'])).toBe(true)
    expect(sameUserIdSet(['a', 'b'], ['a', 'c'])).toBe(false)
    expect(sameUserIdSet(null, ['a'])).toBe(false)
    expect(sameUserIdSet(null, null)).toBe(true)
  })
})
