import { expect, type Page, type Response } from '@playwright/test'

export type CrashGuards = {
  pageErrors: string[]
  serverErrors: string[]
}

/** Attach listeners before navigation — catch JS crashes and document 5xx. */
export function attachCrashGuards(page: Page): CrashGuards {
  const guards: CrashGuards = { pageErrors: [], serverErrors: [] }

  page.on('pageerror', (error) => {
    guards.pageErrors.push(error.message)
  })

  page.on('response', (response) => {
    const url = response.url()
    const status = response.status()
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
export async function gotoAndHydrate(page: Page, path: string) {
  const guards = attachCrashGuards(page)
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
  try {
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
  } catch {
    // Parallel Vite load can leave a blank first paint — one reload usually recovers.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => {
        const body = document.body
        if (!body) return false
        return (body.innerText?.trim().length ?? 0) > 0 || body.querySelectorAll('*').length > 2
      },
      undefined,
      { timeout: 45_000 },
    )
  }
  return { response, guards }
}

/** Guest interaction helper — hydrate + short settle for client handlers. */
export async function gotoHydrated(page: Page, path: string) {
  const { guards } = await gotoAndHydrate(page, path)
  // Let client navigation handlers finish mounting after hydration.
  await page.waitForTimeout(1500)
  return guards.pageErrors
}

export function assertNoCrashes(path: string, guards: CrashGuards) {
  expect(guards.pageErrors, `uncaught pageerror on ${path}: ${guards.pageErrors.join(' | ')}`).toEqual(
    [],
  )
  expect(
    guards.serverErrors,
    `document 5xx on ${path}: ${guards.serverErrors.join(' | ')}`,
  ).toEqual([])
}

export function assertOkResponse(path: string, response: Response | null) {
  expect(response, `no response for ${path}`).not.toBeNull()
  expect(response!.status(), `unexpected status for ${path}`).toBeLessThan(500)
}

/** Verified members must never land on the restricted modal query. */
export function assertNotGenderRestricted(page: Page) {
  expect(page.url()).not.toMatch(/gender=restricted/)
}

export async function assertBodyNotBlank(page: Page) {
  await expect(page.locator('body')).toBeAttached()
  const text = (await page.locator('body').innerText()).trim()
  expect(text.length, 'body rendered blank').toBeGreaterThan(0)
}

/** Tamagui press — more reliable than Playwright click under load. */
export async function dispatchDomClick(locator: ReturnType<Page['locator']>) {
  await locator.evaluate((el) => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}
