import { describe, expect, it } from 'vitest'
import type { MeetingStageTrack } from '~/co-work/lib/meeting-stage-tracks'
import type { MediasoupTileSource } from '~/co-work/lib/mediasoup/mediasoup-stage-tracks'

import { composeMeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'

function track(
  identity: string,
  source: MediasoupTileSource,
  published = source === 'screen_share',
): MeetingStageTrack {
  const participant = { identity }
  if (published) {
    return {
      participant,
      source,
      publication: { source, trackSid: `${identity}-${source}` },
    } as MeetingStageTrack
  }
  return { participant, source } as MeetingStageTrack
}

describe('meeting stage tracks', () => {
  it('stays one-on-one while presenting without mirroring the local share', () => {
    const localScreen = track('local', 'screen_share')
    const localCamera = track('local', 'camera')
    const remoteCamera = track('remote', 'camera')
    const otherRemote = track('remote-2', 'camera')

    const result = composeMeetingStageTracks(
      [localScreen, localCamera, remoteCamera, otherRemote],
      'local',
      'screen-share',
      'remote',
    )

    expect(result.isLocalScreenSharing).toBe(true)
    expect(result.hasScreenShare).toBe(true)
    expect(result.stageTracks).toEqual([remoteCamera])
    expect(result.pipTrack).toBe(localCamera)
    expect(result.filmstripTracks).toEqual([])
    expect(result.stageTracks).not.toContain(localScreen)
    expect(result.cameraTiles).toBe(3)
  })

  it('keeps a local share published while showing an empty non-recursive stage', () => {
    const localScreen = track('local', 'screen_share')
    const result = composeMeetingStageTracks([localScreen], 'local')

    expect(result.isLocalScreenSharing).toBe(true)
    expect(result.stageTracks).toEqual([])
    expect(result.totalTiles).toBe(0)
  })

  it('focuses a remote participant screen share on every viewer platform', () => {
    const remoteScreen = track('remote', 'screen_share')
    const localCamera = track('local', 'camera')
    const remoteCamera = track('remote', 'camera')
    const result = composeMeetingStageTracks(
      [remoteScreen, localCamera, remoteCamera],
      'local',
      'screen-share',
    )

    expect(result.isLocalScreenSharing).toBe(false)
    expect(result.hasScreenShare).toBe(true)
    expect(result.stageTracks[0]).toBe(remoteScreen)
    expect(result.pipTrack).toBe(remoteCamera)
    expect(result.filmstripTracks).toEqual([])
  })

  it('shows the active remote speaker large with self-view floating in speaker view', () => {
    const localCamera = track('local', 'camera')
    const firstRemote = track('remote-1', 'camera')
    const activeRemote = track('remote-2', 'camera')
    const result = composeMeetingStageTracks(
      [localCamera, firstRemote, activeRemote],
      'local',
      'speaker',
      'remote-2',
    )

    expect(result.stageTracks).toEqual([activeRemote])
    expect(result.pipTrack).toBe(localCamera)
    expect(result.filmstripTracks).toEqual([])

    // Speaking yourself keeps a remote on the stage; you stay in the floating tile.
    const localSpeaking = composeMeetingStageTracks(
      [localCamera, firstRemote, activeRemote],
      'local',
      'speaker',
      'local',
    )
    expect(localSpeaking.stageTracks[0]?.participant.identity).not.toBe('local')
    expect(localSpeaking.pipTrack).toBe(localCamera)

    const alone = composeMeetingStageTracks([localCamera], 'local', 'speaker', null)
    expect(alone.stageTracks).toEqual([localCamera])
    expect(alone.pipTrack).toBeNull()
  })

  it('keeps every camera on stage in gallery mode', () => {
    const localCamera = track('local', 'camera')
    const firstRemote = track('remote-1', 'camera')
    const secondRemote = track('remote-2', 'camera')
    const result = composeMeetingStageTracks(
      [localCamera, firstRemote, secondRemote],
      'local',
      'gallery',
      'remote-2',
    )

    expect(result.stageTracks).toHaveLength(3)
    expect(result.filmstripTracks).toEqual([])
    expect(result.stageTracks.map((item) => item.participant.identity)).toEqual([
      'remote-1',
      'remote-2',
      'local',
    ])
  })

  it('orders gallery remotes by video first, then alphabetically, while people speak', () => {
    const person = (
      identity: string,
      name: string,
      extra: { isSpeaking?: boolean; isMicrophoneEnabled?: boolean; isCameraEnabled?: boolean } = {},
    ) =>
      ({
        ...track(identity, 'camera'),
        participant: { identity, name, isCameraEnabled: false, ...extra },
      }) as MeetingStageTrack

    const result = composeMeetingStageTracks(
      [
        person('local', 'Zara'),
        person('u-mia', 'mia'),
        person('u-ben', 'Ben', { isCameraEnabled: true }),
        person('u-cara', 'Cara', { isMicrophoneEnabled: true }),
        person('u-dev', 'Dev', { isSpeaking: true }),
        person('u-amy', 'Amy'),
        person('u-eve', 'Eve'),
      ],
      'local',
      'gallery',
      'u-eve',
    )
    const nextActive = composeMeetingStageTracks(
      [
        person('local', 'Zara'),
        person('u-mia', 'mia'),
        person('u-ben', 'Ben', { isCameraEnabled: true }),
        person('u-cara', 'Cara', { isMicrophoneEnabled: true }),
        person('u-dev', 'Dev', { isSpeaking: true }),
        person('u-amy', 'Amy'),
        person('u-eve', 'Eve'),
      ],
      'local',
      'gallery',
      'u-dev',
    )

    expect(result.stageTracks.map((item) => item.participant.name)).toEqual([
      'Ben',
      'Amy',
      'Cara',
      'Dev',
      'Eve',
      'mia',
      'Zara',
    ])
    expect(nextActive.stageTracks.map((item) => item.participant.name)).toEqual(
      result.stageTracks.map((item) => item.participant.name),
    )
  })

  it('keeps pinned participants ahead of the active speaker', () => {
    const local = track('local', 'camera')
    const pinned = track('remote-pinned', 'camera')
    const speaker = track('remote-speaker', 'camera')
    const result = composeMeetingStageTracks([local, speaker, pinned], 'local', 'gallery', null, {
      pinnedIdentities: ['remote-pinned'],
    })
    const withSpeaker = composeMeetingStageTracks(
      [local, speaker, pinned],
      'local',
      'gallery',
      'remote-speaker',
      { pinnedIdentities: ['remote-pinned'] },
    )
    expect(result.stageTracks[0]).toBe(pinned)
    expect(withSpeaker.stageTracks.map((item) => item.participant.identity)).toEqual([
      'remote-pinned',
      'remote-speaker',
      'local',
    ])
  })

  it('promotes video-on remote tiles ahead of camera-off active speakers in gallery order', () => {
    const localCamera = track('local', 'camera')
    const cameraOff = {
      ...track('remote-off', 'camera'),
      participant: { identity: 'remote-off', isCameraEnabled: false },
    } as MeetingStageTrack
    const cameraOn = {
      ...track('remote-on', 'camera'),
      participant: { identity: 'remote-on', isCameraEnabled: true },
    } as MeetingStageTrack
    const speakingOff = {
      ...track('remote-speaking', 'camera'),
      participant: { identity: 'remote-speaking', isCameraEnabled: false, isSpeaking: true },
    } as MeetingStageTrack

    const result = composeMeetingStageTracks(
      [localCamera, cameraOff, speakingOff, cameraOn],
      'local',
      'gallery',
      'remote-speaking',
    )

    expect(result.stageTracks.map((item) => item.participant.identity)).toEqual([
      'remote-on',
      'remote-off',
      'remote-speaking',
      'local',
    ])
  })

  it('does not collapse gallery when a remote screen share is also present', () => {
    const localCamera = track('local', 'camera')
    const remoteCamera = track('remote', 'camera')
    const remoteScreen = track('remote', 'screen_share')
    const result = composeMeetingStageTracks(
      [localCamera, remoteCamera, remoteScreen],
      'local',
      'gallery',
    )

    expect(result.stageTracks).toHaveLength(2)
    expect(result.hasScreenShare).toBe(true)
    expect(result.stageTracks.every((item) => item.source === 'camera')).toBe(true)
  })

  it('hides the local camera tile when hideSelfView is on', () => {
    const localCamera = track('local', 'camera')
    const remoteCamera = track('remote', 'camera')
    const result = composeMeetingStageTracks(
      [localCamera, remoteCamera],
      'local',
      'gallery',
      null,
      true,
    )

    expect(result.stageTracks).toEqual([remoteCamera])
    expect(result.stageTracks).not.toContain(localCamera)
    expect(result.pipTrack).toBeNull()
  })

  it('gallery shows every camera as a tile, including 1:1 side by side', () => {
    const localCamera = track('local', 'camera')
    const remoteCamera = track('remote', 'camera')
    const secondRemote = track('remote-2', 'camera')

    const alone = composeMeetingStageTracks([localCamera], 'local', 'gallery')
    expect(alone.stageTracks).toEqual([localCamera])
    expect(alone.pipTrack).toBeNull()

    const oneOnOne = composeMeetingStageTracks([localCamera, remoteCamera], 'local', 'gallery')
    expect(oneOnOne.stageTracks).toHaveLength(2)
    expect(oneOnOne.pipTrack).toBeNull()

    const group = composeMeetingStageTracks(
      [localCamera, remoteCamera, secondRemote],
      'local',
      'gallery',
    )
    expect(group.stageTracks).toHaveLength(3)
    expect(group.pipTrack).toBeNull()
  })

  it('speaker view in 1:1 fills the stage with the other person and floats self-view (Zoom)', () => {
    const localCamera = track('local', 'camera')
    const remoteCamera = track('remote', 'camera')
    const speaker = composeMeetingStageTracks(
      [localCamera, remoteCamera],
      'local',
      'speaker',
      'remote',
    )
    expect(speaker.stageTracks).toEqual([remoteCamera])
    expect(speaker.pipTrack).toBe(localCamera)
    expect(speaker.filmstripTracks).toEqual([])
    expect(speaker.totalTiles).toBe(2)
  })
})
