import { test, expect } from '@playwright/test'

import {
  assertNoCrashes,
  assertNotGenderRestricted,
  assertOkResponse,
  gotoAndHydrate,
  gotoHydrated,
} from './helpers'

/**
 * Phase-2 live high-risk checklist — guest / signed-out surfaces.
 * Authenticated tiers run in auth-*.spec.ts when SMOKE_* tokens are set.
 */
test.describe('live high-risk (guest)', () => {
  test('commerce home: search, cart chrome, no restricted redirect', async ({ page }) => {
    const { response, guards } = await gotoAndHydrate(page, '/')
    assertOkResponse('/', response)
    assertNoCrashes('/', guards)
    assertNotGenderRestricted(page)
    await expect(page.getByTestId('tab-home-commerce')).toBeAttached()
    await expect(page.locator('body')).toContainText(/shop|search|market/i)
  })

  test('search screen scopes work', async ({ page }) => {
    const { guards } = await gotoAndHydrate(page, '/search')
    assertNoCrashes('/search', guards)
    await expect(page.getByTestId('search-scope-all')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('search-scope-shops').click()
    await expect(page).toHaveURL(/scope=shops/)
  })

  test('cart empty state offers browse', async ({ page }) => {
    const { guards } = await gotoAndHydrate(page, '/cart')
    assertNoCrashes('/cart', guards)
    await expect(page.locator('body')).toContainText(/cart|empty|browse|shop/i)
  })

  test('checkout gates guest to sign-in', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/checkout')
    expect(pageErrors).toEqual([])
    await expect(page.locator('body')).toContainText(/sign in|otp|email|phone|continue|welcome to sheconomy/i, {
      timeout: 25_000,
    })
  })

  test('orders gates guest to sign-in', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/orders')
    expect(pageErrors).toEqual([])
    await expect(page.locator('body')).toContainText(/sign in|otp|email|phone|continue|welcome to sheconomy/i, {
      timeout: 25_000,
    })
  })

  test('community gates guest to sign-in (not gender=restricted)', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/community')
    expect(pageErrors).toEqual([])
    assertNotGenderRestricted(page)
    await expect(page.locator('body')).toContainText(/sign in|otp|email|phone|continue|welcome to sheconomy/i, {
      timeout: 25_000,
    })
  })

  test('chat gates guest to sign-in (not gender=restricted)', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/chat')
    expect(pageErrors).toEqual([])
    assertNotGenderRestricted(page)
    await expect(page.locator('body')).toContainText(/sign in|otp|email|phone|continue|welcome to sheconomy/i, {
      timeout: 25_000,
    })
  })

  test('class and co-work homes stay reachable for guests', async ({ page }) => {
    for (const path of ['/class', '/co-work', '/co-work/join'] as const) {
      const { response, guards } = await gotoAndHydrate(page, path)
      assertOkResponse(path, response)
      assertNoCrashes(path, guards)
      assertNotGenderRestricted(page)
    }
  })

  test('help and legal stay public', async ({ page }) => {
    for (const path of ['/help', '/legal/terms', '/legal/privacy'] as const) {
      const { response, guards } = await gotoAndHydrate(page, path)
      assertOkResponse(path, response)
      assertNoCrashes(path, guards)
      assertNotGenderRestricted(page)
    }
  })

  test('vendor console does not 500 for guests', async ({ page }) => {
    const { response, guards } = await gotoAndHydrate(page, '/vendor')
    assertOkResponse('/vendor', response)
    assertNoCrashes('/vendor', guards)
    // Guest should see sign-in or denied — never a crash shell.
    await expect(page.locator('body')).toContainText(/sign in|otp|access|vendor|welcome to sheconomy/i, {
      timeout: 25_000,
    })
  })
})
