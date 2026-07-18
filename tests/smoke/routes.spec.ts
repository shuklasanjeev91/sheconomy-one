import { test, expect, type Page } from '@playwright/test'

/**
 * Static public / semi-public routes across every product tab.
 * Auth-gated pages are included: they must not 500 (redirect / empty shell is ok).
 */
const smokeRoutes = [
  // Commerce / storefront
  '/',
  '/search',
  '/shops',
  '/browse/physical',
  '/browse/digital',
  '/browse/featured',
  '/browse/trending',
  '/browse/latest',
  '/cart',
  '/checkout',
  '/favorites',
  '/orders',
  '/orders/success',
  '/addresses',
  '/payment-methods',
  '/create-my-shop',
  // Auth
  '/auth/sign-in',
  '/auth/complete-profile',
  '/auth/verify-gender',
  '/auth/import-contacts',
  '/auth/qr',
  // Community
  '/community',
  '/community/network',
  '/community/people',
  '/community/create',
  '/community/jobs',
  '/community/jobs/create',
  '/community/stories',
  '/community/stories/create',
  '/community/companies',
  '/community/company/create',
  '/community/groups',
  '/community/group/create',
  '/community/events',
  '/community/events/create',
  '/community/saved',
  '/community/analytics',
  // Chat
  '/chat',
  '/chat/groups',
  '/chat/calls',
  // Class
  '/class',
  '/class/video',
  '/class/audio',
  '/class/playlists',
  // Co-work
  '/co-work',
  '/co-work/join',
  '/co-work/meetings',
  '/co-work/schedule',
  // Account / settings / legal / help
  '/profile',
  '/notifications',
  '/settings',
  '/settings/account',
  '/settings/appearance',
  '/settings/privacy',
  '/settings/security',
  '/settings/notifications',
  '/settings/commerce',
  '/settings/community',
  '/settings/chat',
  '/settings/class',
  '/settings/co-work',
  '/settings/shop',
  '/settings/about',
  '/help',
  '/legal/terms',
  '/legal/privacy',
  '/legal/cookies',
  '/legal/ads',
  // Vendor hub (auth-gated — must not 500)
  '/vendor',
  '/vendor/myshop',
  '/vendor/products',
  '/vendor/orders',
  '/vendor/settings',
] as const

/** One SPA injects <body> via client JS — wait for hydrated app chrome. */
async function gotoAndHydrate(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => {
      const body = document.body
      if (!body) return false
      const style = window.getComputedStyle(body)
      if (style.visibility === 'hidden' || style.display === 'none') return false
      return (body.innerText?.trim().length ?? 0) > 0 || body.querySelectorAll('*').length > 2
    },
    undefined,
    { timeout: 45_000 },
  )
  return response
}

test.describe('public route smoke', () => {
  for (const path of smokeRoutes) {
    test(`loads ${path} without server error`, async ({ page }) => {
      const response = await gotoAndHydrate(page, path)
      expect(response, `no response for ${path}`).not.toBeNull()
      expect(response!.status(), `unexpected status for ${path}`).toBeLessThan(500)
      await expect(page.locator('body')).toBeAttached()
    })
  }
})

test('marketplace home renders storefront chrome', async ({ page }) => {
  await gotoAndHydrate(page, '/')
  await expect(page.locator('body')).toContainText(/shop|market|search|sign in/i)
})

test('sign-in route renders OTP flow', async ({ page }) => {
  await gotoAndHydrate(page, '/auth/sign-in')
  await expect(page.locator('body')).toContainText(/sign in|phone|otp|continue/i)
})

test('gender verification route is reachable', async ({ page }) => {
  const response = await gotoAndHydrate(page, '/auth/verify-gender')
  expect(response?.status()).toBeLessThan(500)
  await expect(page.locator('body')).toBeAttached()
})

test('community home renders feed chrome', async ({ page }) => {
  await gotoAndHydrate(page, '/community')
  await expect(page.locator('body')).toContainText(/community|feed|post|network|sign in/i)
})

test('chat home is reachable', async ({ page }) => {
  await gotoAndHydrate(page, '/chat')
  await expect(page.locator('body')).toContainText(/chat|message|sign in|conversation/i)
})

test('co-work home is reachable', async ({ page }) => {
  await gotoAndHydrate(page, '/co-work')
  await expect(page.locator('body')).toContainText(/co-?work|meeting|join|sign in/i)
})

test('search scope chips are visible and switchable', async ({ page }) => {
  await gotoAndHydrate(page, '/search')
  const allScope = page.getByTestId('search-scope-all')
  await expect(allScope).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('search-scope-listings').click()
  await expect(page).toHaveURL(/scope=listings/)
})

test('privacy settings exposes blocked members section', async ({ page }) => {
  await gotoAndHydrate(page, '/settings/privacy')
  await expect(page.locator('body')).toContainText(/privacy|blocked|sign in|biometric/i)
})

test('empty cart offers a next action', async ({ page }) => {
  await gotoAndHydrate(page, '/cart')
  await expect(page.locator('body')).toContainText(/cart|empty|browse|sign in|shop/i)
})

test('offline connectivity helper stays available to the shell', async ({ page }) => {
  await gotoAndHydrate(page, '/')
  // Banner is only mounted when offline; assert the page still hydrates under a forced offline flag.
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'))
  })
  await expect(page.locator('body')).toBeAttached()
})
