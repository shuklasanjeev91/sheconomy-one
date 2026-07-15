import { fileURLToPath } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import { one } from 'one/vite'
import { tamaguiPlugin } from '@tamagui/vite-plugin'

import { APP_SCHEME, DEFAULT_APP_ORIGIN } from './config/app-origin'
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from './config/supabase-public'

const fromProjectRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url).toString())

/** Vite loadEnv only reads .env files; merge CI/Vercel process.env for EXPO_PUBLIC_* keys. */
function loadProjectEnv(mode: string) {
  const fromFiles = loadEnv(mode, process.cwd(), '')
  const keys = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_WEB_APP_URL',
    'ONE_SERVER_URL',
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
      alias: {
        'expo-av': fromProjectRoot('./lib/stubs/expo-av.ts'),
        'expo-audio': fromProjectRoot('./lib/stubs/expo-audio.ts'),
        'expo-video': fromProjectRoot('./lib/stubs/expo-video.ts'),
        'expo-sharing': fromProjectRoot('./lib/stubs/expo-sharing.ts'),
        'expo-camera': fromProjectRoot('./lib/stubs/expo-camera.ts'),
        'expo-location': fromProjectRoot('./lib/stubs/expo-location.ts'),
        'expo-clipboard': fromProjectRoot('./lib/stubs/expo-clipboard.ts'),
        'expo-file-system/legacy': fromProjectRoot('./lib/stubs/expo-file-system-legacy.ts'),
        'expo-localization': fromProjectRoot('./lib/stubs/expo-localization.ts'),
        '@react-native-community/datetimepicker': fromProjectRoot('./lib/stubs/datetimepicker.ts'),
        '@livekit/react-native': fromProjectRoot('./lib/stubs/livekit-react-native.ts'),
        '@livekit/react-native-webrtc': fromProjectRoot('./lib/stubs/react-native-webrtc.ts'),
        'react-native-webrtc': fromProjectRoot('./lib/stubs/react-native-webrtc.ts'),
        'react-native-webview': fromProjectRoot('./lib/stubs/react-native-webview.ts'),
        'use-sync-external-store/with-selector': useSyncExternalStoreWithSelector,
        'use-sync-external-store/with-selector.js': useSyncExternalStoreWithSelector,
      },
    },

    plugins: [
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
          bundler: 'metro',
          suspendRoutes: false,
          bundlerOptions: {
            defaultConfigOverrides: (config) => {
              const { withoutExpoStreamsPolyfillOnNative } = require('./lib/metro-expo-polyfill-fix.cjs')
              return withoutExpoStreamsPolyfillOnNative(config)
            },
          },
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
            { source: '/tabs/shops', destination: '/my-shops', permanent: true },
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
            'dist/esm/router/router.mjs': (contents) => {
              if (!contents || contents.includes('sheconomy-spa-no-hard-reload')) return
              return contents.replace(
                `  if (isVersionStale()) {
    window.location.href = href;
    return;
  }`,
                `  // sheconomy-spa-no-hard-reload: keep soft client navigation
  if (false && isVersionStale()) {
    window.location.href = href;
    return;
  }`,
              )
            },
            'dist/cjs/router/router.cjs': (contents) => {
              if (!contents || contents.includes('sheconomy-spa-no-hard-reload')) return
              return contents.replace(
                `  if ((0, import_skewProtection.isVersionStale)()) {
    window.location.href = href;
    return;
  }`,
                `  // sheconomy-spa-no-hard-reload: keep soft client navigation
  if (false && (0, import_skewProtection.isVersionStale)()) {
    window.location.href = href;
    return;
  }`,
              )
            },
          },
          'whatwg-fetch': {
            'fetch.js': (contents) => {
              if (!contents || contents.includes('sheconomy-defer-body-call')) {
                return
              }
              let next = contents.replace(
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
              return next
            },
          },
        },
      }),

      tamaguiPlugin({
        components: ['tamagui'],
        config: './config/tamagui.config.ts',
        disableExtraction: true,
      }),
    ],

    define: {
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
      'process.env.ONE_SERVER_URL': JSON.stringify(
        env.ONE_SERVER_URL ?? env.EXPO_PUBLIC_WEB_APP_URL ?? DEFAULT_APP_ORIGIN,
      ),
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
      ],
      include: [
        '@tamagui/config',
        'tamagui',
        'date-fns',
        '@tensorflow/tfjs',
        '@tensorflow/tfjs-backend-webgl',
        '@tensorflow-models/face-landmarks-detection',
        '@vladmandic/face-api',
      ],
    },

    build: {
      cssTarget: 'safari15',
    },
  }
})
