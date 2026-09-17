/**
 * Same as patch-expo-install-global: Hermes may already expose non-configurable
 * fetch/stream globals. RN's polyfillGlobal console.errors → blocking LogBox.
 */
const fs = require('fs')
const path = require('path')

const MARKER = 'SHECONOMY: skip non-configurable RN polyfills'

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native',
  'Libraries',
  'Utilities',
  'PolyfillFunctions.js',
)

if (!fs.existsSync(target)) {
  console.warn('[patch-rn-polyfill-functions] skip — file missing:', target)
  process.exit(0)
}

const source = fs.readFileSync(target, 'utf8')
if (source.includes(MARKER)) {
  process.exit(0)
}

const needle = `  const {enumerable, writable, configurable = false} = descriptor || {};
  if (descriptor && !configurable) {
    console.error('Failed to set polyfill. ' + name + ' is not configurable.');
    return;
  }`

const replacement = `  const {enumerable, writable, configurable = false} = descriptor || {};
  // ${MARKER}
  if (descriptor && !configurable) {
    // Engine already provides this API — keep it, do not LogBox.
    return;
  }`

if (!source.includes(needle)) {
  console.warn('[patch-rn-polyfill-functions] skip — unexpected contents in', target)
  process.exit(0)
}

fs.writeFileSync(target, source.replace(needle, replacement))
console.log('[patch-rn-polyfill-functions] patched', path.relative(process.cwd(), target))
