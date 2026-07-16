import { describe, expect, it } from 'vitest'

import { inAppPathFromUrl } from '~/lib/platform/inAppPath'

describe('inAppPathFromUrl', () => {
  it('treats relative paths as in-app', () => {
    expect(inAppPathFromUrl('/community')).toBe('/community')
    expect(inAppPathFromUrl('/chat/abc?x=1')).toBe('/chat/abc?x=1')
  })

  it('rejects protocol-relative and external urls', () => {
    expect(inAppPathFromUrl('//evil.com')).toBeNull()
    expect(inAppPathFromUrl('https://example.com/foo')).toBeNull()
  })

  it('rejects mailto / tel / custom schemes', () => {
    expect(inAppPathFromUrl('mailto:a@b.com')).toBeNull()
    expect(inAppPathFromUrl('tel:+15551212')).toBeNull()
    expect(inAppPathFromUrl('sheconomy://community')).toBeNull()
  })
})
