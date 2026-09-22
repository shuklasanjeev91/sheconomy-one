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
    expect(result.filmstripTracks).toEqual([remoteCamera, localCamera])
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
    expect(result.filmstripTracks).toEqual([remoteCamera, localCamera])
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
    expect(result.filmstripTracks).toEqual([firstRemote, localCamera])

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
      'remote-1',
      'local',
    ])
  })

  it('prioritizes video-on participants ahead of camera-off in gallery order', () => {
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
      'remote-on',
      'remote-speaking',
      'remote-off',
      'local',
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
  })
})
