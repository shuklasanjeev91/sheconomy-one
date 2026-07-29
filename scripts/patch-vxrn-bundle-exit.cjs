#!/usr/bin/env node
/**
 * Patch vxrn buildBundle so Archive/Xcode script phases finish.
 *
 * Upstream waits 30s then calls process.exit(). Under Xcode (and Gradle),
 * orphaned rolldown/esbuild child processes keep inherited stdio pipes open,
 * so the parent script never sees EOF and the UI stays on "Building" for hours.
 *
 * Fix: kill lingering child processes, then exit immediately with code 0.
 */
const fs = require('node:fs')
const path = require('node:path')

const marker = 'vxrn:bundle-exit-patched-v1'

const forceExitBlock = `console.info("Done.");
  // ${marker}
  // Kill orphan bundler workers that keep Xcode/Gradle waiting on pipe EOF.
  try {
    var handles = typeof process._getActiveHandles === "function" ? process._getActiveHandles() : [];
    for (var i = 0; i < handles.length; i++) {
      var handle = handles[i];
      if (handle && typeof handle.kill === "function" && handle.pid) {
        try {
          handle.kill("SIGKILL");
        } catch (_e) {}
      }
    }
  } catch (_e2) {}
  console.info("Exiting process to prevent hanging.");
  process.exit(0);`

const replacements = [
  // .mjs
  {
    from: `console.info("Done.");
  setTimeout(() => {
    console.info("Exiting process to prevent hanging.");
    process.exit();
  }, 3e4);`,
    to: forceExitBlock,
  },
  // .native.js
  {
    from: `console.info("Done.");
  setTimeout(function () {
    console.info("Exiting process to prevent hanging.");
    process.exit();
  }, 3e4);`,
    to: forceExitBlock,
  },
]

const targets = [
  path.join(__dirname, '..', 'node_modules', 'vxrn', 'dist', 'rn-commands', 'bundle', 'buildBundle.mjs'),
  path.join(__dirname, '..', 'node_modules', 'vxrn', 'dist', 'rn-commands', 'bundle', 'buildBundle.native.js'),
]

let patchedAny = false
for (const target of targets) {
  if (!fs.existsSync(target)) {
    console.warn('[patch-vxrn-bundle-exit] skip — missing', path.relative(process.cwd(), target))
    continue
  }
  let src = fs.readFileSync(target, 'utf8')
  if (src.includes(marker)) {
    console.log('[patch-vxrn-bundle-exit] already patched', path.relative(process.cwd(), target))
    continue
  }

  let replaced = false
  for (const { from, to } of replacements) {
    if (!src.includes(from)) continue
    src = src.replace(from, to)
    replaced = true
    break
  }

  if (!replaced) {
    console.warn('[patch-vxrn-bundle-exit] unexpected source', path.relative(process.cwd(), target))
    continue
  }

  fs.writeFileSync(target, src)
  patchedAny = true
  console.log('[patch-vxrn-bundle-exit] patched', path.relative(process.cwd(), target))
}

if (!patchedAny) {
  process.exit(0)
}
