#!/usr/bin/env node
/**
 * Stub Rolldown `__require` for Node built-ins before Metro writes main.jsbundle.
 * LiveKit → debug/util hits Hermes with no Node require.
 */
const fs = require('node:fs')
const path = require('node:path')

const marker = 'sheconomy-metro-stub-node-require-v3'

const helper = `
function stubNodeRequireForHermes(code) {
  if (typeof code !== "string" || !code.includes("Calling \`require\` for")) return code;
  if (code.includes("sheconomy-stub-node-builtins-v3")) return code;
  var throwExact = 'throw Error("Calling \`require\` for \\\\"\" + x + \"\\\\\" in an environment that doesn\\'t expose the \`require\` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.");';
  var utilStub = '{inspect:function(v){try{return typeof v===\\"string\\"?v:JSON.stringify(v)}catch(e){return String(v)}},format:function(){return Array.prototype.slice.call(arguments).join(\\" \\")},promisify:function(fn){return fn},inherits:function(){},deprecate:function(fn){return fn},types:{}}';
  var throwStub = 'var __n=String(x||""); if (__n==="util"||__n==="node:util") return ' + utilStub + '; // sheconomy-stub-node-builtins-v3\\n\\tif (__n==="tty"||__n==="node:tty"||__n==="net"||__n==="node:net"||__n==="dns"||__n==="node:dns"||__n==="fs"||__n==="node:fs"||__n==="os"||__n==="node:os"||__n==="path"||__n==="node:path"||__n==="stream"||__n==="node:stream"||__n==="events"||__n==="node:events"||__n==="assert"||__n==="node:assert"||__n==="url"||__n==="node:url"||__n==="buffer"||__n==="node:buffer"||__n==="crypto"||__n==="node:crypto"||__n==="http"||__n==="https"||__n==="zlib"||__n==="querystring"||__n==="constants"||__n==="child_process"||__n==="worker_threads"||__n==="module"||__n.indexOf("node:")===0) return {};\\n\\tif (typeof require !== "undefined") return require.apply(this, arguments);\\n\\tthrow Error("Calling \`require\` for \\\\"\" + x + \"\\\\\" in an environment that doesn\\'t expose the \`require\` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.");';
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

const metroSaveTargets = [
  path.join(__dirname, '..', 'node_modules/metro/src/shared/output/bundle.flow.js'),
]

const vxrnTargets = [
  path.join(
    __dirname,
    '..',
    'node_modules/@vxrn/vite-plugin-metro/dist/esm/rn-commands/bundle/buildBundleWithConfig.mjs',
  ),
  path.join(
    __dirname,
    '..',
    'node_modules/@vxrn/vite-plugin-metro/dist/esm/rn-commands/bundle/buildBundleWithConfig.native.js',
  ),
  path.join(
    __dirname,
    '..',
    'node_modules/@vxrn/vite-plugin-metro/dist/cjs/rn-commands/bundle/buildBundleWithConfig.cjs',
  ),
]

function stripOldHelper(src) {
  return src.replace(/\n?function stubNodeRequireForHermes\(code\) \{[\s\S]*?\n\}\n+/g, '\n')
}

function patchMetroSave(target) {
  if (!fs.existsSync(target)) return false
  let src = fs.readFileSync(target, 'utf8')
  src = stripOldHelper(src)
  src = helper + '\n' + src
  src = src.replace(/sheconomy-metro-stub-node-require-v\d+/g, marker)

  if (!src.includes('// ' + marker) && !src.includes(marker + '\n')) {
    const replaced = src.replace(
      /await \(0, _writeFile\.default\)\(bundleOutput, bundle\.code, encoding\);?/,
      `// ${marker}\n    if (typeof bundle.code === "string") bundle.code = stubNodeRequireForHermes(bundle.code);\n    await (0, _writeFile.default)(bundleOutput, bundle.code, encoding);`,
    )
    if (replaced === src && !src.includes('stubNodeRequireForHermes(bundle.code)')) {
      console.warn('[patch-metro-stub-node-require] metro save inject failed', path.relative(process.cwd(), target))
      return false
    }
    src = replaced
  }

  // Ensure call site exists even if only marker was renamed
  if (!src.includes('stubNodeRequireForHermes(bundle.code)')) {
    console.warn('[patch-metro-stub-node-require] missing call site', path.relative(process.cwd(), target))
    return false
  }

  fs.writeFileSync(target, src)
  console.log('[patch-metro-stub-node-require] patched', path.relative(process.cwd(), target))
  return true
}

function patchVxrnBuildBundle(target) {
  if (!fs.existsSync(target)) return false
  let src = fs.readFileSync(target, 'utf8')
  src = stripOldHelper(src)
  src = helper + '\n' + src
  src = src.replace(/sheconomy-metro-stub-node-require-v\d+/g, marker)

  if (!src.includes('bundle.code = stubNodeRequireForHermes')) {
    src = src.replace(
      /const bundle = await bundleImpl\.build\(server, requestOpts\);/,
      `const bundle = await bundleImpl.build(server, requestOpts);\n    // ${marker}\n    if (bundle && typeof bundle.code === "string") bundle.code = stubNodeRequireForHermes(bundle.code);`,
    )
    src = src.replace(
      /var bundle = await bundleImpl\.build\(server, requestOpts\);/,
      `var bundle = await bundleImpl.build(server, requestOpts);\n    // ${marker}\n    if (bundle && typeof bundle.code === "string") bundle.code = stubNodeRequireForHermes(bundle.code);`,
    )
  }

  fs.writeFileSync(target, src)
  console.log('[patch-metro-stub-node-require] patched', path.relative(process.cwd(), target))
  return true
}

let ok = false
for (const t of metroSaveTargets) ok = patchMetroSave(t) || ok
for (const t of vxrnTargets) ok = patchVxrnBuildBundle(t) || ok
process.exit(ok ? 0 : 1)
