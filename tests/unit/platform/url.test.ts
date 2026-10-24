import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DEEP_LINK_ORIGIN,
  DEFAULT_APP_ORIGIN,
  canonicalizePublicUrl,
  normalizeAppOrigin,
  toPublicShareUrl,
} from '~/config/app-origin'
import { buildAbsoluteUrl } from '~/lib/platform/url'
import { buildShareTargetUrl } from '~/lib/share/actions'
import { getListingShareUrl, getMeetingShareUrl, getPostShareUrl, getProfileShopShareUrl, getShoppableFeedShareUrl, getCommunityListingShareUrl } from '~/lib/share/urls'

describe('buildAbsoluteUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('uses www.sheconomy.in, not window.location or Vercel preview hosts', () => {
    vi.stubEnv('EXPO_PUBLIC_WEB_APP_URL', 'https://sheconomy.in')
    vi.stubGlobal('window', {
      location: { origin: 'https://sheconomy-one-eight.vercel.app' },
    })

    expect(buildAbsoluteUrl('/co-work/meeting/EJB-GHW-FJY')).toBe(
      `${DEFAULT_APP_ORIGIN}/co-work/meeting/EJB-GHW-FJY`,
    )
  })

  it('ignores ephemeral env origins and falls back to production', () => {
    vi.stubEnv('EXPO_PUBLIC_WEB_APP_URL', 'https://preview.vercel.app')
    vi.stubEnv('ONE_SERVER_URL', 'http://localhost:8081')

    expect(buildAbsoluteUrl('listings/foo')).toBe(`${DEFAULT_APP_ORIGIN}/listings/foo`)
  })

  it('maps brand aliases (.com / apex) and Vercel previews to www.sheconomy.in', () => {
    expect(normalizeAppOrigin('https://sheconomy.com')).toBe(DEFAULT_APP_ORIGIN)
    expect(normalizeAppOrigin('https://sheconomy.in/path')).toBe(DEFAULT_APP_ORIGIN)
    expect(canonicalizePublicUrl('https://sheconomy.com/community/post/1')).toBe(
      `${DEFAULT_APP_ORIGIN}/community/post/1`,
    )
    expect(
      canonicalizePublicUrl(
        'https://sheconomy-one-eight.vercel.app/co-work/meeting/ABC',
      ),
    ).toBe(`${DEFAULT_APP_ORIGIN}/co-work/meeting/ABC`)
    expect(
      toPublicShareUrl('https://sheconomy-one-eight.vercel.app/community/post/1'),
    ).toBe(`${DEFAULT_APP_ORIGIN}/community/post/1`)
    expect(toPublicShareUrl('https://sheconomy.in/listing/bag')).toBe(
      `${DEFAULT_APP_ORIGIN}/listing/bag`,
    )
  })

  it('builds meeting links on the verified host and other shares on the canonical host', () => {
    vi.stubEnv('EXPO_PUBLIC_WEB_APP_URL', 'https://sheconomy.in')

    expect(getMeetingShareUrl('EJB-GHW-FJY')).toBe(
      `${DEEP_LINK_ORIGIN}/co-work/meeting/EJB-GHW-FJY`,
    )
    expect(toPublicShareUrl('https://www.sheconomy.in/co-work/meeting/EJB-GHW-FJY')).toBe(
      `${DEEP_LINK_ORIGIN}/co-work/meeting/EJB-GHW-FJY`,
    )
    expect(toPublicShareUrl('https://sheconomy.in/co-work/meeting/EJB-GHW-FJY')).toBe(
      `${DEEP_LINK_ORIGIN}/co-work/meeting/EJB-GHW-FJY`,
    )
    expect(toPublicShareUrl('sheconomy://cowork/meeting/EJB-GHW-FJY')).toBe(
      `${DEEP_LINK_ORIGIN}/co-work/meeting/EJB-GHW-FJY`,
    )
    expect(
      buildShareTargetUrl('whatsapp', {
        url: 'https://www.sheconomy.in/co-work/meeting/EJB-GHW-FJY',
        text: 'Join my meeting',
      }),
    ).toContain(encodeURIComponent('https://www.sheconomy.in/co-work/meeting/EJB-GHW-FJY'))
    expect(getListingShareUrl('handmade-bag')).toBe(`${DEFAULT_APP_ORIGIN}/listing/handmade-bag`)
    expect(getPostShareUrl('abc').startsWith(`${DEFAULT_APP_ORIGIN}/`)).toBe(true)
    expect(getProfileShopShareUrl('jane')).toMatch(/\/profile\/jane\/shop$/)
    expect(getShoppableFeedShareUrl()).toContain('shoppable=1')
    expect(getCommunityListingShareUrl('/listing/scarf', 'post-1', 'feed')).toContain('source=feed')
    expect(
      buildShareTargetUrl('whatsapp', {
        url: 'https://sheconomy-one-eight.vercel.app/listing/bag',
      }),
    ).toContain(encodeURIComponent(`${DEFAULT_APP_ORIGIN}/listing/bag`))
  })
})
