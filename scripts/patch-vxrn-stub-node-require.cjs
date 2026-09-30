#!/usr/bin/env node
/**
 * Patch vxrn native production bundler to stub Rolldown `__require` for Node
 * built-ins (tty/util/…) before hermesc. WebRTC pulls these via debug.
 */
const fs = require('node:fs')
const path = require('node:path')

const targets = [
  path.join(__dirname, '..', 'node_modules', 'vxrn', 'dist', 'utils', 'createNativeDevEngine.mjs'),
  path.join(__dirname, '..', 'node_modules', 'vxrn', 'dist', 'utils', 'createNativeDevEngine.native.js'),
]

const marker = 'vxrn:stub-node-require-hermes-v4'

const helper = `
function stubNodeRequireForHermes(code) {
  if (typeof code !== "string" || !code.includes("Calling \`require\` for")) return code;
  if (code.includes("sheconomy-stub-node-builtins-v3")) return code;
  var throwExact = 'throw Error("Calling \`require\` for \\\\"\" + x + \"\\\\\" in an environment that doesn\\'t expose the \`require\` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.");';
  var utilStub = '{inspect:function(v){try{return typeof v===\\"string\\"?v:JSON.stringify(v)}catch(e){return String(v)}},format:function(){return Array.prototype.slice.call(arguments).join(\\" \\")},promisify:function(fn){return fn},inherits:function(){},deprecate:function(fn){return fn},types:{}}';
  var throwStub = 'var __n=String(x||""); if (__n==="util"||__n==="node:util") return ' + utilStub + '; // sheconomy-stub-node-builtins-v3\\n\\tif (__n==="tty"||__n==="node:tty"||__n==="net"||__n==="node:net"||__n==="dns"||__n==="node:dns"||__n==="fs"||__n==="node:fs"||__n==="os"||__n==="node:os"||__n==="path"||__n==="node:path"||__n==="stream"||__n==="node:stream"||__n==="events"||__n==="node:events"||__n==="assert"||__n==="node:assert"||__n==="url"||__n==="node:url"||__n==="buffer"||__n==="node:buffer"||__n==="crypto"||__n==="node:crypto"||__n==="http"||__n==="https"||__n==="zlib"||__n==="querystring"||__n==="constants"||__n==="child_process"||__n==="worker_threads"||__n==="module"||__n.indexOf("node:")===0) return {};\\n\\tif (typeof require !== "undefined") return require.apply(this, arguments);\\n\\t' + throwExact;
  var next = code.split(throwExact).join(throwStub);
  return next
    .replace(/__require\\([\\"']tty[\\"']\\)/g, "({})")
    .replace(/__require\\([\\"']node:tty[\\"']\\)/g, "({})")
    .replace(/__require\\([\\"']util[\\"']\\)/g, "(" + utilStub + ")")
    .replace(/__require\\([\\"']node:util[\\"']\\)/g, "(" + utilStub + ")")
    .replace(/__require\\([\\"']net[\\"']\\)/g, "({})")
    .replace(/__require\\([\\"']node:net[\\"']\\)/g, "({})")
    .replace(/__require\\([\\"']dns[\\"']\\)/g, "({})")
    .replace(/__require\\([\\"']node:dns[\\"']\\)/g, "({})");
}
`

let patchedAny = false
for (const target of targets) {
  if (!fs.existsSync(target)) continue
  let src = fs.readFileSync(target, 'utf8')

  // Always refresh helper body
  src = src.replace(/\n?function stubNodeRequireForHermes\(code\) \{[\s\S]*?\n\}\n+/g, '\n')

  const insertAt = Math.max(src.indexOf('const VIRTUAL_NATIVE_ENTRY'), src.indexOf('var VIRTUAL_NATIVE_ENTRY'))
  if (insertAt === -1) {
    console.warn('[patch-vxrn-stub-node-require] cannot insert helper', path.relative(process.cwd(), target))
    continue
  }
  src = src.slice(0, insertAt) + helper + '\n' + src.slice(insertAt)

  if (!src.includes('code = stubNodeRequireForHermes(code);')) {
    src = src.replace(
      /((?:let|var) code = postProcessNativeBundle\(chunk\.code\);)/g,
      `$1\n  code = stubNodeRequireForHermes(code);`,
    )
  }

  src = src.replace(/vxrn:stub-node-require-hermes-v\d+/g, marker)
  if (!src.includes(marker)) {
    const prodNeedle = 'code = await downlevelClassFieldsInBundle(code);'
    if (src.includes(prodNeedle)) {
      src = src.replace(
        prodNeedle,
        `code = stubNodeRequireForHermes(code);\n  // ${marker}\n  code = await downlevelClassFieldsInBundle(code);`,
      )
    } else if (src.includes('stubNodeRequireForHermes(code)')) {
      src = src.replace(
        'code = stubNodeRequireForHermes(code);',
        `code = stubNodeRequireForHermes(code); // ${marker}`,
      )
    }
  }

  if (!src.includes('stubNodeRequireForHermes(code)')) {
    console.warn('[patch-vxrn-stub-node-require] inject failed', path.relative(process.cwd(), target))
    continue
  }

  fs.writeFileSync(target, src)
  patchedAny = true
  console.log('[patch-vxrn-stub-node-require] patched', path.relative(process.cwd(), target))
}

process.exit(patchedAny ? 0 : 1)
