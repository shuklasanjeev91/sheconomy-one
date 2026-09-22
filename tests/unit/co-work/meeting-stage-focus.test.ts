import { describe, expect, it } from 'vitest'

import {
  MEETING_MAX_PINNED,
  normalizePinnedIdentities,
  resolveMeetingFocusIdentity,
  togglePinnedIdentity,
} from '~/co-work/lib/meeting-stage-focus'
import { composeMeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'
import { Track } from 'livekit-client'
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core'

function track(identity: string): TrackReferenceOrPlaceholder {
  return {
    participant: { identity },
    source: Track.Source.Camera,
    publication: { source: Track.Source.Camera, trackSid: `${identity}-cam` },
  } as TrackReferenceOrPlaceholder
}

describe('meeting stage focus', () => {
  it('normalizes and caps pinned identities', () => {
    expect(normalizePinnedIdentities(['a', 'a', '', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c'])
    expect(MEETING_MAX_PINNED).toBe(3)
    expect(togglePinnedIdentity(['a'], 'a')).toEqual([])
    expect(togglePinnedIdentity(['a'], 'b')).toEqual(['a', 'b'])
  })

  it('prefers spotlight over active speaker', () => {
    expect(
      resolveMeetingFocusIdentity({
        spotlightIdentity: 'host-focus',
        activeSpeakerIdentity: 'speaker',
      }),
    ).toBe('host-focus')
  })

  it('forces spotlight layout for every viewer', () => {
    const a = track('a')
    const b = track('b')
    const c = track('c')
    const result = composeMeetingStageTracks([a, b, c], 'a', 'gallery', 'c', {
      spotlightIdentity: 'b',
      pinnedIdentities: ['c'],
    })
    expect(result.stageTracks).toEqual([b])
    expect(result.filmstripTracks.map((row) => row.participant.identity).sort()).toEqual(['a', 'c'])
  })

  it('floats pinned tiles in gallery order', () => {
    const a = track('a')
    const b = track('b')
    const c = track('c')
    const result = composeMeetingStageTracks([a, b, c], 'local', 'gallery', null, {
      pinnedIdentities: ['c'],
      hideSelfView: true,
    })
    expect(result.stageTracks[0]?.participant.identity).toBe('c')
  })
})
