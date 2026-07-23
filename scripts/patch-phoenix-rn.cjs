/**
 * Patch @supabase/phoenix so Socket does not call window.addEventListener.
 * On React Native, window === global and that call throws, white-screening the app.
 */
const fs = require('fs')
const path = require('path')

const MARKER = 'sheconomy-rn-no-phx-window'
const ROOT = path.join(__dirname, '..', 'node_modules', '@supabase', 'phoenix')

const FILES = [
  'priv/static/phoenix.mjs',
  'priv/static/phoenix.js',
  'priv/static/phoenix.cjs.js',
  'assets/js/phoenix/constants.js',
]

const FROM = 'typeof window !== "undefined" ? window : null'
const TO = `/* ${MARKER} */ false ? window : null`

for (const rel of FILES) {
  const file = path.join(ROOT, rel)
  if (!fs.existsSync(file)) continue
  let text = fs.readFileSync(file, 'utf8')
  if (text.includes(MARKER)) continue
  if (!text.includes(FROM)) {
    console.warn('[patch-phoenix-rn] pattern missing in', rel)
    continue
  }
  text = text.replaceAll(FROM, TO)
  fs.writeFileSync(file, text)
  console.log('[patch-phoenix-rn] patched', rel)
}
