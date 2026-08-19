import fs from 'node:fs'

import { defineConfig, devices } from '@playwright/test'

import { authStatePath, hasSmokeTier, type SmokeTier } from './tests/smoke/auth-env'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081'

function tierProject(tier: SmokeTier, testMatch: RegExp) {
  const stateFile = authStatePath(tier)
  const ready = hasSmokeTier(tier) && fs.existsSync(stateFile)
  return {
    name: `${tier}-chromium`,
    testMatch,
    dependencies: ['setup-auth'],
    use: {
      ...devices['Desktop Chrome'],
      // When tokens are missing, setup skips writing the file — fall back to
      // empty state so the project still loads, and specs call test.skip.
      storageState: ready ? stateFile : undefined,
    },
  }
}

export default defineConfig({
  testDir: 'tests/smoke',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'NODE_OPTIONS=--max-old-space-size=8192 yarn dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
  projects: [
    {
      name: 'setup-auth',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'guest-chromium',
      testMatch: /routes\.spec\.ts|interactions\.spec\.ts|live-high-risk\.guest\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'guest-mobile',
      testMatch: /routes\.mobile\.spec\.ts|interactions\.mobile\.spec\.ts/,
      use: {
        // iPhone 13 device defaults to WebKit — keep the viewport/UA but stay on
        // Chromium so CI only needs one browser binary.
        ...devices['Desktop Chrome'],
        viewport: devices['iPhone 13'].viewport,
        userAgent: devices['iPhone 13'].userAgent,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: devices['iPhone 13'].deviceScaleFactor,
      },
    },
    tierProject('limited', /auth-limited\.spec\.ts/),
    tierProject('verified', /auth-verified\.spec\.ts/),
    tierProject('vendor', /auth-vendor\.spec\.ts/),
    // Admin is optional — same pattern, thin matrix.
    tierProject('admin', /auth-admin\.spec\.ts/),
  ],
})
