import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * One writes a catch-all rewrite that turns missing `/assets/*` into HTML.
 * Soft SPA nav then imports `*_vxrn_loader.js` / `*_preload.js`, gets
 * `text/html`, and the screen blanks. Prefer filesystem assets first, and
 * never SPA-fallback `/assets/*`.
 */
function patchVercelOutputConfig() {
  const configPath = resolve(process.cwd(), '.vercel/output/config.json')
  if (!existsSync(configPath)) {
    console.warn('[patch-vercel-output] no .vercel/output/config.json — skip')
    return
  }

  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  const routes = Array.isArray(config.routes) ? [...config.routes] : []

  const withoutHandles = routes.filter((route) => !('handle' in route))
  const patched = withoutHandles.map((route) => {
    const src = typeof route.src === 'string' ? route.src : ''
    if (!src.includes('?<notfound>') && !src.includes('notfound=')) return route
    return {
      ...route,
      // Never soft-404 asset chunks — browsers must not receive HTML for module scripts.
      src: '^/(?!assets(?:/|$))(?<notfound>.+?)(?:/)?$',
    }
  })

  config.routes = [{ handle: 'filesystem' }, { handle: 'rewrite' }, ...patched]

  writeFileSync(configPath, `${JSON.stringify(config)}\n`)
  console.log('[patch-vercel-output] patched routes for /assets + filesystem handle')
}

patchVercelOutputConfig()
