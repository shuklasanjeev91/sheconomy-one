// you own this file. edit freely — `one` will not regenerate it.
// withOne() invokes the same Metro pipeline One uses for production bundles.

const path = require('path')
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const { withOne } = require('one/metro-config')
const { withoutExpoStreamsPolyfillOnNative } = require('./lib/metro-expo-polyfill-fix.cjs')

const projectRoot = __dirname
const nodeModules = path.join(projectRoot, 'node_modules')

const TAMAGUI_MODULES = [
  'tamagui',
  '@tamagui/core',
  '@tamagui/web',
  '@tamagui/constants',
  '@tamagui/helpers',
  '@tamagui/use-theme',
  '@tamagui/create-theme',
  '@tamagui/helpers-tamagui',
  '@tamagui/helpers-icon',
  '@tamagui/sizable-context',
  '@tamagui/lucide-icons',
  '@tamagui/toast',
  '@tamagui/stacks',
  '@tamagui/text',
  '@tamagui/theme',
]

function pinNodeModule(extraNodeModules, name) {
  try {
    extraNodeModules[name] = path.dirname(
      require.resolve(`${name}/package.json`, { paths: [projectRoot] }),
    )
  } catch {
    // optional package — skip
  }
}

const MEDIAPIPE_FACE_DETECTION_STUB = path.join(
  projectRoot,
  'lib/metro-stubs/mediapipe-face-detection.js',
)

function withTamaguiDedupe(config) {
  const extraNodeModules = { ...(config.resolver?.extraNodeModules ?? {}) }
  const nodeEmpty = path.join(projectRoot, 'lib/metro-stubs/node-empty.js')
  // Pin Node built-ins away from Hermes (qrcode / exceljs pull these in).
  for (const name of ['fs', 'graceful-fs', 'fs.realpath', 'fs-constants', 'fstream']) {
    extraNodeModules[name] = path.dirname(nodeEmpty)
  }
  // Package-style resolve: map module name → stub file via extraNodeModules needs a package.
  // Prefer resolveRequest stubs below; also alias via redirect.

  for (const name of TAMAGUI_MODULES) {
    pinNodeModule(extraNodeModules, name)
  }
  pinNodeModule(extraNodeModules, 'one')
  pinNodeModule(extraNodeModules, '@babel/runtime')

  const upstreamResolveRequest = config.resolver?.resolveRequest

  return {
    ...config,
    resolver: {
      ...config.resolver,
      extraNodeModules,
      nodeModulesPaths: [
        nodeModules,
        ...(config.resolver?.nodeModulesPaths ?? []).filter((p) => p !== nodeModules),
      ],
      resolveRequest(context, moduleName, platform) {
        // Node built-ins pulled in by `qrcode` / `exceljs` (via auth QR + bulk import).
        // Hermes has no `fs`; requiring it white-screens the native app.
        if (
          moduleName === 'fs' ||
          moduleName === 'node:fs' ||
          moduleName === 'graceful-fs' ||
          moduleName === 'fs.realpath' ||
          moduleName === 'fs-constants' ||
          moduleName === 'fstream'
        ) {
          return {
            type: 'sourceFile',
            filePath: path.join(projectRoot, 'lib/metro-stubs/node-empty.js'),
          }
        }

        // Peer of @tensorflow-models/face-detection; unused with tfjs runtime.
        if (moduleName === '@mediapipe/face_detection') {
          return { type: 'sourceFile', filePath: MEDIAPIPE_FACE_DETECTION_STUB }
        }

        // One CJS polyfills pull core-js URL; that breaks Hermes URL.protocol setters.
        if (
          moduleName === 'core-js/actual/url' ||
          moduleName === 'core-js/actual/url-search-params' ||
          moduleName === 'core-js/stable/url' ||
          moduleName === 'core-js/stable/url-search-params'
        ) {
          return {
            type: 'sourceFile',
            filePath: path.join(projectRoot, 'lib/metro-stubs/core-js-url.js'),
          }
        }

        // Hermes ships Request/fetch; avoid whatwg-fetch mismatch (white screen).
        if (
          typeof moduleName === 'string' &&
          (moduleName === 'react-native/Libraries/Core/setUpXHR' ||
            moduleName.endsWith('/Libraries/Core/setUpXHR') ||
            moduleName.endsWith('/Core/setUpXHR') ||
            moduleName === './setUpXHR' ||
            /(^|\/)setUpXHR(\.js)?$/.test(moduleName))
        ) {
          // Only rewrite RN core setUpXHR, not random files named similarly.
          const fromRnCore =
            typeof context.originModulePath === 'string' &&
            context.originModulePath.includes(`${path.sep}react-native${path.sep}`)
          if (fromRnCore || moduleName.includes('Libraries/Core/setUpXHR')) {
            return {
              type: 'sourceFile',
              filePath: path.join(projectRoot, 'lib/metro-stubs/setUpXHR.js'),
            }
          }
        }

        if (moduleName === 'one') {
          const nativeEntry = path.join(nodeModules, 'one/dist/esm/index.native.js')
          if (require('fs').existsSync(nativeEntry)) {
            return { type: 'sourceFile', filePath: nativeEntry }
          }
        }
        if (
          moduleName.startsWith('one/') ||
          moduleName === '@babel/runtime' ||
          moduleName.startsWith('@babel/runtime/')
        ) {
          try {
            const filePath = require.resolve(moduleName, { paths: [projectRoot] })
            return { type: 'sourceFile', filePath }
          } catch {
            // fall through
          }
        }

        if (moduleName === 'tamagui' || moduleName.startsWith('@tamagui/')) {
          try {
            return context.resolveRequest(
              {
                ...context,
                resolveRequest: null,
                originModulePath: path.join(projectRoot, 'index.js'),
                nodeModulesPaths: [nodeModules],
                disableHierarchicalLookup: true,
              },
              moduleName,
              platform,
            )
          } catch {
            // fall through
          }
        }

        if (upstreamResolveRequest) {
          try {
            return upstreamResolveRequest(context, moduleName, platform)
          } catch {
            // fall through to default / Node
          }
        }

        try {
          return context.resolveRequest(
            { ...context, resolveRequest: null },
            moduleName,
            platform,
          )
        } catch (error) {
          if (!moduleName.startsWith('.') && !path.isAbsolute(moduleName)) {
            try {
              const filePath = require.resolve(moduleName, {
                paths: [path.dirname(context.originModulePath), projectRoot],
              })
              return { type: 'sourceFile', filePath }
            } catch {
              // rethrow original
            }
          }
          throw error
        }
      },
    },
  }
}

const oneBundlerOptions = {
  // Avoid loading vite.config.ts here — Tamagui's createRequire breaks when Vite
  // bundles the config during Metro config resolution (breaks EAS createBundle).
  loadViteConfig: false,
  routerRoot: 'app',
  linking: {
    scheme: 'sheconomy',
    prefixes: [
      'sheconomy://',
      'https://sheconomy-one-eight.vercel.app',
      'https://sheconomy-one-sanjeev-shuklas-projects.vercel.app',
    ],
  },
  setupFile: {
    native: './lib/polyfills.ts',
  },
}

module.exports = (async () => {
  const rnDefault = getDefaultConfig(projectRoot)
  const oneConfig = await withOne(projectRoot, oneBundlerOptions)
  const merged = mergeConfig(rnDefault, oneConfig)

  merged.watchFolders = [
    ...new Set([
      ...(merged.watchFolders ?? []),
      projectRoot,
      // Metro must index these packages for SHA-1 when custom resolveRequest
      // returns absolute paths under node_modules.
      path.join(nodeModules, 'one'),
      path.join(nodeModules, '@babel'),
      path.join(nodeModules, '@babel/runtime'),
    ]),
  ]

  merged.resolver = {
    ...merged.resolver,
    nodeModulesPaths: [
      nodeModules,
      ...(merged.resolver?.nodeModulesPaths ?? []).filter((p) => p !== nodeModules),
    ],
    unstable_enablePackageExports: true,
  }

  return withTamaguiDedupe(withoutExpoStreamsPolyfillOnNative(merged))
})()
