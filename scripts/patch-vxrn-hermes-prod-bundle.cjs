#!/usr/bin/env node
/**
 * Patch vxrn buildNativeBundle (.mjs — used by Gradle release) so release JS
 * is hermesc-compatible. Upstream leaves class expressions / async arrows that
 * hermesc rejects.
 */
const fs = require('node:fs')
const path = require('node:path')

const targets = [
  path.join(__dirname, '..', 'node_modules', 'vxrn', 'dist', 'utils', 'createNativeDevEngine.mjs'),
  path.join(__dirname, '..', 'node_modules', 'vxrn', 'dist', 'utils', 'createNativeDevEngine.native.js'),
]

const marker = 'vxrn:hermes-prod-bundle-patched-v1'

const needles = [
  // .mjs (modern)
  `  if (!chunk || !("code" in chunk)) throw new Error("[vxrn] production build produced no output");
  let code = postProcessNativeBundle(chunk.code);
  code = await downlevelClassFieldsInBundle(code);
  return {
    code,
    map: chunk.map?.toString()
  };
}`,
  // .native.js (compiled)
  `  if (!chunk || !("code" in chunk)) throw new Error("[vxrn] production build produced no output");
  var code = postProcessNativeBundle(chunk.code);
  code = await downlevelClassFieldsInBundle(code);
  return {
    code,
    map: (_chunk_map = chunk.map) === null || _chunk_map === void 0 ? void 0 : _chunk_map.toString()
  };
}`,
]

const downlevelFn = `
async function downlevelForHermesc(code) {
  try {
    var swc = await import("@swc/core");
    var result = await swc.transform(code, {
      filename: "native-release.bundle.js",
      configFile: false,
      swcrc: false,
      sourceMaps: false,
      inputSourceMap: false,
      isModule: false,
      env: {
        targets: { ie: 11 },
        include: [
          "transform-classes",
          "transform-class-properties",
          "transform-class-static-block",
          "transform-private-methods",
          "transform-private-property-in-object",
          "transform-async-to-generator",
          "transform-async-generator-functions",
          "transform-regenerator",
          "transform-object-rest-spread",
          "transform-optional-chaining",
          "transform-nullish-coalescing-operator"
        ]
      },
      jsc: {
        parser: { syntax: "ecmascript", jsx: true },
        externalHelpers: false,
        assumptions: {
          setPublicClassFields: true,
          privateFieldsAsProperties: true
        }
      }
    });
    return result.code.replace(/["']use strict["'];?/g, "");
  } catch (err) {
    console.warn("[vxrn] downlevelForHermesc failed, returning original:", err);
    return code;
  }
}
`

let patchedAny = false
for (const target of targets) {
  if (!fs.existsSync(target)) continue
  let src = fs.readFileSync(target, 'utf8')
  if (src.includes(marker)) {
    console.log('[patch-vxrn-hermes-prod-bundle] already patched', path.relative(process.cwd(), target))
    continue
  }

  let replaced = false
  for (const needle of needles) {
    if (!src.includes(needle)) continue
    const replacement = needle
      .replace(
        'code = await downlevelClassFieldsInBundle(code);\n  return {',
        `code = await downlevelClassFieldsInBundle(code);\n  // ${marker}\n  if (!dev) code = await downlevelForHermesc(code);\n  return {`,
      )
    src = src.replace(needle, replacement)
    // Insert helper before VIRTUAL_NATIVE_ENTRY if missing
    if (!src.includes('async function downlevelForHermesc')) {
      const insertAt = src.indexOf('const VIRTUAL_NATIVE_ENTRY')
      const insertAt2 = src.indexOf('var VIRTUAL_NATIVE_ENTRY')
      const at = insertAt !== -1 ? insertAt : insertAt2
      if (at === -1) {
        console.warn('[patch-vxrn-hermes-prod-bundle] cannot insert helper in', target)
        continue
      }
      src = src.slice(0, at) + downlevelFn + '\n' + src.slice(at)
    }
    replaced = true
    break
  }

  if (!replaced) {
    console.warn('[patch-vxrn-hermes-prod-bundle] skip — unexpected source', path.relative(process.cwd(), target))
    continue
  }

  fs.writeFileSync(target, src)
  patchedAny = true
  console.log('[patch-vxrn-hermes-prod-bundle] patched', path.relative(process.cwd(), target))
}

if (!patchedAny) {
  // already patched cases still exit 0
  process.exit(0)
}
