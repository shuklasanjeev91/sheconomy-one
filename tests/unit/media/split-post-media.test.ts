import { describe, expect, it } from 'vitest'

import { isPickedVideo, splitPostMediaItems } from '~/lib/media/split-post-media'

describe('splitPostMediaItems', () => {
  it('keeps photos and videos together from a mixed pick', () => {
    const { photos, videos } = splitPostMediaItems([
      { uri: 'file:///a.jpg', mimeType: 'image/jpeg', fileName: 'a.jpg' },
      { uri: 'file:///b.mp4', mimeType: 'video/mp4', fileName: 'b.mp4' },
      { uri: 'file:///c.png', mimeType: 'image/png', fileName: 'c.png' },
    ])

    expect(photos).toHaveLength(2)
    expect(videos).toHaveLength(1)
    expect(videos[0]?.fileName).toBe('b.mp4')
  })

  it('detects videos by extension when mime is missing', () => {
    expect(isPickedVideo({ uri: 'file:///clip.MOV', mimeType: '', fileName: 'clip.MOV' })).toBe(
      true,
    )
    expect(isPickedVideo({ uri: 'file:///shot.heic', mimeType: '', fileName: 'shot.heic' })).toBe(
      false,
    )
  })
})
