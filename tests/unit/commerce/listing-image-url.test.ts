import { describe, expect, it } from 'vitest'

import {
  getListingImageUrl,
  withListingImageDisplaySize,
} from '~/commerce/lib/images/listing-image-url'

describe('listing image display sizing', () => {
  it('keeps supabase object URLs (no image transforms under spend-cap quota)', () => {
    const raw =
      'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/listing-images/a/b.jpg'
    const out = withListingImageDisplaySize(raw, { width: 640, height: 640, quality: 72 })
    expect(out).toBe(raw)
  })

  it('rewrites existing render/image URLs back to object URLs', () => {
    const raw =
      'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/render/image/public/listing-images/a/b.jpg?width=640'
    const out = withListingImageDisplaySize(raw, { width: 640 })
    expect(out).toBe(
      'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/listing-images/a/b.jpg',
    )
  })

  it('leaves image-proxy URLs alone', () => {
    const proxy =
      'https://zsaqrrzwygzwrlzgymxk.supabase.co/functions/v1/image-proxy?url=https%3A%2F%2Fibb.co%2Fx'
    expect(withListingImageDisplaySize(proxy, { width: 640 })).toBe(proxy)
  })

  it('keeps object URLs through getListingImageUrl for allowed hosts', () => {
    const raw =
      'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/post-media/listings/x.jpg'
    const out = getListingImageUrl(raw, undefined, { width: 144, height: 144 })
    expect(out).toBe(raw)
  })

  it('leaves cloudfront listing-images unchanged (no supabase render rewrite)', () => {
    const raw = 'https://dfasp73o8frrg.cloudfront.net/listing-images/shop/photo.jpg'
    const out = withListingImageDisplaySize(raw, { width: 480, height: 480 })
    expect(out).toBe(raw)
  })

  it('does not rewrite cloudfront /images/... catalog URLs to supabase', () => {
    const raw =
      'https://dfasp73o8frrg.cloudfront.net/images/detailed/11/Floor-Coverings.png?t=1708059337'
    expect(withListingImageDisplaySize(raw, { width: 640, height: 640 })).toBe(raw)
    expect(getListingImageUrl(raw, undefined, { width: 640, height: 640 })).toBe(raw)
  })
})
