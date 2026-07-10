import { test, expect } from '@playwright/test'

const smokeRoutes = [
  '/',
  '/auth/sign-in',
  '/search',
  '/shops',
  '/community',
  '/community/stories',
  '/community/groups',
  '/community/events',
  '/auth/verify-gender',
  '/class',
  '/chat',
  '/co-work',
] as const

test.describe('public route smoke', () => {
  for (const path of smokeRoutes) {
    test(`loads ${path} without server error`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(response, `no response for ${path}`).not.toBeNull()
      expect(response!.status(), `unexpected status for ${path}`).toBeLessThan(500)
      await expect(page.locator('body')).toBeVisible()
    })
  }
})

test('marketplace home renders storefront chrome', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toContainText(/shop|market|search|sign in/i)
})

test('sign-in route renders OTP flow', async ({ page }) => {
  await page.goto('/auth/sign-in')
  await expect(page.locator('body')).toContainText(/sign in|phone|otp|continue/i)
})

test('gender verification route is reachable', async ({ page }) => {
  const response = await page.goto('/auth/verify-gender')
  expect(response?.status()).toBeLessThan(500)
  await expect(page.locator('body')).toBeVisible()
})
