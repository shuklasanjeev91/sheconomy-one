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
  it('does not render a local screen-share publication back to the presenter', () => {
    const localScreen = track('local', Track.Source.ScreenShare)
    const localCamera = track('local', Track.Source.Camera)
    const remoteCamera = track('remote', Track.Source.Camera)

    const result = composeMeetingStageTracks(
      [localScreen, localCamera, remoteCamera],
      'local',
    )

    expect(result.isLocalScreenSharing).toBe(true)
    expect(result.hasScreenShare).toBe(false)
    expect(result.stageTracks).toEqual([remoteCamera])
    expect(result.pipTrack).toBe(localCamera)
    expect(result.stageTracks).not.toContain(localScreen)
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
    const result = composeMeetingStageTracks([remoteScreen, localCamera], 'local')

    expect(result.isLocalScreenSharing).toBe(false)
    expect(result.hasScreenShare).toBe(true)
    expect(result.stageTracks[0]).toBe(remoteScreen)
    expect(result.pipTrack).toBe(localCamera)
  })
})
