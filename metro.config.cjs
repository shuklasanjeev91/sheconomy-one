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

function withTamaguiDedupe(config) {
  const extraNodeModules = { ...(config.resolver?.extraNodeModules ?? {}) }

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
