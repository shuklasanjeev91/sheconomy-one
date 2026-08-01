import { describe, expect, it } from 'vitest'

import {
  extractFirstUrl,
  getVideoEmbed,
  parseVideoProvider,
  type LinkPreview,
} from '~/lib/link-preview'

describe('parseVideoProvider', () => {
  it('detects YouTube watch, short, and youtu.be links', () => {
    expect(parseVideoProvider('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.id).toBe('dQw4w9WgXcQ')
    expect(parseVideoProvider('https://youtu.be/dQw4w9WgXcQ')?.id).toBe('dQw4w9WgXcQ')
    expect(parseVideoProvider('https://www.youtube.com/shorts/dQw4w9WgXcQ')?.id).toBe('dQw4w9WgXcQ')
    expect(parseVideoProvider('https://www.youtube.com/embed/dQw4w9WgXcQ')?.id).toBe('dQw4w9WgXcQ')
  })

  it('detects Vimeo links', () => {
    expect(parseVideoProvider('https://vimeo.com/123456789')?.provider).toBe('vimeo')
    expect(parseVideoProvider('https://player.vimeo.com/video/123456789')?.provider).toBe('vimeo')
  })
})

describe('getVideoEmbed', () => {
  it('builds iframe embeds from known provider URLs even without scraped metadata', () => {
    const preview: LinkPreview = {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: null,
      description: null,
      image: null,
      siteName: null,
      video: null,
      videoType: null,
    }
    expect(getVideoEmbed(preview)).toEqual({
      src: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      kind: 'iframe',
    })
  })
})

describe('extractFirstUrl', () => {
  it('pulls the first http(s) URL from post text', () => {
    expect(
      extractFirstUrl('Check this out https://youtu.be/dQw4w9WgXcQ thanks!'),
    ).toBe('https://youtu.be/dQw4w9WgXcQ')
  })
})
