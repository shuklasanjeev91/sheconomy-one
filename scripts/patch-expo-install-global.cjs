/**
 * Expo's winter installGlobal console.errors when Hermes already exposes a
 * non-configurable TextDecoderStream / TextEncoderStream / etc. In Debug that
 * becomes a blocking LogBox redbox even though the native API is fine.
 *
 * Prefer the engine's implementation and stay quiet.
 */
const fs = require('fs')
const path = require('path')

const MARKER = 'SHECONOMY: skip non-configurable winter polyfills'

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo',
  'src',
  'winter',
  'installGlobal.ts',
)

if (!fs.existsSync(target)) {
  console.warn('[patch-expo-install-global] skip — file missing:', target)
  process.exit(0)
}

const source = fs.readFileSync(target, 'utf8')
if (source.includes(MARKER)) {
  process.exit(0)
}

const needle = `  const { enumerable, writable, configurable = false } = descriptor || {};
  if (descriptor && !configurable) {
    console.error('Failed to set polyfill. ' + name + ' is not configurable.');
    return;
  }`

const replacement = `  const { enumerable, writable, configurable = false } = descriptor || {};
  // ${MARKER}
  if (descriptor && !configurable) {
    // Hermes/JSC already provides this API as a non-configurable builtin.
    return;
  }`

if (!source.includes(needle)) {
  console.warn('[patch-expo-install-global] skip — unexpected contents in', target)
  process.exit(0)
}

fs.writeFileSync(target, source.replace(needle, replacement))
console.log('[patch-expo-install-global] patched', path.relative(process.cwd(), target))
