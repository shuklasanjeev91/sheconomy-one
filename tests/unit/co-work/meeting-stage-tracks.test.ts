import { describe, expect, it } from 'vitest'
import { Track } from 'livekit-client'
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core'

import { composeMeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'

function track(
  identity: string,
  source: Track.Source,
  published = source === Track.Source.ScreenShare,
): TrackReferenceOrPlaceholder {
  const participant = { identity }
  if (published) {
    return {
      participant,
      source,
      publication: { source, trackSid: `${identity}-${source}` },
    } as TrackReferenceOrPlaceholder
  }
  return { participant, source } as TrackReferenceOrPlaceholder
}

describe('meeting stage tracks', () => {
  it('keeps all participant cameras visible without mirroring the local share', () => {
    const localScreen = track('local', Track.Source.ScreenShare)
    const localCamera = track('local', Track.Source.Camera)
    const remoteCamera = track('remote', Track.Source.Camera)

    const result = composeMeetingStageTracks(
      [localScreen, localCamera, remoteCamera],
      'local',
      'screen-share',
    )

    expect(result.isLocalScreenSharing).toBe(true)
    expect(result.hasScreenShare).toBe(true)
    expect(result.stageTracks).toEqual([remoteCamera])
    expect(result.filmstripTracks).toEqual([localCamera, remoteCamera])
    expect(result.stageTracks).not.toContain(localScreen)
    expect(result.filmstripTracks).not.toContain(localScreen)
  })

  it('keeps a local share published while showing an empty non-recursive stage', () => {
    const localScreen = track('local', Track.Source.ScreenShare)
    const result = composeMeetingStageTracks([localScreen], 'local')

    expect(result.isLocalScreenSharing).toBe(true)
    expect(result.stageTracks).toEqual([])
    expect(result.totalTiles).toBe(0)
  })

  it('focuses a remote participant screen share on every viewer platform', () => {
    const remoteScreen = track('remote', Track.Source.ScreenShare)
    const localCamera = track('local', Track.Source.Camera)
    const remoteCamera = track('remote', Track.Source.Camera)
    const result = composeMeetingStageTracks(
      [remoteScreen, localCamera, remoteCamera],
      'local',
      'screen-share',
    )

    expect(result.isLocalScreenSharing).toBe(false)
    expect(result.hasScreenShare).toBe(true)
    expect(result.stageTracks[0]).toBe(remoteScreen)
    expect(result.filmstripTracks).toEqual([localCamera, remoteCamera])
  })

  it('uses the active speaker — including local — as the main tile in speaker view', () => {
    const localCamera = track('local', Track.Source.Camera)
    const firstRemote = track('remote-1', Track.Source.Camera)
    const activeRemote = track('remote-2', Track.Source.Camera)
    const result = composeMeetingStageTracks(
      [localCamera, firstRemote, activeRemote],
      'local',
      'speaker',
      'remote-2',
    )

    expect(result.stageTracks).toEqual([activeRemote])
    expect(result.filmstripTracks).toEqual([localCamera, firstRemote])

    const localSpeaking = composeMeetingStageTracks(
      [localCamera, firstRemote, activeRemote],
      'local',
      'speaker',
      'local',
    )
    expect(localSpeaking.stageTracks).toEqual([localCamera])
    expect(localSpeaking.filmstripTracks.map((item) => item.participant.identity).sort()).toEqual([
      'remote-1',
      'remote-2',
    ])
  })

  it('keeps every camera on stage in gallery mode', () => {
    const localCamera = track('local', Track.Source.Camera)
    const firstRemote = track('remote-1', Track.Source.Camera)
    const secondRemote = track('remote-2', Track.Source.Camera)
    const result = composeMeetingStageTracks(
      [localCamera, firstRemote, secondRemote],
      'local',
      'gallery',
      'remote-2',
    )

    expect(result.stageTracks).toHaveLength(3)
    expect(result.filmstripTracks).toEqual([])
    expect(result.stageTracks.map((item) => item.participant.identity)).toEqual([
      'remote-2',
      'local',
      'remote-1',
    ])
  })

  it('orders gallery like Zoom: talking, unmuted, video on, then alphabetical', () => {
    const person = (
      identity: string,
      name: string,
      extra: { isSpeaking?: boolean; isMicrophoneEnabled?: boolean; isCameraEnabled?: boolean } = {},
    ) =>
      ({
        ...track(identity, Track.Source.Camera),
        participant: { identity, name, isCameraEnabled: false, ...extra },
      }) as TrackReferenceOrPlaceholder

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

    expect(result.stageTracks.map((item) => item.participant.name)).toEqual([
      'Eve',
      'Dev',
      'Cara',
      'Ben',
      'Zara',
      'Amy',
      'mia',
    ])
  })

  it('keeps pinned participants ahead of the active speaker', () => {
    const local = track('local', Track.Source.Camera)
    const pinned = track('remote-pinned', Track.Source.Camera)
    const speaker = track('remote-speaker', Track.Source.Camera)
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

  it('floats active and video-on participants ahead of camera-off in gallery order', () => {
    const localCamera = track('local', Track.Source.Camera)
    const cameraOff = {
      ...track('remote-off', Track.Source.Camera),
      participant: { identity: 'remote-off', isCameraEnabled: false },
    } as TrackReferenceOrPlaceholder
    const cameraOn = {
      ...track('remote-on', Track.Source.Camera),
      participant: { identity: 'remote-on', isCameraEnabled: true },
    } as TrackReferenceOrPlaceholder
    const speakingOff = {
      ...track('remote-speaking', Track.Source.Camera),
      participant: { identity: 'remote-speaking', isCameraEnabled: false, isSpeaking: true },
    } as TrackReferenceOrPlaceholder

    const result = composeMeetingStageTracks(
      [localCamera, cameraOff, speakingOff, cameraOn],
      'local',
      'gallery',
      'remote-speaking',
    )

    expect(result.stageTracks.map((item) => item.participant.identity)).toEqual([
      'remote-speaking',
      'remote-on',
      'local',
      'remote-off',
    ])
  })

  it('does not collapse gallery when a remote screen share is also present', () => {
    const localCamera = track('local', Track.Source.Camera)
    const remoteCamera = track('remote', Track.Source.Camera)
    const remoteScreen = track('remote', Track.Source.ScreenShare)
    const result = composeMeetingStageTracks(
      [localCamera, remoteCamera, remoteScreen],
      'local',
      'gallery',
    )

    expect(result.stageTracks).toHaveLength(2)
    expect(result.hasScreenShare).toBe(true)
    expect(result.stageTracks.every((item) => item.source === Track.Source.Camera)).toBe(true)
  })

  it('hides the local camera tile when hideSelfView is on', () => {
    const localCamera = track('local', Track.Source.Camera)
    const remoteCamera = track('remote', Track.Source.Camera)
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
    const localCamera = track('local', Track.Source.Camera)
    const remoteCamera = track('remote', Track.Source.Camera)
    const secondRemote = track('remote-2', Track.Source.Camera)

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
    const localCamera = track('local', Track.Source.Camera)
    const remoteCamera = track('remote', Track.Source.Camera)
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
