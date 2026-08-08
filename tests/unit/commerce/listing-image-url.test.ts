import { describe, expect, it } from 'vitest'

import {
  getListingImageUrl,
  withListingImageDisplaySize,
} from '~/commerce/lib/images/listing-image-url'

describe('listing image display sizing', () => {
  it('rewrites supabase object URLs to render/image with size params', () => {
    const raw =
      'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/listing-images/a/b.jpg'
    const out = withListingImageDisplaySize(raw, { width: 640, height: 640, quality: 72 })
    expect(out).toContain('/storage/v1/render/image/public/listing-images/a/b.jpg')
    expect(out).toContain('width=640')
    expect(out).toContain('height=640')
    expect(out).toContain('quality=72')
    expect(out).toContain('resize=cover')
  })

  it('leaves image-proxy URLs alone', () => {
    const proxy =
      'https://zsaqrrzwygzwrlzgymxk.supabase.co/functions/v1/image-proxy?url=https%3A%2F%2Fibb.co%2Fx'
    expect(withListingImageDisplaySize(proxy, { width: 640 })).toBe(proxy)
  })

  it('applies sizing through getListingImageUrl for allowed hosts', () => {
    const raw =
      'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/post-media/listings/x.jpg'
    const out = getListingImageUrl(raw, undefined, { width: 144, height: 144 })
    expect(out).toContain('/storage/v1/render/image/public/post-media/listings/x.jpg')
    expect(out).toContain('width=144')
  })

  it('rewrites cloudfront listing-images to supabase render when sized', () => {
    const raw = 'https://dfasp73o8frrg.cloudfront.net/listing-images/shop/photo.jpg'
    const out = withListingImageDisplaySize(raw, { width: 480, height: 480 })
    expect(out.startsWith('https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/render/image/public/')).toBe(
      true,
    )
    expect(out).toContain('listing-images/shop/photo.jpg')
    expect(out).toContain('width=480')
  })

  it('does not rewrite cloudfront /images/... catalog URLs to supabase', () => {
    const raw =
      'https://dfasp73o8frrg.cloudfront.net/images/detailed/11/Floor-Coverings.png?t=1708059337'
    expect(withListingImageDisplaySize(raw, { width: 640, height: 640 })).toBe(raw)
    expect(getListingImageUrl(raw, undefined, { width: 640, height: 640 })).toBe(raw)
  })
})
