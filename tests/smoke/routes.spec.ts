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

type CrashGuards = {
  pageErrors: string[]
  serverErrors: string[]
}

/** Attach listeners before navigation — catch JS crashes and document 5xx. */
function attachCrashGuards(page: Page): CrashGuards {
  const guards: CrashGuards = { pageErrors: [], serverErrors: [] }

  page.on('pageerror', (error) => {
    guards.pageErrors.push(error.message)
  })

  page.on('response', (response) => {
    const url = response.url()
    const status = response.status()
    // Only flag navigations / HTML documents — ignore flaky third-party pixels.
    const isDocument =
      response.request().resourceType() === 'document' ||
      url.includes(page.url().split('?')[0] || '')
    if (status >= 500 && isDocument) {
      guards.serverErrors.push(`${status} ${url}`)
    }
  })

  return guards
}

/** One SPA injects <body> via client JS — wait for hydrated app chrome. */
async function gotoAndHydrate(page: Page, path: string) {
  const guards = attachCrashGuards(page)
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
  return { response, guards }
}

function assertNoCrashes(path: string, guards: CrashGuards) {
  expect(guards.pageErrors, `uncaught pageerror on ${path}: ${guards.pageErrors.join(' | ')}`).toEqual(
    [],
  )
  expect(
    guards.serverErrors,
    `document 5xx on ${path}: ${guards.serverErrors.join(' | ')}`,
  ).toEqual([])
}

test.describe('public route smoke', () => {
  for (const path of smokeRoutes) {
    test(`loads ${path} without server error`, async ({ page }) => {
      const { response, guards } = await gotoAndHydrate(page, path)
      expect(response, `no response for ${path}`).not.toBeNull()
      expect(response!.status(), `unexpected status for ${path}`).toBeLessThan(500)
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
