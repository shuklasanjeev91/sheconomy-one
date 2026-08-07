import { describe, expect, it } from 'vitest'

import { pathFromIncomingUrl } from '~/lib/platform/path-from-incoming-url'

describe('pathFromIncomingUrl', () => {
  it('parses custom scheme links', () => {
    expect(pathFromIncomingUrl('sheconomy://listing/handmade-bag')).toBe('/listing/handmade-bag')
    expect(pathFromIncomingUrl('sheconomy:///orders/123')).toBe('/orders/123')
  })

  it('parses apex and www https links', () => {
    expect(pathFromIncomingUrl('https://sheconomy.in/shop/foo')).toBe('/shop/foo')
    expect(pathFromIncomingUrl('https://www.sheconomy.in/community/post/1?x=1')).toBe(
      '/community/post/1?x=1',
    )
  })

  it('parses brand alias hosts', () => {
    expect(pathFromIncomingUrl('https://sheconomy.com/co-work/meeting/ABC')).toBe(
      '/co-work/meeting/ABC',
    )
  })

  it('rejects unrelated hosts', () => {
    expect(pathFromIncomingUrl('https://example.com/listing/x')).toBeNull()
    expect(pathFromIncomingUrl('')).toBeNull()
  })
})
