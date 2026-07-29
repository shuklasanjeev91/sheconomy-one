#!/usr/bin/env node
/**
 * Patch vxrn hermesCompatSWCPlugin so Hermes can load deps that ship
 * `async function*` (e.g. exceljs / idb). Upstream skips files >500KB and
 * skips all async transforms in DEV, which leaves async generators intact
 * and crashes Hermes with: "async generators are unsupported".
 *
 * Also:
 * - Use Rolldown `transform.handler` form (more reliable than Vite-style hook)
 * - Normalize ids (query / null-byte suffixes) before extension checks
 * - Surface SWC errors when async generators are present
 */
const fs = require('node:fs')
const path = require('node:path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'vxrn',
  'dist',
  'utils',
  'createNativeDevEngine.native.js',
)

if (!fs.existsSync(target)) {
  console.warn('[patch-vxrn-hermes-async-gen] skip — file missing')
  process.exit(0)
}

let src = fs.readFileSync(target, 'utf8')
const marker = 'vxrn:hermes-async-gen-patched-v2'

if (src.includes(marker)) {
  console.log('[patch-vxrn-hermes-async-gen] already patched')
  process.exit(0)
}

// Remove older v1 marker patch if present so we can replace the whole function.
const fnStart = src.indexOf('function hermesCompatSWCPlugin(dev) {')
const fnEnd = src.indexOf('\nfunction getHmrRuntimeSource()', fnStart)
if (fnStart === -1 || fnEnd === -1) {
  console.warn('[patch-vxrn-hermes-async-gen] skip — hermesCompatSWCPlugin not found')
  process.exit(0)
}

const replacement = `function hermesCompatSWCPlugin(dev) {
  var swc = null;
  return {
    name: "vxrn:hermes-compat",
    transform: {
      // ${marker}
      async handler(code, id) {
        var fileId = String(id || "").split("\\0").pop() || "";
        fileId = fileId.split("?")[0].split("#")[0];
        if (!/\\.[cm]?[jt]sx?$/.test(fileId)) return;
        if (fileId.includes("virtual:")) return;
        var hasClass = code.includes("class ") || code.includes("class{");
        var hasAsyncGen = code.includes("async function*") || code.includes("async function *") || /async\\s*\\*/.test(code);
        var hasAsync = (!dev && code.includes("async ")) || hasAsyncGen;
        if (!hasClass && !hasAsync) return;
        // Still skip enormous files unless they contain async generators (Hermes hard-fail).
        if (code.length > 5e5 && !hasAsyncGen) return;
        try {
          if (!swc) swc = await import("@swc/core");
          var envIncludes = ["transform-class-properties", "transform-class-static-block", "transform-private-methods", "transform-private-property-in-object", ...(!dev || hasAsyncGen ? ["transform-classes", "transform-async-to-generator", "transform-async-generator-functions"] : [])];
          return {
            code: (await swc.transform(code, {
              filename: fileId,
              configFile: false,
              swcrc: false,
              sourceMaps: false,
              inputSourceMap: false,
              env: {
                targets: {
                  node: 9999
                },
                include: envIncludes
              },
              jsc: {
                parser: {
                  syntax: "typescript",
                  tsx: true
                },
                transform: {
                  react: {
                    runtime: "preserve"
                  }
                },
                externalHelpers: false,
                assumptions: {
                  setPublicClassFields: true,
                  privateFieldsAsProperties: true
                }
              },
              isModule: !fileId.endsWith(".cjs")
            })).code
          };
        } catch (err) {
          if (hasAsyncGen) console.warn("[vxrn:hermes-compat] async-gen transform failed for", fileId, err && err.message || err);
        }
      }
    }
  };
}
`

src = src.slice(0, fnStart) + replacement + src.slice(fnEnd)
fs.writeFileSync(target, src)
console.log('[patch-vxrn-hermes-async-gen] patched', path.relative(process.cwd(), target))
