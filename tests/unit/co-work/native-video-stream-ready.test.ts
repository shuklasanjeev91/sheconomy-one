import { describe, expect, it } from 'vitest'

import { resolveNativeVideoStreamAttachId } from '~/co-work/lib/native-video-stream-ready'

describe('resolveNativeVideoStreamAttachId', () => {
  it('returns null when only track sid exists (pre-MediaStream)', () => {
    expect(resolveNativeVideoStreamAttachId({ sid: 'TR_abc', mediaStream: null })).toBeNull()
    expect(resolveNativeVideoStreamAttachId({ sid: 'TR_abc' })).toBeNull()
  })

  it('does not use a track id as a screen-share attach token', () => {
    expect(
      resolveNativeVideoStreamAttachId(
        { sid: 'TR_abc', mediaStreamTrack: { id: 'track-1' } as MediaStreamTrack },
        { allowTrackIdFallback: false },
      ),
    ).toBeNull()
  })

  it('returns mediaStream.id once the stream attaches', () => {
    expect(
      resolveNativeVideoStreamAttachId({
        sid: 'TR_abc',
        mediaStream: { id: 'stream-1' },
      }),
    ).toBe('stream-1')
  })
})
