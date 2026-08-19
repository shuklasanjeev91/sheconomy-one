import { test, expect } from '@playwright/test'

import { gotoHydrated } from './helpers'

/**
 * Guest-tier interaction smoke (desktop).
 * All center tabs stay visible. Community / Chat still gate guests to sign-in.
 */
test.describe('guest product navigation (web)', () => {
  test('commerce home exposes all center nav tabs', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/')
    expect(pageErrors).toEqual([])
    await expect(page.getByRole('link', { name: /commerce/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('link', { name: /community/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /chat/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /classes/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /co-work/i }).first()).toBeVisible()
  })

  test('guest community route shows sign-in (access gate)', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/community')
    expect(pageErrors).toEqual([])
    await expect(page.locator('body')).toContainText(/sign in|otp|email|phone|continue|welcome to sheconomy/i, {
      timeout: 20_000,
    })
  })

  test('guest chat route shows sign-in (access gate)', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/chat')
    expect(pageErrors).toEqual([])
    await expect(page.locator('body')).toContainText(/sign in|otp|email|phone|continue|welcome to sheconomy/i, {
      timeout: 20_000,
    })
  })

  test('center Community tab gates guests to sign-in', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/')
    expect(pageErrors).toEqual([])
    await page.getByRole('link', { name: /community/i }).first().click()
    await expect(page.locator('body')).toContainText(/sign in|otp|email|phone|continue|welcome to sheconomy/i, {
      timeout: 20_000,
    })
  })
})
