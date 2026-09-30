import { describe, expect, it } from 'vitest'

import {
  screenShareStreamForTrack,
  screenShareVideoHasFrames,
} from '~/co-work/lib/web-screen-share-video'

describe('web screen-share video attach', () => {
  it('waits until the element has decoded pixels', () => {
    expect(screenShareVideoHasFrames({ videoWidth: 0, videoHeight: 0 })).toBe(false)
    expect(screenShareVideoHasFrames({ videoWidth: 1280, videoHeight: 720 })).toBe(true)
  })

  it('wraps a MediaStreamTrack when no mediaStream is attached yet', () => {
    if (typeof MediaStream === 'undefined') {
      expect(screenShareStreamForTrack({ mediaStreamTrack: { id: 'screen-track' } as MediaStreamTrack })).toBeNull()
      return
    }
    const mediaStreamTrack = { id: 'screen-track' } as MediaStreamTrack
    const stream = screenShareStreamForTrack({ mediaStreamTrack })
    expect(stream).toBeInstanceOf(MediaStream)
    expect(stream?.getTracks()).toEqual([mediaStreamTrack])
  })
})
