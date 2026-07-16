import { describe, expect, it } from 'vitest'

import {
  getMobileBackFallback,
  isMobileRootPath,
  shouldShowMobileBack,
} from '~/lib/navigation/mobile-back'
import { appRoutes } from '~/lib/routes'

describe('settings hub routes', () => {
  it('builds section hrefs under /settings', () => {
    expect(String(appRoutes.settings)).toBe('/settings')
    expect(String(appRoutes.settingsSection('account'))).toBe('/settings/account')
    expect(String(appRoutes.settingsSection('security'))).toBe('/settings/security')
    expect(String(appRoutes.settingsSection('co-work'))).toBe('/settings/co-work')
  })
})

describe('settings mobile back', () => {
  it('treats hub as root and sections as drill-ins', () => {
    expect(isMobileRootPath('/settings')).toBe(true)
    expect(shouldShowMobileBack('/settings')).toBe(false)
    expect(shouldShowMobileBack('/settings/account')).toBe(true)
    // Mobile list→detail: section falls back to hub.
    expect(getMobileBackFallback('/settings/commerce')).toBe('/settings')
    expect(getMobileBackFallback('/settings')).toBe('/community')
  })
})
