import { describe, expect, it } from 'vitest'

import {
  ANDROID_PACKAGE_ID,
  buildAndroidIntentUrl,
  buildOpenInAppSchemeUrl,
  buildSmartAppBannerContent,
} from '~/lib/platform/open-in-app'

describe('open-in-app helpers', () => {
  it('builds custom scheme URLs', () => {
    expect(buildOpenInAppSchemeUrl('/listing/bag')).toBe('sheconomy://listing/bag')
    expect(buildOpenInAppSchemeUrl('orders/1')).toBe('sheconomy://orders/1')
  })

  it('builds Android intent URLs', () => {
    const url = buildAndroidIntentUrl('/shop/foo')
    expect(url).toContain('intent://shop/foo#Intent;')
    expect(url).toContain(`scheme=sheconomy`)
    expect(url).toContain(`package=${ANDROID_PACKAGE_ID}`)
  })

  it('builds Smart App Banner content', () => {
    expect(buildSmartAppBannerContent('/community')).toContain('app-id=6499198194')
    expect(buildSmartAppBannerContent('/community')).toContain('app-argument=/community')
  })
})
