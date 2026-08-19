import { test, expect } from '@playwright/test'

import { dispatchDomClick, gotoHydrated } from './helpers'

/**
 * Mobile (iPhone 13 project) guest interactions.
 */
test.describe('guest mobile commerce tabs', () => {
  test('Shops bottom tab navigates to /shops', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/')
    expect(pageErrors).toEqual([])

    const shops = page.getByRole('tab', { name: 'Shops' })
    await expect(shops).toBeVisible({ timeout: 20_000 })
    // Prefer Playwright's click (fires the full pointer sequence Tamagui expects).
    await shops.click()
    try {
      await expect(page).toHaveURL(/\/shops/, { timeout: 10_000 })
    } catch {
      await dispatchDomClick(shops)
      await expect(page).toHaveURL(/\/shops/, { timeout: 15_000 })
    }
  })

  test('Create shop bottom tab is present with full label', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/')
    expect(pageErrors).toEqual([])
    await expect(page.getByRole('tab', { name: /create shop|manage shop/i })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('guest community route shows sign-in on mobile', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/community')
    expect(pageErrors).toEqual([])
    await expect(page.locator('body')).toContainText(/sign in|otp|email|phone|continue|welcome to sheconomy/i, {
      timeout: 20_000,
    })
  })
})
