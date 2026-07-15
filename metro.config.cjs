// you own this file. edit freely — `one` will not regenerate it.
// withOne() invokes the same Metro pipeline One uses for production bundles.

const path = require('path')
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

  for (const name of TAMAGUI_MODULES) {
    pinNodeModule(extraNodeModules, name)
  }

  const upstreamResolveRequest = config.resolver?.resolveRequest

  return {
    ...config,
    resolver: {
      ...config.resolver,
      extraNodeModules,
      resolveRequest(context, moduleName, platform) {
        // Peer of @tensorflow-models/face-detection; unused with tfjs runtime.
        if (moduleName === '@mediapipe/face_detection') {
          return { type: 'sourceFile', filePath: MEDIAPIPE_FACE_DETECTION_STUB }
        }

        if (moduleName === 'tamagui' || moduleName.startsWith('@tamagui/')) {
          try {
            return context.resolveRequest(
              {
                ...context,
                originModulePath: path.join(projectRoot, 'index.js'),
                nodeModulesPaths: [nodeModules],
                disableHierarchicalLookup: true,
              },
              moduleName,
              platform,
            )
          } catch {
            // fall through to default resolver
          }
        }

        if (upstreamResolveRequest) {
          return upstreamResolveRequest(context, moduleName, platform)
        }

        return context.resolveRequest(context, moduleName, platform)
      },
    },
  }
}

const oneBundlerOptions = {
  routerRoot: 'app',
  linking: {
    scheme: 'sheconomy',
    prefixes: [
      'sheconomy://',
      'https://sheconomy-one-sanjeev-shuklas-projects.vercel.app',
    ],
  },
  setupFile: {
    native: './lib/polyfills.ts',
  },
}

module.exports = (async () => {
  const config = await withOne(__dirname, oneBundlerOptions)
  return withTamaguiDedupe(withoutExpoStreamsPolyfillOnNative(config))
})()
