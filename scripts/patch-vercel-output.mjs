import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

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

/**
 * Safety net: One's linkTo awaits cold `preloadRoute` (100+ modules → 5–10s
 * tab delay). Vite dep-patches can be skipped by vxrn stats cache; rewrite the
 * emitted router chunk so navigation never blocks on preload.
 */
function patchInstantNavInRouterBundles() {
  const assetDirs = [
    resolve(process.cwd(), '.vercel/output/static/assets'),
    resolve(process.cwd(), 'dist/client/assets'),
  ]

  // Minified: if(!(l in $)&&!(e in $))await em(e,!0)
  // Source-ish: await preloadRoute(href, true)
  const patterns = [
    [
      /if\(!\(([^)]+) in ([^)]+)\)&&!\(([^)]+) in \2\)\)await ([a-zA-Z_$][\w$]*)\(\3,!0\)/g,
      'if(!($1 in $2)&&!($3 in $2))void $4($3,!0)',
    ],
    [
      /if\(!\(([^)]+) in ([^)]+)\)&&!\(([^)]+) in \2\)\)await ([a-zA-Z_$][\w$]*)\(\3,\s*!0\)/g,
      'if(!($1 in $2)&&!($3 in $2))void $4($3,!0)',
    ],
    [/await preloadRoute\(([^,]+),\s*true\)/g, 'void preloadRoute($1, true)'],
  ]

  let filesPatched = 0
  for (const dir of assetDirs) {
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) {
      if (!/^router-.*\.js$/.test(name)) continue
      const path = join(dir, name)
      let source = readFileSync(path, 'utf8')
      const before = source
      for (const [re, replacement] of patterns) {
        source = source.replace(re, replacement)
      }
      if (source !== before) {
        writeFileSync(path, source)
        filesPatched += 1
        console.log(`[patch-vercel-output] instant-nav patched ${name}`)
      } else if (/\)await [a-zA-Z_$][\w$]*\([^)]*,!0\)/.test(source)) {
        console.warn(
          `[patch-vercel-output] ${name} still awaits preload — pattern miss`,
        )
      }
    }
  }

  if (filesPatched === 0) {
    console.log('[patch-vercel-output] instant-nav: no router await found (ok if already patched)')
  }
}

function patchWellKnownHeaders() {
  const configPath = resolve(process.cwd(), '.vercel/output/config.json')
  if (!existsSync(configPath)) return

  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  const routes = Array.isArray(config.routes) ? [...config.routes] : []

  const wellKnownHeaders = [
    {
      src: '/\\.well-known/apple-app-site-association',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
      continue: true,
    },
    {
      src: '/\\.well-known/assetlinks\\.json',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
      continue: true,
    },
  ]

  // Drop prior well-known header routes so re-runs stay idempotent.
  const withoutOld = routes.filter((route) => {
    const src = typeof route?.src === 'string' ? route.src : ''
    return !src.includes('.well-known/apple-app-site-association') && !src.includes('.well-known/assetlinks')
  })

  config.routes = [...wellKnownHeaders, ...withoutOld]
  writeFileSync(configPath, `${JSON.stringify(config)}\n`)
  console.log('[patch-vercel-output] well-known Content-Type headers applied')
}

/**
 * One's `vc-config-base` pins serverless functions to `nodejs20.x`, which
 * Vercel no longer deploys. Match `engines.node` (22.x) instead.
 */
function patchFunctionRuntimes() {
  const functionsDir = resolve(process.cwd(), '.vercel/output/functions')
  if (!existsSync(functionsDir)) return

  let patched = 0
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (entry.name !== '.vc-config.json') continue
      const config = JSON.parse(readFileSync(full, 'utf8'))
      if (typeof config.runtime !== 'string' || !/^nodejs(1\d|20)\.x$/.test(config.runtime)) continue
      config.runtime = 'nodejs22.x'
      writeFileSync(full, `${JSON.stringify(config, null, 2)}\n`)
      patched += 1
    }
  }
  walk(functionsDir)
  console.log(`[patch-vercel-output] function runtime set to nodejs22.x (${patched} functions)`)
}

/**
 * One's SSR entrypoint sends HTML with no Cache-Control and loader JS with
 * `no-store`, so every visit and crawler hit re-runs the function. That burns
 * Fluid Active CPU past the Hobby fair-use cap and gets the team paused.
 * SSR loaders only read route params (no cookies/session), so responses are
 * safe to share at the CDN. Browsers still revalidate on every navigation.
 */
const SSR_CDN_CACHE_CONTROL = 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400'

function patchSsrCacheHeaders() {
  const functionsDir = resolve(process.cwd(), '.vercel/output/functions')
  if (!existsSync(functionsDir)) return

  const header = `res.setHeader('Cache-Control', '${SSR_CDN_CACHE_CONTROL}')`
  let patched = 0
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (entry.name !== 'index.js' || !dir.endsWith('/entrypoint')) continue
      let source = readFileSync(full, 'utf8')
      if (!source.includes('entry.default.render') || source.includes(SSR_CDN_CACHE_CONTROL)) continue
      source = source
        .replace("res.setHeader('Cache-Control', 'no-store')", header)
        .replace(
          "res.setHeader('Content-Type', 'text/html; charset=utf-8')",
          `res.setHeader('Content-Type', 'text/html; charset=utf-8')\n    ${header}`,
        )
      writeFileSync(full, source)
      patched += 1
    }
  }
  walk(functionsDir)
  console.log(`[patch-vercel-output] SSR CDN cache headers applied (${patched} functions)`)
}

patchVercelOutputConfig()
patchWellKnownHeaders()
patchInstantNavInRouterBundles()
patchFunctionRuntimes()
patchSsrCacheHeaders()
