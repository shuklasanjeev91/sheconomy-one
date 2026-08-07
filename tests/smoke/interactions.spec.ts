import { test, expect, type Page } from '@playwright/test'

/**
 * Guest-tier interaction smoke.
 * All center tabs stay visible. Community / Chat / account still gate guests
 * to sign-in (or verification for signed-in limited members).
 */

function attachPageErrors(page: Page) {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })
  return pageErrors
}

async function gotoHydrated(page: Page, path: string) {
  const pageErrors = attachPageErrors(page)
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => (document.body?.innerText?.trim().length ?? 0) > 0,
    undefined,
    { timeout: 45_000 },
  )
  // Let client navigation handlers finish mounting after hydration.
  await page.waitForTimeout(1500)
  return pageErrors
}

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
    await expect(page.locator('body')).toContainText(/sign in|otp|email|phone|continue/i, {
      timeout: 20_000,
    })
  })

  test('guest chat route shows sign-in (access gate)', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/chat')
    expect(pageErrors).toEqual([])
    await expect(page.locator('body')).toContainText(/sign in|otp|email|phone|continue/i, {
      timeout: 20_000,
    })
  })

  test('center Community tab gates guests to sign-in', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/')
    expect(pageErrors).toEqual([])
    await page.getByRole('link', { name: /community/i }).first().click()
    await expect(page.locator('body')).toContainText(/sign in|otp|email|phone|continue/i, {
      timeout: 20_000,
    })
  })
})

test.describe('guest mobile commerce tabs', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Shops bottom tab navigates to /shops', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/')
    expect(pageErrors).toEqual([])

    const shops = page.getByRole('tab', { name: 'Shops' })
    await expect(shops).toBeVisible({ timeout: 20_000 })
    // Prefer DOM click + mouse events — more reliable than Playwright's synthetic
    // press against Tamagui onPress while other workers stress the Vite server.
    await shops.evaluate((el) => {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await expect(page).toHaveURL(/\/shops/, { timeout: 20_000 })
  })

  test('Create shop bottom tab is present with full label', async ({ page }) => {
    const pageErrors = await gotoHydrated(page, '/')
    expect(pageErrors).toEqual([])
    await expect(page.getByRole('tab', { name: /create shop|manage shop/i })).toBeVisible({
      timeout: 20_000,
    })
  })
})
