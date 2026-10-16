import { createHmac } from 'node:crypto'
import { createRequire } from 'node:module'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('~/lib/supabase/client', () => ({
  supabase: { functions: { invoke } },
}))

vi.mock('~/lib/supabase/env', () => ({
  supabaseConfig: { url: 'https://example.supabase.co' },
}))

vi.mock('~/co-work/lib/meeting-media-reconnect', () => ({
  MEETING_MEDIA_CREDENTIAL_MAX_ATTEMPTS: 2,
  meetingMediaCredentialRetryDelayMs: () => 0,
}))

import { interpretationConsumersToPause } from '~/co-work/lib/meeting-interpretation'
import { composeMeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'
import { fetchMediasoupCredentials } from '~/co-work/lib/mediasoup/mediasoup-credentials'
import {
  mediasoupSignallingUrl,
  mediasoupSourceOf,
  type MediasoupRemotePeer,
  type MediasoupRoomSnapshot,
} from '~/co-work/lib/mediasoup/mediasoup-room'
import {
  mediasoupActiveSpeakerIdentity,
  mediasoupScreenShareIdentity,
  mediasoupSpeakingIdentities,
  mediasoupStageTrackRefs,
  mediasoupTrackKey,
  mediasoupVideoTrackOf,
  mediasoupViewingScreenShare,
  mediasoupVisibleUserIds,
} from '~/co-work/lib/mediasoup/mediasoup-stage-tracks'
import { mediasoupPeerId, mediasoupPeerUserId } from '~/co-work/lib/mediasoup/peer-identity'
import { parseProtooMessage } from '~/co-work/lib/mediasoup/protoo'

const require = createRequire(import.meta.url)
const serverAuth = require('../../../infra/mediasoup-server/sheconomy-auth.cjs') as {
  verifyMeetingToken: (
    token: unknown,
    options: { secret: string; roomId: string; peerId: string; nowSeconds?: number },
  ) => { ok: true; claims: Record<string, unknown> } | { ok: false; reason: string }
  authorizeConnection: (input: {
    roomId: string
    peerId: string
    token: string | null
    secret: string | undefined
    nowSeconds?: number
  }) => { decision: 'token' | 'origin' | 'reject'; status?: number; reason?: string }
}

function fakeTrack(id: string): MediaStreamTrack {
  return { id, kind: 'video' } as MediaStreamTrack
}

function remote(
  userId: string,
  session: string,
  options: { camera?: boolean; cameraPaused?: boolean; mic?: boolean; screen?: boolean } = {},
): MediasoupRemotePeer {
  const peerId = mediasoupPeerId(userId, session)
  return {
    peerId,
    userId,
    displayName: userId.toUpperCase(),
    avatarUrl: null,
    audio: options.mic ? { consumerId: `${peerId}-a`, track: fakeTrack(`${peerId}-a`), producerPaused: false } : null,
    video: options.camera
      ? { consumerId: `${peerId}-v`, track: fakeTrack(`${peerId}-v`), producerPaused: !!options.cameraPaused }
      : null,
    screen: options.screen ? { consumerId: `${peerId}-s`, track: fakeTrack(`${peerId}-s`), producerPaused: false } : null,
    screenAudio: null,
    interpretation: null,
  }
}

function snapshot(partial: Partial<MediasoupRoomSnapshot> = {}): MediasoupRoomSnapshot {
  return {
    connection: 'connected',
    error: null,
    removed: false,
    peers: [],
    local: {
      micEnabled: true,
      micTrack: null,
      cameraEnabled: true,
      cameraTrack: fakeTrack('local-v'),
      cameraRawTrack: null,
      cameraFacing: 'user',
      screenSharing: false,
      screenTrack: null,
    },
    activeSpeakerPeerId: null,
    speakingPeerIds: [],
    ...partial,
  }
}

const LOCAL = { peerId: 'me~s1', userId: 'me', displayName: 'Me', avatarUrl: null }

describe('mediasoup signalling', () => {
  it('parses protoo requests, responses and notifications', () => {
    expect(parseProtooMessage('{"request":true,"id":1,"method":"newConsumer","data":{}}')).toMatchObject({
      request: true,
      method: 'newConsumer',
    })
    expect(parseProtooMessage('{"response":true,"id":1,"ok":false,"errorReason":"nope"}')).toMatchObject({
      ok: false,
    })
    expect(parseProtooMessage('{"notification":true,"method":"activeSpeaker"}')).toMatchObject({
      method: 'activeSpeaker',
    })
  })

  it('ignores malformed protoo frames', () => {
    expect(parseProtooMessage('not json')).toBeNull()
    expect(parseProtooMessage('{"request":true,"method":"x"}')).toBeNull()
    expect(parseProtooMessage(new ArrayBuffer(4))).toBeNull()
  })

  it('builds the signalling URL with the room, peer and token', () => {
    const url = new URL(
      mediasoupSignallingUrl('wss://media.example.com:4443/', { roomId: 'sc_abc', peerId: 'u~1', token: 'a.b.c' }),
    )
    expect(url.origin).toBe('wss://media.example.com:4443')
    expect(url.pathname).toBe('/')
    expect(url.searchParams.get('roomId')).toBe('sc_abc')
    expect(url.searchParams.get('peerId')).toBe('u~1')
    expect(url.searchParams.get('token')).toBe('a.b.c')
  })

  it('maps producer app data to sources', () => {
    expect(mediasoupSourceOf({ source: 'screensharing' })).toBe('screensharing')
    expect(mediasoupSourceOf({ source: 'share' })).toBe('screensharing')
    expect(mediasoupSourceOf({ source: 'mic' })).toBe('audio')
    expect(mediasoupSourceOf({ source: 'webcam' })).toBe('video')
    expect(mediasoupSourceOf({ source: 'interpretation:hi' })).toBe('interpretation')
    expect(mediasoupSourceOf(undefined)).toBe('video')
  })

  it('keeps a floor listener off interpreter audio', () => {
    const slots = [
      { consumerId: 'floor-1', kind: 'floor' as const, channelId: null },
      { consumerId: 'hi-1', kind: 'interpretation' as const, channelId: 'hi' },
      { consumerId: 'en-1', kind: 'interpretation' as const, channelId: 'en' },
    ]
    expect(
      interpretationConsumersToPause({ listenChannel: 'floor', hearFloor: true, slots }),
    ).toEqual(['hi-1', 'en-1'])
    expect(
      interpretationConsumersToPause({ listenChannel: 'hi', hearFloor: false, slots }).sort(),
    ).toEqual(['en-1', 'floor-1'])
    expect(
      interpretationConsumersToPause({ listenChannel: 'hi', hearFloor: true, slots }),
    ).toEqual(['hi-1', 'en-1'])
  })

  it('keys peers by user id across sessions', () => {
    expect(mediasoupPeerId('user-1', 'abc')).toBe('user-1~abc')
    expect(mediasoupPeerUserId('user-1~abc')).toBe('user-1')
    expect(mediasoupPeerUserId('legacy-peer')).toBe('legacy-peer')
  })
})

describe('mediasoup stage tracks', () => {
  it('builds camera tiles with placeholders and screen shares', () => {
    const refs = mediasoupStageTrackRefs(
      snapshot({
        peers: [remote('ann', 'a', { camera: true, mic: true, screen: true }), remote('bob', 'b')],
        speakingPeerIds: ['ann~a'],
      }),
      LOCAL,
    )

    expect(refs.map(mediasoupTrackKey)).toEqual(['me~s1:camera', 'ann~a:camera', 'ann~a:screen_share', 'bob~b:camera'])
    expect(refs[0]!.participant).toMatchObject({ identity: 'me', isLocal: true, isCameraEnabled: true })
    expect(refs[1]!.participant).toMatchObject({ identity: 'ann', isSpeaking: true, isMicrophoneEnabled: true })
    expect(mediasoupVideoTrackOf(refs[2])?.id).toBe('ann~a-s')
    expect(refs[3]!.publication).toBeUndefined()
    expect(refs[3]!.participant.isCameraEnabled).toBe(false)
  })

  it('shows a placeholder when a remote camera is paused', () => {
    const [, ann] = mediasoupStageTrackRefs(snapshot({ peers: [remote('ann', 'a', { camera: true, cameraPaused: true })] }), LOCAL)
    expect(ann!.publication).toBeUndefined()
    expect(ann!.consumerId).toBe('ann~a-v')
  })

  it('drops a remote screen share whose track ended or was paused (no black tile)', () => {
    const live = remote('ann', 'a', { screen: true })
    expect(mediasoupScreenShareIdentity(snapshot({ peers: [live] }))).toBe('ann')
    expect(mediasoupViewingScreenShare(snapshot({ peers: [live] }))).toBe(true)

    const ended = {
      ...live,
      screen: { ...live.screen!, track: { id: 's', kind: 'video', readyState: 'ended' } as MediaStreamTrack },
    }
    const paused = { ...live, screen: { ...live.screen!, producerPaused: true } }
    for (const peer of [ended, paused]) {
      const refs = mediasoupStageTrackRefs(snapshot({ peers: [peer] }), LOCAL)
      expect(refs.some((ref) => ref.source === 'screen_share')).toBe(false)
      expect(mediasoupScreenShareIdentity(snapshot({ peers: [peer] }))).toBeNull()
    }
  })

  it('includes the local screen share only while sharing', () => {
    const refs = mediasoupStageTrackRefs(
      snapshot({
        local: { ...snapshot().local, screenSharing: true, screenTrack: fakeTrack('local-s') },
      }),
      LOCAL,
    )
    expect(refs.map((ref) => ref.source)).toEqual(['camera', 'screen_share'])
  })

  it('works with the shared stage composer', () => {
    const refs = mediasoupStageTrackRefs(
      snapshot({ peers: [remote('ann', 'a', { camera: true, screen: true })] }),
      LOCAL,
    )
    const stage = composeMeetingStageTracks(refs, 'me', 'screen-share')
    expect(stage.hasScreenShare).toBe(true)
    expect(stage.isLocalScreenSharing).toBe(false)
    expect(stage.stageTracks.map(mediasoupTrackKey)).toEqual(['ann~a:screen_share'])
  })

  it('receives every camera in small rooms and only visible ones in large rooms', () => {
    expect(mediasoupVisibleUserIds(new Set(['a']), 4, 6)).toBeNull()
    expect(mediasoupVisibleUserIds(new Set(['a', 'b']), 12, 6)).toEqual(new Set(['a', 'b']))
  })

  it('resolves active and speaking peers to user ids', () => {
    const snap = snapshot({
      peers: [remote('ann', 'a'), remote('bob', 'b')],
      activeSpeakerPeerId: 'bob~b',
      speakingPeerIds: ['me~s1', 'bob~b', 'gone~x'],
    })
    expect(mediasoupActiveSpeakerIdentity(snap, LOCAL)).toBe('bob')
    expect(mediasoupActiveSpeakerIdentity({ ...snap, activeSpeakerPeerId: 'me~s1' }, LOCAL)).toBe('me')
    expect(mediasoupActiveSpeakerIdentity({ ...snap, activeSpeakerPeerId: null }, LOCAL)).toBeNull()
    expect(mediasoupSpeakingIdentities(snap, LOCAL)).toEqual(['me', 'bob'])
  })
})

describe('mediasoup credentials', () => {
  beforeEach(() => invoke.mockReset())

  const input = { meetingId: 'm1', roomName: 'room', displayName: 'Me', session: 's1' }

  it('returns credentials when the token function is enabled', async () => {
    invoke.mockResolvedValue({
      data: { enabled: true, url: 'wss://m', token: 't', roomId: 'sc_room', peerId: 'me~s1' },
      error: null,
    })
    await expect(fetchMediasoupCredentials(input)).resolves.toEqual({
      url: 'wss://m',
      token: 't',
      roomId: 'sc_room',
      peerId: 'me~s1',
    })
    expect(invoke).toHaveBeenCalledWith('mediasoup-token', {
      body: { meetingId: 'm1', roomName: 'room', displayName: 'Me', session: 's1' },
    })
  })

  it('fails with a friendly message when the media server is switched off', async () => {
    invoke.mockResolvedValue({ data: { enabled: false }, error: null })
    await expect(fetchMediasoupCredentials(input)).rejects.toThrow(/unavailable/)
  })

  it('rejects incomplete token responses', async () => {
    invoke.mockResolvedValue({ data: { enabled: true, url: 'wss://m' }, error: null })
    await expect(fetchMediasoupCredentials(input)).rejects.toThrow(/Invalid media server response/)
  })

  it('surfaces authorization errors from the token function', async () => {
    invoke.mockResolvedValue({ data: { error: 'You are not admitted to this meeting' }, error: null })
    await expect(fetchMediasoupCredentials(input)).rejects.toThrow('You are not admitted to this meeting')
    expect(invoke).toHaveBeenCalledTimes(2)
  })
})

describe('mediasoup server token check', () => {
  const secret = 'test-secret'
  const now = 1_800_000_000

  function sign(claims: Record<string, unknown>, key = secret) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
    const signature = createHmac('sha256', key).update(`${header}.${body}`).digest('base64url')
    return `${header}.${body}.${signature}`
  }

  const claims = { sub: 'me', room: 'sc_room', peer: 'me~s1', iat: now, exp: now + 3600 }
  const target = { secret, roomId: 'sc_room', peerId: 'me~s1', nowSeconds: now }

  it('accepts a token minted for this room and peer', () => {
    const result = serverAuth.verifyMeetingToken(sign(claims), target)
    expect(result.ok).toBe(true)
  })

  it('rejects tampered, expired or mismatched tokens', () => {
    expect(serverAuth.verifyMeetingToken(sign(claims, 'other'), target)).toMatchObject({ reason: 'bad signature' })
    expect(serverAuth.verifyMeetingToken(sign({ ...claims, exp: now - 120 }), target)).toMatchObject({
      reason: 'token expired',
    })
    expect(serverAuth.verifyMeetingToken(sign({ ...claims, room: 'sc_other' }), target)).toMatchObject({
      reason: 'room mismatch',
    })
    expect(serverAuth.verifyMeetingToken(sign({ ...claims, peer: 'you~s2' }), target)).toMatchObject({
      reason: 'peer mismatch',
    })
    expect(serverAuth.verifyMeetingToken('garbage', target)).toMatchObject({ reason: 'malformed token' })
    expect(serverAuth.verifyMeetingToken(null, target)).toMatchObject({ reason: 'missing token' })
  })

  it('requires tokens for app rooms only once the secret is configured', () => {
    const base = { roomId: 'sc_room', peerId: 'me~s1', nowSeconds: now }
    expect(serverAuth.authorizeConnection({ ...base, token: null, secret: undefined }).decision).toBe('origin')
    expect(serverAuth.authorizeConnection({ ...base, token: null, secret }).decision).toBe('reject')
    expect(serverAuth.authorizeConnection({ ...base, token: sign(claims), secret }).decision).toBe('token')
    expect(
      serverAuth.authorizeConnection({ roomId: 'demo', peerId: 'x', token: null, secret, nowSeconds: now }).decision,
    ).toBe('origin')
  })
})
