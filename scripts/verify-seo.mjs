/* One-off SEO verification: loads routes in headless Chromium and prints head tags. */
import { chromium } from '@playwright/test'

const BASE = process.env.SEO_BASE_URL || 'http://localhost:8081'
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/help', '/community', '/browse', '/cart', '/legal/privacy']

const browser = await chromium.launch()
const page = await browser.newPage()

for (const route of routes) {
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForTimeout(1500)
    const data = await page.evaluate(() => {
      const meta = (sel) => document.querySelector(sel)?.getAttribute('content') ?? null
      return {
        title: document.title,
        description: meta('meta[name="description"]'),
        ogTitle: meta('meta[property="og:title"]'),
        ogType: meta('meta[property="og:type"]'),
        ogUrl: meta('meta[property="og:url"]'),
        ogImage: meta('meta[property="og:image"]'),
        twitterCard: meta('meta[name="twitter:card"]'),
        robots: meta('meta[name="robots"]'),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
      }
    })
    console.log(`\n== ${route}`)
    for (const [k, v] of Object.entries(data)) console.log(`  ${k}: ${v}`)
  } catch (error) {
    console.log(`\n== ${route} FAILED: ${error.message.split('\n')[0]}`)
  }
}

await browser.close()
