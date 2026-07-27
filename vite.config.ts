import { fileURLToPath } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import { one } from 'one/vite'
import { tamaguiPlugin } from '@tamagui/vite-plugin'

import { APP_SCHEME, DEFAULT_APP_ORIGIN } from './config/app-origin'
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from './config/supabase-public'

const fromProjectRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url).toString())

/** Drop Tamagui vite-plugin global caches so config HMR cannot serve stale *.tamagui.css imports. */
function clearTamaguiViteCaches() {
  const g = globalThis as Record<string, unknown>
  delete g.__tamagui_vite_cache__
  delete g.__tamagui_vite_cache_size__
  delete g.__tamagui_vite_pending__
}

/** Vite loadEnv only reads .env files; merge CI/Vercel process.env for EXPO_PUBLIC_* keys. */
function loadProjectEnv(mode: string) {
  const fromFiles = loadEnv(mode, process.cwd(), '')
  const keys = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_WEB_APP_URL',
    'EXPO_PUBLIC_ONESIGNAL_APP_ID',
    'ONE_SERVER_URL',
    'ONE_CACHE_KEY',
  ] as const

  const env = { ...fromFiles }
  for (const key of keys) {
    if (!env[key] && process.env[key]) {
      env[key] = process.env[key]!
    }
  }
  return env
}

export default defineConfig(({ mode }) => {
  clearTamaguiViteCaches()
  const env = loadProjectEnv(mode)
  const appOrigin = (env.EXPO_PUBLIC_WEB_APP_URL || env.ONE_SERVER_URL || DEFAULT_APP_ORIGIN).replace(
    /\/$/,
    '',
  )
  const useSyncExternalStoreWithSelector = fromProjectRoot(
    './lib/stubs/use-sync-external-store-with-selector.ts',
  )

  return {
    server: {
      port: 8081,
      strictPort: false,
      ws: {
        path: '/__vxrnhmr',
      },
      watch: {
        ignored: ['**/.vercel/**', '**/dist/**'],
      },
    },

    resolve: {
      // Prevent nested @tamagui/* copies (e.g. lucide-icons → core → web) from
      // splitting React context — production error surfaces as "Missing theme.".
      dedupe: [
        'tamagui',
        '@tamagui/core',
        '@tamagui/web',
        '@tamagui/config',
        '@tamagui/lucide-icons',
        'react',
        'react-native',
      ],
      alias: {
        'expo-av': fromProjectRoot('./lib/stubs/expo-av.ts'),
        'expo-audio': fromProjectRoot('./lib/stubs/expo-audio.ts'),
        'expo-video': fromProjectRoot('./lib/stubs/expo-video.ts'),
        'expo-sharing': fromProjectRoot('./lib/stubs/expo-sharing.ts'),
        'expo-camera': fromProjectRoot('./lib/stubs/expo-camera.ts'),
        // Location: use ~/lib/location/expo-location-module(.native) — do not
        // alias expo-location globally or native GPS is stubbed to denied.
        'expo-clipboard': fromProjectRoot('./lib/stubs/expo-clipboard.ts'),
        'expo-file-system/legacy': fromProjectRoot('./lib/stubs/expo-file-system-legacy.ts'),
        'expo-localization': fromProjectRoot('./lib/stubs/expo-localization.ts'),
        // Published `@expo/log-box/utils.js` is CJS; Vite SSR eval throws `module is not defined`.
        '@expo/log-box/utils': fromProjectRoot('./lib/stubs/expo-log-box-utils.ts'),
        '@expo/log-box/utils.js': fromProjectRoot('./lib/stubs/expo-log-box-utils.ts'),
        '@react-native-community/datetimepicker': fromProjectRoot('./lib/stubs/datetimepicker.ts'),
        '@react-native-voice/voice': fromProjectRoot('./lib/stubs/react-native-voice.ts'),
        'expo-print': fromProjectRoot('./lib/stubs/expo-print.ts'),
        '@livekit/react-native': fromProjectRoot('./lib/stubs/livekit-react-native.ts'),
        '@livekit/react-native-webrtc': fromProjectRoot('./lib/stubs/react-native-webrtc.ts'),
        'react-native-webrtc': fromProjectRoot('./lib/stubs/react-native-webrtc.ts'),
        'react-native-webview': fromProjectRoot('./lib/stubs/react-native-webview.ts'),
        // Published package ships JSX in `.js`; Rolldown parse fails during web build.
        'react-native-qrcode-svg': fromProjectRoot('./lib/stubs/react-native-qrcode-svg.tsx'),
        // LiveKit/debug leave Node built-ins external; Hermes has no require.
        tty: fromProjectRoot('./lib/stubs/node-empty.ts'),
        'node:tty': fromProjectRoot('./lib/stubs/node-empty.ts'),
        util: fromProjectRoot('./lib/stubs/node-util.ts'),
        'node:util': fromProjectRoot('./lib/stubs/node-util.ts'),
        net: fromProjectRoot('./lib/stubs/node-empty.ts'),
        'node:net': fromProjectRoot('./lib/stubs/node-empty.ts'),
        dns: fromProjectRoot('./lib/stubs/node-empty.ts'),
        'node:dns': fromProjectRoot('./lib/stubs/node-empty.ts'),
        'use-sync-external-store/with-selector': useSyncExternalStoreWithSelector,
        'use-sync-external-store/with-selector.js': useSyncExternalStoreWithSelector,
        // Package "main" is Node (needs tfjs-node); force browser ESM for web/SSR.
        '@vladmandic/human': fromProjectRoot(
          './node_modules/@vladmandic/human/dist/human.esm.js',
        ),
        tamagui: fromProjectRoot('./node_modules/tamagui'),
        '@tamagui/web': fromProjectRoot('./node_modules/@tamagui/web'),
        '@tamagui/core': fromProjectRoot('./node_modules/@tamagui/core'),
      },
    },

    plugins: [
      {
        name: 'sheconomy-stub-rolldown-node-require',
        // LiveKit WebRTC nests `debug`, whose Node entry does require('tty').
        // Hermes has no Node require — force the browser build of `debug`.
        transform(code, id) {
          const normalized = id.replace(/\\/g, '/')
          if (
            normalized.includes('/debug/src/index.js') ||
            normalized.includes('/debug/src/index.mjs') ||
            /\/debug\/src\/index\.[cm]?js$/.test(normalized)
          ) {
            if (code.includes('sheconomy-force-debug-browser')) return null
            return {
              code: `// sheconomy-force-debug-browser
module.exports = require('./browser.js');
`,
              map: null,
            }
          }
          if (normalized.includes('/debug/src/node.js') || /\/debug\/src\/node\.[cm]?js$/.test(normalized)) {
            if (code.includes('sheconomy-force-debug-browser')) return null
            return {
              code: `// sheconomy-force-debug-browser
module.exports = require('./browser.js');
`,
              map: null,
            }
          }
          return null
        },
        renderChunk(code) {
          const marker = 'Calling `require` for "'
          if (!code.includes(marker) && !code.includes('__require("tty")') && !code.includes("__require('tty')")) {
            return null
          }
          let next = code
          if (next.includes(marker) && !next.includes('sheconomy-stub-node-builtins-v3')) {
            const utilStub =
              '{inspect:function(v){try{return typeof v==="string"?v:JSON.stringify(v)}catch(e){return String(v)}},format:function(){return Array.prototype.slice.call(arguments).join(" ")},promisify:function(fn){return fn},inherits:function(){},deprecate:function(fn){return fn},types:{}}'
            const throwExact = `throw Error("Calling \`require\` for \\"" + x + "\\" in an environment that doesn't expose the \`require\` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.");`
            const throwStub = `var __n=String(x||""); if (__n==="util"||__n==="node:util") return ${utilStub}; // sheconomy-stub-node-builtins-v3
	if (__n==="tty"||__n==="node:tty"||__n==="net"||__n==="node:net"||__n==="dns"||__n==="node:dns"||__n==="fs"||__n==="node:fs"||__n==="os"||__n==="node:os"||__n==="path"||__n==="node:path"||__n==="stream"||__n==="node:stream"||__n==="events"||__n==="node:events"||__n==="assert"||__n==="url"||__n==="buffer"||__n==="crypto"||__n==="http"||__n==="https"||__n.indexOf("node:")===0) return {};
	${throwExact}`
            next = next.split(throwExact).join(throwStub)
          }
          next = next
            .replace(/__require\(["']tty["']\)/g, '({})')
            .replace(/__require\(["']node:tty["']\)/g, '({})')
            .replace(/__require\(["']util["']\)/g, '({inspect:String,format:String,promisify:function(fn){return fn},types:{}})')
            .replace(/__require\(["']node:util["']\)/g, '({inspect:String,format:String,promisify:function(fn){return fn},types:{}})')
            .replace(/__require\(["']net["']\)/g, '({})')
            .replace(/__require\(["']node:net["']\)/g, '({})')
            .replace(/__require\(["']dns["']\)/g, '({})')
            .replace(/__require\(["']node:dns["']\)/g, '({})')
          return next === code ? null : { code: next, map: null }
        },
      },
      one({
        setupFile: {
          native: './lib/polyfills.ts',
        },

        router: {
          linking: {
            scheme: APP_SCHEME,
            prefixes: [`${APP_SCHEME}://`, appOrigin],
          },
        },

        native: {
          // Vite is One's native release bundler (wired via react-native.config.cjs).
          bundler: 'vite',
          // IMPORTANT: `true` wraps every screen in <Suspense fallback={null}>, so
          // navigating to listing/PDP shows a blank white screen until the async
          // route import resolves — on device that can take minutes for heavy
          // screens. Release Hermes bytecode fits; keep routes sync for instant paint.
          suspendRoutes: false,
        },

        web: {
          // SPA soft client navigation — avoid SSG full document loads on route changes.
          defaultRenderMode: 'spa',
          skewProtection: false,
          deploy: 'vercel',
          redirects: [
            { source: '/auth/sign-up', destination: '/auth/sign-in', permanent: true },
            { source: '/auth/sign-up/', destination: '/auth/sign-in', permanent: true },
            { source: '/commerce/', destination: '/', permanent: true },
            { source: '/commerce/categories/:slug', destination: '/category/:slug', permanent: true },
            { source: '/commerce/listings/:slug', destination: '/listing/:slug', permanent: true },
            { source: '/commerce/shops/:slug', destination: '/shop/:slug', permanent: true },
            { source: '/commerce/:path*', destination: '/:path*', permanent: true },
            { source: '/listings/:slug', destination: '/listing/:slug', permanent: true },
            { source: '/shops/:slug', destination: '/shop/:slug', permanent: true },
            { source: '/tabs', destination: '/', permanent: true },
            { source: '/tabs/', destination: '/', permanent: true },
            { source: '/tabs/shops', destination: '/vendor/myshop', permanent: true },
            { source: '/my-shops', destination: '/vendor/myshop', permanent: true },
            { source: '/my-shops/:path*', destination: '/vendor/myshop', permanent: true },
            { source: '/tabs/profile', destination: '/profile', permanent: true },
            { source: '/tabs/settings', destination: '/settings', permanent: true },
            { source: '/tabs/ui-kit', destination: '/ui-kit', permanent: true },
            { source: '/community/notifications', destination: '/notifications', permanent: true },
            { source: '/community/profile', destination: '/profile', permanent: true },
            { source: '/community/settings', destination: '/settings', permanent: true },
            { source: '/community/chat', destination: '/chat', permanent: true },
            { source: '/community/chat/:path*', destination: '/chat', permanent: true },
            { source: '/radio', destination: '/class', permanent: true },
            { source: '/radio/:path*', destination: '/class/:path*', permanent: true },
            { source: '/classes', destination: '/class', permanent: true },
            { source: '/classes/:path*', destination: '/class/:path*', permanent: true },
            { source: '/community/radio', destination: '/class', permanent: true },
            { source: '/community/class', destination: '/class', permanent: true },
            { source: '/community/class/:path*', destination: '/class/:path*', permanent: true },
            { source: '/community/co-work', destination: '/co-work', permanent: true },
          ],
        },

        build: {
          server: { unified: true },
        },

        // Rolldown dev bundle runs whatwg-fetch init before Request/Response exist;
        // defer Body.call to end of fetch.js (see patch below).
        patches: {
          '@expo/log-box': {
            // Root entry is pure CJS (`module.exports = require(...)`) and crashes Vite SSR.
            'utils.js': (contents) => {
              if (!contents || contents.includes('sheconomy-esm-log-box-utils')) return
              return `// sheconomy-esm-log-box-utils
export function withoutANSIColorStyles(message) {
  if (typeof message !== 'string') return message
  return message.replace(/[\\u001b\\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
}
export function parseWebBuildErrors(input) {
  return input
}
`
            },
          },
          vxrn: {
            'dist/config/getViteServerConfig.mjs': (contents) => {
              if (!contents || contents.includes('sheconomy-vite-ws')) return
              return contents.replace(
                /hmr:\s*\{\s*path:\s*"\/__vxrnhmr"\s*\},/,
                'ws: { path: "/__vxrnhmr" }, // sheconomy-vite-ws',
              )
            },
            'dist/config/getViteServerConfig.native.js': (contents) => {
              if (!contents || contents.includes('sheconomy-vite-ws')) return
              return contents.replace(
                /hmr:\s*\{\s*path:\s*"\/__vxrnhmr"\s*\},/,
                'ws: { path: "/__vxrnhmr" }, // sheconomy-vite-ws',
              )
            },
          },
          '@expo/cli': {
            'build/src/start/server/metro/withMetroMultiPlatform.js': (contents) => {
              if (!contents) return

              let next = contents

              if (!next.includes('sheconomy-safe-require-external')) {
                next = next.replace(
                  "return 'try { global.$$require_external = typeof expo === \"undefined\" ? require : (moduleId) => { throw new Error(`Node.js standard library module ${moduleId} is not available in this JavaScript environment`);} } catch { global.$$require_external = (moduleId) => { throw new Error(`Node.js standard library module ${moduleId} is not available in this JavaScript environment`);} }';",
                  `return 'try { global.$$require_external = (typeof require !== "undefined") ? (m) => require(m) : (moduleId) => { throw new Error(\\\`Node.js standard library module \\\${moduleId} is not available in this JavaScript environment\\\`); }; } catch { global.$$require_external = (moduleId) => { throw new Error(\\\`Node.js standard library module \\\${moduleId} is not available in this JavaScript environment\\\`); }; } // sheconomy-safe-require-external';`,
                )
              } else if (next.includes('global.$require_external')) {
                next = next.replace(/global\.\$require_external/g, 'global.$$require_external')
              }

              if (!next.includes('sheconomy-skip-streams-native')) {
                next = next.replace(
                  `            // Removed on server platforms during the transform.
            require.resolve('expo/virtual/streams.js')`,
                  `            ...(ctx.platform === 'ios' || ctx.platform === 'android'
                ? []
                : [require.resolve('expo/virtual/streams.js')]), // sheconomy-skip-streams-native`,
                )
              }

              if (next.includes('sheconomy-early-native-polyfills')) {
                next = next.replace(
                  `        const sheconomyEarlyNativePolyfills =
            ctx.platform === 'ios' || ctx.platform === 'android'
                ? [require('path').join(process.cwd(), 'lib/polyfills-globals.native.cjs')]
                : [];
        return [
            ...sheconomyEarlyNativePolyfills, // sheconomy-early-native-polyfills
            ...polyfills,`,
                  `        return [
            ...polyfills,`,
                )
              }

              return next === contents ? undefined : next
            },
          },
          one: {
            'dist/cjs/babel-plugins/one-router-metro.cjs': (contents) => {
              if (!contents || contents.includes('sheconomy-setup-first')) return
              return contents.replace(
                `          if (lastImportIndex >= 0) {
            body[lastImportIndex].insertAfter(importDeclaration);
          } else {
            path.unshiftContainer("body", importDeclaration);
          }`,
                `          path.unshiftContainer("body", importDeclaration); // sheconomy-setup-first: polyfills before \`one\``,
              )
            },
            // Never hard-reload the SPA shell when One marks a deploy "stale".
            // Also never block tab/link navigation on cold preload waterfalls (100+ modules).
            // NOTE: vxrn skips re-patch when file mtime matches stats — build sets VXRN_FORCE_PATCH=1.
            'dist/esm/router/router.mjs': (contents) => {
              if (!contents) return
              let next = contents
              if (!next.includes('sheconomy-spa-no-hard-reload')) {
                next = next.replace(
                  /if \(isVersionStale\(\)\) \{\s*window\.location\.href = href;\s*return;\s*\}/,
                  `// sheconomy-spa-no-hard-reload: keep soft client navigation
  if (false && isVersionStale()) {
    window.location.href = href;
    return;
  }`,
                )
              }
              if (!next.includes('sheconomy-nav-instant')) {
                next = next.replace(
                  /if \(\!\(normalizedPreloadPath in preloadedLoaderData\) && \!\(href in preloadedLoaderData\)\) await preloadRoute\(href, true\);/,
                  `// sheconomy-nav-instant: do not await cold preload (was 5–10s per tab)
if (!(normalizedPreloadPath in preloadedLoaderData) && !(href in preloadedLoaderData)) void preloadRoute(href, true);`,
                )
              }
              return next === contents ? undefined : next
            },
            'dist/esm/router/useScreens.native.js': (contents) => {
              if (!contents) return
              // Routes are async Promise factories — Suspense is required. Never use
              // fallback:null (blank screen) while a heavy route chunk inits.
              if (contents.includes('sheconomy-brand-suspense')) return
              const branded = `var wrapSuspense = function (children) {
    // sheconomy-brand-suspense: brand-tinted loading while async route modules resolve
    var RN = require("react-native");
    return /* @__PURE__ */jsx(Suspense, {
      fallback: /* @__PURE__ */jsx(RN.View, {
        style: {
          flex: 1,
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#D81B60",
          padding: 24
        },
        children: /* @__PURE__ */jsx(RN.Text, {
          style: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", textAlign: "center" },
          children: "Starting…"
        })
      }),
      children
    });
  };`
              if (contents.includes('sheconomy-visible-suspense') || contents.includes('wrapSuspense = function')) {
                return contents.replace(
                  /var wrapSuspense = function \(children\) \{[\s\S]*?\n  \};/,
                  branded,
                )
              }
              return contents
            },
            'dist/cjs/router/useScreens.native.js': (contents) => {
              if (!contents) return
              if (contents.includes('sheconomy-brand-suspense')) return
              const branded = `var wrapSuspense = function (children) {
    // sheconomy-brand-suspense: brand-tinted loading while async route modules resolve
    var RN = require("react-native");
    return /* @__PURE__ */(0, import_jsx_runtime.jsx)(import_react2.Suspense, {
      fallback: /* @__PURE__ */(0, import_jsx_runtime.jsx)(RN.View, {
        style: {
          flex: 1,
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#D81B60",
          padding: 24
        },
        children: /* @__PURE__ */(0, import_jsx_runtime.jsx)(RN.Text, {
          style: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", textAlign: "center" },
          children: "Starting…"
        })
      }),
      children
    });
  };`
              if (contents.includes('sheconomy-visible-suspense') || contents.includes('wrapSuspense = function')) {
                return contents.replace(
                  /var wrapSuspense = function \(children\) \{[\s\S]*?\n  \};/,
                  branded,
                )
              }
              return contents
            },
            'dist/esm/router/router.native.js': (contents) => {
              if (!contents || contents.includes('sheconomy-nav-instant')) return
              return contents.replace(
                /if \(\!\(normalizedPreloadPath in preloadedLoaderData\) && \!\(href in preloadedLoaderData\)\) await preloadRoute\(href, true\);/,
                `// sheconomy-nav-instant: do not await cold preload (was 5–10s per tab)
if (!(normalizedPreloadPath in preloadedLoaderData) && !(href in preloadedLoaderData)) void preloadRoute(href, true);`,
              )
            },
            'dist/cjs/router/router.cjs': (contents) => {
              if (!contents) return
              let next = contents
              if (!next.includes('sheconomy-spa-no-hard-reload')) {
                next = next.replace(
                  /if \(\(0, import_skewProtection\.isVersionStale\)\(\)\) \{\s*window\.location\.href = href;\s*return;\s*\}/,
                  `// sheconomy-spa-no-hard-reload: keep soft client navigation
  if (false && (0, import_skewProtection.isVersionStale)()) {
    window.location.href = href;
    return;
  }`,
                )
              }
              if (!next.includes('sheconomy-nav-instant')) {
                next = next.replace(
                  /if \(\!\(normalizedPreloadPath in preloadedLoaderData\) && \!\(href in preloadedLoaderData\)\) await preloadRoute\(href, true\);/,
                  `// sheconomy-nav-instant: do not await cold preload (was 5–10s per tab)
if (!(normalizedPreloadPath in preloadedLoaderData) && !(href in preloadedLoaderData)) void preloadRoute(href, true);`,
                )
              }
              return next === contents ? undefined : next
            },
            'dist/cjs/router/router.native.js': (contents) => {
              if (!contents || contents.includes('sheconomy-nav-instant')) return
              return contents.replace(
                /if \(\!\(normalizedPreloadPath in preloadedLoaderData\) && \!\(href in preloadedLoaderData\)\) await preloadRoute\(href, true\);/,
                `// sheconomy-nav-instant: do not await cold preload (was 5–10s per tab)
if (!(normalizedPreloadPath in preloadedLoaderData) && !(href in preloadedLoaderData)) void preloadRoute(href, true);`,
              )
            },
          },
          'whatwg-fetch': {
            'fetch.js': (contents) => {
              if (!contents) return
              let next = contents
              if (!next.includes('sheconomy-defer-body-call')) {
                next = next.replace(
                  '\nBody.call(Request.prototype)\n\nexport function Response',
                  '\nexport function Response',
                )
                next = next.replace(
                  '\nBody.call(Response.prototype)\n\nResponse.prototype.clone',
                  '\nResponse.prototype.clone',
                )
                next = next.replace(
                  'fetch.polyfill = true',
                  [
                    '// sheconomy-defer-body-call',
                    'Body.call(Request.prototype)',
                    'Body.call(Response.prototype)',
                    '',
                    'fetch.polyfill = true',
                  ].join('\n'),
                )
              }
              if (!next.includes('sheconomy-install-missing-fetch-globals')) {
                next = next.replace(
                  `if (!g.fetch) {
  g.fetch = fetch
  g.Headers = Headers
  g.Request = Request
  g.Response = Response
}`,
                  `// sheconomy-install-missing-fetch-globals
if (!g.fetch) {
  g.fetch = fetch
}
if (typeof g.Headers !== 'function') {
  g.Headers = Headers
}
if (typeof g.Request !== 'function') {
  g.Request = Request
}
if (typeof g.Response !== 'function') {
  g.Response = Response
}`,
                )
              }
              return next === contents ? undefined : next
            },
          },
        },
      }),

      tamaguiPlugin({
        components: ['tamagui'],
        config: './config/tamagui.config.ts',
        // Dev: skip CSS extraction. After vite.config HMR, Tamagui's global JS cache can
        // re-emit `*.tamagui.css` imports while the per-instance cssMap is empty → Vite
        // "Failed to resolve import …Avatar.tsx.tamagui.css". Production still extracts.
        disableExtraction: mode === 'development',
      }),
    ],

    define: {
      // One's native.suspendRoutes:false should set this, but the Release Hermes
      // bundle was still evaluating `process.env.ONE_SUSPEND_ROUTES_NATIVE === "0"`
      // at runtime (undefined) → every screen wrapped in <Suspense fallback={null}>.
      // Instant meeting then painted a blank chromeless viewport while LiveKit inits.
      'process.env.ONE_SUSPEND_ROUTES_NATIVE': JSON.stringify('0'),
      'process.env.ONE_SUSPEND_ROUTES': JSON.stringify('0'),
      'import.meta.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify(
        env.EXPO_PUBLIC_SUPABASE_URL?.trim() || PUBLIC_SUPABASE_URL,
      ),
      'import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(
        env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || PUBLIC_SUPABASE_ANON_KEY,
      ),
      'import.meta.env.EXPO_PUBLIC_WEB_APP_URL': JSON.stringify(
        env.EXPO_PUBLIC_WEB_APP_URL ?? env.ONE_SERVER_URL ?? DEFAULT_APP_ORIGIN,
      ),
      'import.meta.env.ONE_SERVER_URL': JSON.stringify(
        env.ONE_SERVER_URL ?? env.EXPO_PUBLIC_WEB_APP_URL ?? DEFAULT_APP_ORIGIN,
      ),
      'process.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify(
        env.EXPO_PUBLIC_SUPABASE_URL?.trim() || PUBLIC_SUPABASE_URL,
      ),
      'process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(
        env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || PUBLIC_SUPABASE_ANON_KEY,
      ),
      'process.env.EXPO_PUBLIC_WEB_APP_URL': JSON.stringify(
        env.EXPO_PUBLIC_WEB_APP_URL ?? env.ONE_SERVER_URL ?? DEFAULT_APP_ORIGIN,
      ),
      'import.meta.env.EXPO_PUBLIC_ONESIGNAL_APP_ID': JSON.stringify(
        env.EXPO_PUBLIC_ONESIGNAL_APP_ID?.trim() || '',
      ),
      'process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID': JSON.stringify(
        env.EXPO_PUBLIC_ONESIGNAL_APP_ID?.trim() || '',
      ),
      'process.env.ONE_SERVER_URL': JSON.stringify(
        env.ONE_SERVER_URL ?? env.EXPO_PUBLIC_WEB_APP_URL ?? DEFAULT_APP_ORIGIN,
      ),
      'process.env.ONE_CACHE_KEY': JSON.stringify(env.ONE_CACHE_KEY?.trim() || '202607151'),
      'import.meta.env.ONE_CACHE_KEY': JSON.stringify(env.ONE_CACHE_KEY?.trim() || '202607151'),
    },

    ssr: {
      noExternal: true,
    },

    optimizeDeps: {
      exclude: [
        '@react-native-community/datetimepicker',
        '@livekit/react-native',
        '@livekit/react-native-webrtc',
        'expo-camera',
        'expo-location',
        'expo-audio',
        'expo-video',
        'react-native-webview',
        'react-native-qrcode-svg',
      ],
      include: [
        '@tamagui/config',
        'tamagui',
        'date-fns',
        '@tensorflow/tfjs',
        '@tensorflow/tfjs-backend-webgl',
        '@tensorflow-models/face-landmarks-detection',
        '@vladmandic/face-api',
        '@vladmandic/human',
      ],
    },

    build: {
      cssTarget: 'safari15',
    },
  }
})
