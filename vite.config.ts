import { defineConfig, loadEnv } from 'vite'
import { one } from 'one/vite'
import { tamaguiPlugin } from '@tamagui/vite-plugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    server: {
      port: 8081,
      strictPort: false,
    },

    plugins: [
      one({
        setupFile: {
          native: './lib/polyfills.native.ts',
        },

        web: {
          defaultRenderMode: 'ssg',
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
        env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      ),
      'import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(
        env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      ),
    },

    ssr: {
      noExternal: true,
    },

    optimizeDeps: {
      include: [
        '@tamagui/config',
        'tamagui',
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
