import { existsSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

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

/**
 * One emits one serverless function per `+ssr` route, each a full copy of the
 * same server bundle that differs only in `routeFile` / `routePattern`. The
 * Hobby plan rejects deployments with more than 12 functions, so fold every SSR
 * route into `index.func` and rewrite their routes to `/?__ssr_route=<path>`.
 */
const ROUTE_FILE_RE = /^ {2}const routeFile = "([^"]+)"$/m
const ROUTE_PATTERN_RE = /^ {4}const routePattern = "([^"]+)";$/m

function selectSsrRoute(url, ssrRoutes, defaultRouteFile, defaultRoutePattern) {
  const requested = url.searchParams.get('__ssr_route')
  url.searchParams.delete('__ssr_route')
  const explicit = requested && ssrRoutes.find((route) => route.path === requested)
  if (explicit) return { ...explicit, explicit: true }
  const matched = ssrRoutes.find((route) => new RegExp(route.regexSource).test(url.pathname))
  if (matched) return { ...matched, explicit: false }
  return { routeFile: defaultRouteFile, routePattern: defaultRoutePattern, explicit: false }
}

function ssrPathFromRoute(path, params) {
  return path.replace(/:(\w+)/g, (_, name) => [].concat(params[name] ?? []).join('/'))
}

function consolidateSsrFunctions() {
  const outputDir = resolve(process.cwd(), '.vercel/output')
  const functionsDir = join(outputDir, 'functions')
  const hostEntry = join(functionsDir, 'index.func/entrypoint/index.js')
  const configPath = join(outputDir, 'config.json')
  if (!existsSync(hostEntry) || !existsSync(configPath)) return

  const hostSource = readFileSync(hostEntry, 'utf8')
  if (!ROUTE_FILE_RE.test(hostSource) || !ROUTE_PATTERN_RE.test(hostSource)) {
    console.log('[patch-vercel-output] SSR functions already consolidated')
    return
  }
  const normalize = (source) =>
    source.replace(ROUTE_FILE_RE, '').replace(ROUTE_PATTERN_RE, '')
  const hostBody = normalize(hostSource)

  const routes = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const full = join(dir, entry.name)
      if (!entry.name.endsWith('.func')) {
        walk(full)
        continue
      }
      const entryPath = join(full, 'entrypoint/index.js')
      if (full === dirname(dirname(hostEntry)) || !existsSync(entryPath)) continue
      const source = readFileSync(entryPath, 'utf8')
      const routeFile = source.match(ROUTE_FILE_RE)?.[1]
      const routePattern = source.match(ROUTE_PATTERN_RE)?.[1]
      if (!routeFile || !routePattern) continue
      if (normalize(source) !== hostBody) {
        throw new Error(`[patch-vercel-output] ${relative(functionsDir, full)} differs from index.func; cannot consolidate`)
      }
      routes.push({ dir: full, path: `/${relative(functionsDir, full).replace(/\.func$/, '')}`, routeFile, routePattern })
    }
  }
  walk(functionsDir)
  if (routes.length === 0) return

  const table = routes.map(({ path, routeFile, routePattern }) => ({
    path,
    routeFile,
    routePattern,
    regexSource: `^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:\w+/g, '([^/]+)')}/?$`,
  }))
  const merged = hostSource
    .replace(
      ROUTE_FILE_RE,
      () => `  const defaultRouteFile = ${JSON.stringify(hostSource.match(ROUTE_FILE_RE)[1])}
  const defaultRoutePattern = ${JSON.stringify(hostSource.match(ROUTE_PATTERN_RE)[1])}
  const ssrRoutes = ${JSON.stringify(table)}
  ${selectSsrRoute.toString()}
  ${ssrPathFromRoute.toString()}`,
    )
    .replace(
      ROUTE_PATTERN_RE,
      `    const selected = selectSsrRoute(url, ssrRoutes, defaultRouteFile, defaultRoutePattern)
    const routeFile = selected.routeFile
    const routePattern = selected.routePattern;`,
    )
    .replace(
      '    const host = url.hostname;',
      `    if (selected.explicit) originalPath = ssrPathFromRoute(selected.path, routeParams);
    const host = url.hostname;`,
    )
  if (!merged.includes('selected.explicit) originalPath')) {
    throw new Error('[patch-vercel-output] SSR entrypoint shape changed; cannot consolidate')
  }
  writeFileSync(hostEntry, merged)

  const ssrPaths = new Set(routes.map((route) => route.path))
  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  let rewritten = 0
  config.routes = (config.routes ?? []).map((route) => {
    if (typeof route.dest !== 'string') return route
    const [destPath, query] = route.dest.split(/\?(.*)/s)
    if (!ssrPaths.has(destPath)) return route
    rewritten += 1
    const ssrQuery = `__ssr_route=${encodeURIComponent(destPath)}`
    return { ...route, dest: `/?${ssrQuery}${query ? `&${query}` : ''}` }
  })
  writeFileSync(configPath, `${JSON.stringify(config)}\n`)

  for (const { dir } of routes) {
    rmSync(dir, { recursive: true, force: true })
    let parent = dirname(dir)
    while (parent !== functionsDir && readdirSync(parent).length === 0) {
      rmdirSync(parent)
      parent = dirname(parent)
    }
  }
  console.log(
    `[patch-vercel-output] consolidated ${routes.length} SSR functions into index.func (${rewritten} routes rewritten)`,
  )
}

patchVercelOutputConfig()
consolidateSsrFunctions()
patchWellKnownHeaders()
patchInstantNavInRouterBundles()
patchFunctionRuntimes()
patchSsrCacheHeaders()
