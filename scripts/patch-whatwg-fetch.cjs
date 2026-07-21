/**
 * Patch whatwg-fetch so missing Headers/Request/Response are installed even when
 * Hermes already provides `fetch`. Otherwise Supabase crashes with
 * "Property 'Headers' doesn't exist" on Android.
 */
const fs = require('fs')
const path = require('path')

const MARKER = 'sheconomy-install-missing-fetch-globals'

const OLD_BLOCK = `if (!g.fetch) {
  g.fetch = fetch
  g.Headers = Headers
  g.Request = Request
  g.Response = Response
}`

const NEW_BLOCK = `// ${MARKER}
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
}`

const OLD_BLOCK_UMD = `if (!g.fetch) {
    g.fetch = fetch;
    g.Headers = Headers;
    g.Request = Request;
    g.Response = Response;
  }`

const NEW_BLOCK_UMD = `// ${MARKER}
  if (!g.fetch) {
    g.fetch = fetch;
  }
  if (typeof g.Headers !== 'function') {
    g.Headers = Headers;
  }
  if (typeof g.Request !== 'function') {
    g.Request = Request;
  }
  if (typeof g.Response !== 'function') {
    g.Response = Response;
  }`

function patchFile(filePath, oldBlock, newBlock) {
  if (!fs.existsSync(filePath)) return
  const current = fs.readFileSync(filePath, 'utf8')
  if (current.includes(MARKER)) return
  if (!current.includes(oldBlock)) {
    console.warn('[patch-whatwg-fetch] pattern not found in', path.relative(process.cwd(), filePath))
    return
  }
  fs.writeFileSync(filePath, current.replace(oldBlock, newBlock))
  console.log('[patch-whatwg-fetch] patched', path.relative(process.cwd(), filePath))
}

const root = path.join(__dirname, '..', 'node_modules', 'whatwg-fetch')
patchFile(path.join(root, 'fetch.js'), OLD_BLOCK, NEW_BLOCK)
patchFile(path.join(root, 'dist', 'fetch.umd.js'), OLD_BLOCK_UMD, NEW_BLOCK_UMD)
