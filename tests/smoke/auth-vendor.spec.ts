import fs from 'node:fs'

import { test, expect } from '@playwright/test'

import { authStatePath, hasSmokeTier } from './auth-env'
import {
  assertBodyNotBlank,
  assertNoCrashes,
  assertNotGenderRestricted,
  assertOkResponse,
  gotoAndHydrate,
} from './helpers'
import { vendorRoutes } from './route-matrix'

function requireVendorAuth() {
  test.skip(
    !hasSmokeTier('vendor') || !fs.existsSync(authStatePath('vendor')),
    'Set SMOKE_VENDOR_ACCESS_TOKEN + SMOKE_VENDOR_REFRESH_TOKEN to run',
  )
}

test.describe('vendor console access', () => {
  test.beforeEach(() => {
    requireVendorAuth()
  })

  for (const path of vendorRoutes) {
    test(`${path} shows vendor chrome (not denied / restricted)`, async ({ page }) => {
      const { response, guards } = await gotoAndHydrate(page, path)
      assertOkResponse(path, response)
      assertNoCrashes(path, guards)
      assertNotGenderRestricted(page)
      await assertBodyNotBlank(page)
      await expect(page.locator('body')).not.toContainText(/access denied/i)
      await expect(page.locator('body')).toContainText(
        /shop|product|order|listing|vendor|myshop|dashboard|settings|inventory/i,
        { timeout: 30_000 },
      )
    })
  }
})
