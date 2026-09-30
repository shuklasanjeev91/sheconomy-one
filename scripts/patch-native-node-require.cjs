#!/usr/bin/env node
/**
 * Patch Rolldown's Hermes-hostile `__require("tty")` in the native Vite entry.
 * WebRTC → `debug` Node build requires `tty`; Hermes has no Node require.
 */
const fs = require('node:fs')
const path = require('node:path')

const target = path.join(__dirname, '../dist/__virtual-native-entry.js')
if (!fs.existsSync(target)) {
  console.warn('[patch-native-node-require] skip — missing', target)
  process.exit(0)
}

let code = fs.readFileSync(target, 'utf8')
const original = code

if (!code.includes('sheconomy-stub-node-builtins')) {
  const needle =
    'throw Error("Calling `require` for \\"" + x + "\\" in an environment that doesn\'t expose the `require` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.");'
  const repl =
    'if (x === "tty" || x === "node:tty" || x === "net" || x === "node:net" || x === "dns" || x === "node:dns" || x === "fs" || x === "node:fs") return {}; // sheconomy-stub-node-builtins\n\tthrow Error("Calling `require` for \\"" + x + "\\" in an environment that doesn\'t expose the `require` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.");'
  if (code.includes(needle)) {
    code = code.replace(needle, repl)
  }
}

code = code
  .replace(/__require\(["']tty["']\)/g, '({})')
  .replace(/__require\(["']node:tty["']\)/g, '({})')
  .replace(/__require\(["']net["']\)/g, '({})')
  .replace(/__require\(["']node:net["']\)/g, '({})')
  .replace(/__require\(["']dns["']\)/g, '({})')
  .replace(/__require\(["']node:dns["']\)/g, '({})')

if (code === original) {
  console.log('[patch-native-node-require] already patched or no matches')
  process.exit(0)
}

fs.writeFileSync(target, code)
console.log('[patch-native-node-require] patched', target)
