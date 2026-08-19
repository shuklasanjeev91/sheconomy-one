import fs from 'node:fs'

import { test, expect } from '@playwright/test'

import { authStatePath, hasSmokeTier } from './auth-env'
import {
  assertBodyNotBlank,
  assertNoCrashes,
  assertNotGenderRestricted,
  assertOkResponse,
  gotoAndHydrate,
  gotoHydrated,
} from './helpers'
import { genderGatedRoutes } from './route-matrix'

function requireLimitedAuth() {
  test.skip(
    !hasSmokeTier('limited') || !fs.existsSync(authStatePath('limited')),
    'Set SMOKE_LIMITED_ACCESS_TOKEN + SMOKE_LIMITED_REFRESH_TOKEN to run',
  )
}

test.describe('limited member access', () => {
  test.beforeEach(() => {
    requireLimitedAuth()
  })

  for (const path of genderGatedRoutes) {
    test(`${path} opens verification or safe gate (not blank)`, async ({ page }) => {
      const { response, guards } = await gotoAndHydrate(page, path)
      assertOkResponse(path, response)
      assertNoCrashes(path, guards)
      await assertBodyNotBlank(page)
      await expect(page.locator('body')).toContainText(
        /verify|human|restricted|access|camera|skip|community|chat|sign in|continue/i,
        { timeout: 25_000 },
      )
    })
  }

  test('Community tab intent opens verification (not a dead tab)', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/')
    expect(pageErrors).toEqual([])
    const community = page.getByRole('link', { name: /community/i }).first()
    await expect(community).toBeVisible({ timeout: 20_000 })
    await community.click()
    await page.waitForTimeout(1500)
    assertNotGenderRestricted(page)
    await expect(page.locator('body')).toContainText(/verify|human|restricted|camera|skip|continue/i, {
      timeout: 25_000,
    })
  })

  test('Chat tab intent opens verification (not a dead tab)', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/')
    expect(pageErrors).toEqual([])
    const chat = page.getByRole('link', { name: /chat/i }).first()
    await expect(chat).toBeVisible({ timeout: 20_000 })
    await chat.click()
    await page.waitForTimeout(1500)
    await expect(page.locator('body')).toContainText(/verify|human|restricted|camera|skip|continue|chat/i, {
      timeout: 25_000,
    })
  })
})
