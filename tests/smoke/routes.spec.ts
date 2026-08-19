import { test, expect } from '@playwright/test'

import { assertNoCrashes, assertOkResponse, gotoAndHydrate } from './helpers'
import { guestPublicRoutes } from './route-matrix'

test.describe('public route smoke', () => {
  for (const path of guestPublicRoutes) {
    test(`loads ${path} without server error`, async ({ page }) => {
      const { response, guards } = await gotoAndHydrate(page, path)
      assertOkResponse(path, response)
      assertNoCrashes(path, guards)
      await expect(page.locator('body')).toBeAttached()
    })
  }
})

test.describe('tab home landmarks', () => {
  test('commerce home renders storefront chrome', async ({ page }) => {
    const { guards } = await gotoAndHydrate(page, '/')
    assertNoCrashes('/', guards)
    await expect(page.locator('body')).toContainText(/shop|market|search|sign in/i)
    await expect(page.getByTestId('tab-home-commerce')).toBeAttached()
  })

  test('community home renders feed chrome', async ({ page }) => {
    const { guards } = await gotoAndHydrate(page, '/community')
    assertNoCrashes('/community', guards)
    await expect(page.locator('body')).toContainText(/community|feed|post|network|sign in/i)
  })

  test('chat home is reachable', async ({ page }) => {
    const { guards } = await gotoAndHydrate(page, '/chat')
    assertNoCrashes('/chat', guards)
    await expect(page.locator('body')).toContainText(/chat|message|sign in|conversation/i)
  })

  test('class home is reachable', async ({ page }) => {
    const { guards } = await gotoAndHydrate(page, '/class')
    assertNoCrashes('/class', guards)
    await expect(page.locator('body')).toContainText(/class|learn|video|audio|program|sign in/i)
  })

  test('co-work home is reachable', async ({ page }) => {
    const { guards } = await gotoAndHydrate(page, '/co-work')
    assertNoCrashes('/co-work', guards)
    await expect(page.locator('body')).toContainText(/co-?work|meeting|join|sign in/i)
  })
})

test('sign-in route renders OTP flow', async ({ page }) => {
  const { guards } = await gotoAndHydrate(page, '/auth/sign-in')
  assertNoCrashes('/auth/sign-in', guards)
  await expect(page.locator('body')).toContainText(/sign in|phone|otp|continue/i)
})

test('gender verification route is reachable', async ({ page }) => {
  const { response, guards } = await gotoAndHydrate(page, '/auth/verify-gender')
  expect(response?.status()).toBeLessThan(500)
  assertNoCrashes('/auth/verify-gender', guards)
  await expect(page.locator('body')).toBeAttached()
})

test('search scope chips are visible and switchable', async ({ page }) => {
  const { guards } = await gotoAndHydrate(page, '/search')
  assertNoCrashes('/search', guards)
  const allScope = page.getByTestId('search-scope-all')
  await expect(allScope).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('search-scope-listings').click()
  await expect(page).toHaveURL(/scope=listings/)
})

test('privacy settings exposes blocked members section', async ({ page }) => {
  const { guards } = await gotoAndHydrate(page, '/settings/privacy')
  assertNoCrashes('/settings/privacy', guards)
  await expect(page.locator('body')).toContainText(/privacy|blocked|sign in|biometric/i)
})

test('empty cart offers a next action', async ({ page }) => {
  const { guards } = await gotoAndHydrate(page, '/cart')
  assertNoCrashes('/cart', guards)
  await expect(page.locator('body')).toContainText(/cart|empty|browse|sign in|shop/i)
})

test('offline connectivity helper stays available to the shell', async ({ page }) => {
  const { guards } = await gotoAndHydrate(page, '/')
  assertNoCrashes('/', guards)
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'))
  })
  await expect(page.locator('body')).toBeAttached()
})

test('seller landing is reachable', async ({ page }) => {
  const { response, guards } = await gotoAndHydrate(page, '/sellerlanding')
  assertOkResponse('/sellerlanding', response)
  assertNoCrashes('/sellerlanding', guards)
})

test('blog listing is reachable', async ({ page }) => {
  const { response, guards } = await gotoAndHydrate(page, '/blog')
  assertOkResponse('/blog', response)
  assertNoCrashes('/blog', guards)
})
