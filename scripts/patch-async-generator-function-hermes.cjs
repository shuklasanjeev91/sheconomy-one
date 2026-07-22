#!/usr/bin/env node
/**
 * Replace ljharb's async-generator-function (uses `async function*`) with a
 * Hermes-safe stub. get-intrinsic already treats a falsy return as missing.
 */
const fs = require('node:fs')
const path = require('node:path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'async-generator-function',
  'index.js',
)

if (!fs.existsSync(target)) {
  console.warn('[patch-async-generator-function-hermes] skip — package missing')
  process.exit(0)
}

const marker = 'hermes-safe-async-generator-function'
const src = fs.readFileSync(target, 'utf8')
if (src.includes(marker)) {
  console.log('[patch-async-generator-function-hermes] already patched')
  process.exit(0)
}

fs.writeFileSync(
  target,
  `'use strict';\n// ${marker}\n/** @type {import('.')} */\nmodule.exports = () => undefined;\n`,
)
console.log('[patch-async-generator-function-hermes] patched', path.relative(process.cwd(), target))
