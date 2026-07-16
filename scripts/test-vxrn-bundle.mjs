import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
const require = createRequire(path.join(root, 'package.json'))
const rnCommands = require('vxrn/react-native-commands')
const bundleCmd = rnCommands.find((c) => c.name === 'bundle')
if (!bundleCmd) throw new Error('no bundle command')
await bundleCmd.func(
  ['/tmp/vxrn-bundle-test/index.android.bundle'],
  {
    root,
    reactNativePath: path.dirname(require.resolve('react-native/package.json')),
  },
  {
    platform: 'android',
    dev: false,
    bundleOutput: '/tmp/vxrn-bundle-test/index.android.bundle',
    assetsDest: '/tmp/vxrn-bundle-test/assets',
    entryFile: 'index.js',
    minify: true,
    resetCache: true,
  },
)
console.log('OK bundle written')
