import { describe, expect, it } from 'vitest'

import {
  getVideoPosterUrl,
  videoSrcWithFirstFrame,
} from '~/lib/media/video-thumbnail'

describe('video thumbnails', () => {
  it('derives YouTube posters from video URLs', () => {
    expect(getVideoPosterUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    )
    expect(getVideoPosterUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    )
    expect(getVideoPosterUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    )
  })

  it('prefers an explicit poster', () => {
    expect(
      getVideoPosterUrl('https://cdn.example.com/a.mp4', 'https://cdn.example.com/a.jpg'),
    ).toBe('https://cdn.example.com/a.jpg')
  })

  it('adds a first-frame tip for direct files on web', () => {
    expect(videoSrcWithFirstFrame('https://cdn.example.com/clip.mp4')).toBe(
      'https://cdn.example.com/clip.mp4#t=0.001',
    )
    expect(videoSrcWithFirstFrame('https://cdn.example.com/clip.mp4#t=1')).toBe(
      'https://cdn.example.com/clip.mp4#t=1',
    )
  })

  it('returns null for opaque mp4 without a poster', () => {
    expect(getVideoPosterUrl('https://cdn.example.com/clip.mp4')).toBeNull()
  })
})
