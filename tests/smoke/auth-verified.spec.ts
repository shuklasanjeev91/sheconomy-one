import fs from 'node:fs'

import { test, expect } from '@playwright/test'

import { authStatePath, hasSmokeTier } from './auth-env'
import {
  assertBodyNotBlank,
  assertNoCrashes,
  assertNotGenderRestricted,
  assertOkResponse,
  dispatchDomClick,
  gotoAndHydrate,
  gotoHydrated,
} from './helpers'
import { authRequiredRoutes, genderGatedRoutes } from './route-matrix'

function requireVerifiedAuth() {
  test.skip(
    !hasSmokeTier('verified') || !fs.existsSync(authStatePath('verified')),
    'Set SMOKE_VERIFIED_ACCESS_TOKEN + SMOKE_VERIFIED_REFRESH_TOKEN to run',
  )
}

test.describe('verified female access', () => {
  test.beforeEach(() => {
    requireVerifiedAuth()
  })

  const verifiedRoutes = [...new Set([...genderGatedRoutes, ...authRequiredRoutes])]

  for (const path of verifiedRoutes) {
    test(`${path} loads without gender=restricted`, async ({ page }) => {
      const { response, guards } = await gotoAndHydrate(page, path)
      assertOkResponse(path, response)
      assertNoCrashes(path, guards)
      assertNotGenderRestricted(page)
      await assertBodyNotBlank(page)
    })
  }

  test('community shows feed chrome for verified member', async ({ page }) => {
    const { guards } = await gotoAndHydrate(page, '/community')
    assertNoCrashes('/community', guards)
    assertNotGenderRestricted(page)
    await expect(page.locator('body')).toContainText(/community|feed|post|network|create/i, {
      timeout: 25_000,
    })
    await expect(page.locator('body')).not.toContainText(/sign in to continue/i)
  })

  test('chat home is usable for verified member', async ({ page }) => {
    const { guards } = await gotoAndHydrate(page, '/chat')
    assertNoCrashes('/chat', guards)
    assertNotGenderRestricted(page)
    await expect(page.locator('body')).toContainText(/chat|message|conversation|new/i, {
      timeout: 25_000,
    })
  })

  test('settings stays on /settings (not restricted redirect)', async ({ page }) => {
    const { guards } = await gotoAndHydrate(page, '/settings')
    assertNoCrashes('/settings', guards)
    assertNotGenderRestricted(page)
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.locator('body')).toContainText(/settings|account|privacy|appearance/i, {
      timeout: 25_000,
    })
  })

  test('account menu Settings lands on /settings', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/')
    expect(pageErrors).toEqual([])
    assertNotGenderRestricted(page)

    const accountTrigger = page
      .getByRole('button', { name: /account menu|account|you/i })
      .or(page.getByLabel(/account menu|account|you/i))
      .first()
    await expect(accountTrigger).toBeVisible({ timeout: 25_000 })
    await dispatchDomClick(accountTrigger)

    const settings = page.getByText(/^settings/i).or(page.getByRole('button', { name: /settings/i })).first()
    await expect(settings).toBeVisible({ timeout: 15_000 })
    await dispatchDomClick(settings)
    await expect(page).toHaveURL(/\/settings/, { timeout: 20_000 })
    assertNotGenderRestricted(page)
  })

  test('account menu Profile does not bounce to gender=restricted', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/')
    expect(pageErrors).toEqual([])

    const accountTrigger = page
      .getByRole('button', { name: /account menu|account|you/i })
      .or(page.getByLabel(/account menu|account|you/i))
      .first()
    await expect(accountTrigger).toBeVisible({ timeout: 25_000 })
    await dispatchDomClick(accountTrigger)

    const profile = page
      .getByText(/your profile|profile/i)
      .or(page.getByRole('button', { name: /profile/i }))
      .first()
    await expect(profile).toBeVisible({ timeout: 15_000 })
    await dispatchDomClick(profile)
    await page.waitForTimeout(1500)
    assertNotGenderRestricted(page)
    await expect(page).toHaveURL(/\/profile/)
  })
})
