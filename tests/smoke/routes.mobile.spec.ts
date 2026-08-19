import { test, expect } from '@playwright/test'

import { assertNoCrashes, assertOkResponse, gotoAndHydrate } from './helpers'
import { guestMobileRoutes } from './route-matrix'

/**
 * Mobile viewport route smoke (iPhone 13 project).
 * Smaller matrix than desktop to keep CI time bounded.
 */
test.describe('mobile public route smoke', () => {
  for (const path of guestMobileRoutes) {
    test(`loads ${path} without server error`, async ({ page }) => {
      const { response, guards } = await gotoAndHydrate(page, path)
      assertOkResponse(path, response)
      assertNoCrashes(path, guards)
      await expect(page.locator('body')).toBeAttached()
    })
  }
})
