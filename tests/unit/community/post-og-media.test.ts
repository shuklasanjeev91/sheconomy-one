import { describe, expect, it } from 'vitest'

import { collectPostMedia } from '~/community/lib/post-media'

describe('post share media for OG', () => {
  it('prefers the first image URL from a multi-photo post', () => {
    const media = collectPostMedia({
      image_url:
        'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/post-images/a/posts/0.jpg',
      image_urls: [
        'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/post-images/a/posts/0.jpg',
        'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/post-images/a/posts/1.jpg',
      ],
    })
    expect(media[0]?.kind).toBe('image')
    expect(media[0]?.url).toContain('/posts/0.jpg')
  })
})
