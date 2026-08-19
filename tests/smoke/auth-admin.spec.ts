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

function requireAdminAuth() {
  test.skip(
    !hasSmokeTier('admin') || !fs.existsSync(authStatePath('admin')),
    'Set SMOKE_ADMIN_ACCESS_TOKEN + SMOKE_ADMIN_REFRESH_TOKEN to run',
  )
}

test.describe('admin console smoke', () => {
  test.beforeEach(() => {
    requireAdminAuth()
  })

  test('/admin loads console chrome', async ({ page }) => {
    const { response, guards } = await gotoAndHydrate(page, '/admin')
    assertOkResponse('/admin', response)
    assertNoCrashes('/admin', guards)
    assertNotGenderRestricted(page)
    await assertBodyNotBlank(page)
    await expect(page.locator('body')).toContainText(/admin|dashboard|users|shops|orders/i, {
      timeout: 30_000,
    })
  })
})
