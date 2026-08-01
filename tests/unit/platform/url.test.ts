import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_APP_ORIGIN,
  canonicalizePublicUrl,
  normalizeAppOrigin,
} from '~/config/app-origin'
import { buildAbsoluteUrl } from '~/lib/platform/url'
import { getListingShareUrl, getMeetingShareUrl, getPostShareUrl } from '~/lib/share/urls'

describe('buildAbsoluteUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('uses the canonical origin, not window.location', () => {
    vi.stubEnv('EXPO_PUBLIC_WEB_APP_URL', 'https://sheconomy.in')
    vi.stubGlobal('window', {
      location: { origin: 'https://sheconomy-one-sanjeev-shuklas-projects.vercel.app' },
    })

    expect(buildAbsoluteUrl('/co-work/meeting/EJB-GHW-FJY')).toBe(
      'https://sheconomy.in/co-work/meeting/EJB-GHW-FJY',
    )
  })

  it('ignores ephemeral env origins and falls back to production', () => {
    vi.stubEnv('EXPO_PUBLIC_WEB_APP_URL', 'https://preview.vercel.app')
    vi.stubEnv('ONE_SERVER_URL', 'http://localhost:8081')

    expect(buildAbsoluteUrl('listings/foo')).toBe(`${DEFAULT_APP_ORIGIN}/listings/foo`)
  })

  it('maps brand aliases (.com / www) to sheconomy.in', () => {
    expect(normalizeAppOrigin('https://sheconomy.com')).toBe(DEFAULT_APP_ORIGIN)
    expect(normalizeAppOrigin('https://www.sheconomy.in/path')).toBe(DEFAULT_APP_ORIGIN)
    expect(canonicalizePublicUrl('https://sheconomy.com/community/post/1')).toBe(
      'https://sheconomy.in/community/post/1',
    )
    expect(
      canonicalizePublicUrl(
        'https://sheconomy-one-sanjeev-shuklas-projects.vercel.app/co-work/meeting/ABC',
      ),
    ).toBe('https://sheconomy.in/co-work/meeting/ABC')
  })

  it('builds meeting, listing, and post share URLs on sheconomy.in', () => {
    vi.stubEnv('EXPO_PUBLIC_WEB_APP_URL', 'https://sheconomy.in')

    expect(getMeetingShareUrl('EJB-GHW-FJY')).toBe(
      'https://sheconomy.in/co-work/meeting/EJB-GHW-FJY',
    )
    expect(getListingShareUrl('handmade-bag')).toMatch(/^https:\/\/sheconomy\.in\//)
    expect(getPostShareUrl('abc')).toMatch(/^https:\/\/sheconomy\.in\//)
  })
})
