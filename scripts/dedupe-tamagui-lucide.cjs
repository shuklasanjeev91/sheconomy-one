#!/usr/bin/env node
/**
 * @tamagui/lucide-icons@2.0.0-rc.26 nests old @tamagui/web (rc.26).
 * That duplicates React context and surfaces as production "Missing theme.".
 * Remove the nested copy so icons use the hoisted 2.4.0 packages.
 */
const fs = require('node:fs')
const path = require('node:path')

const nested = path.join(
  __dirname,
  '..',
  'node_modules/@tamagui/lucide-icons/node_modules/@tamagui',
)

if (fs.existsSync(nested)) {
  fs.rmSync(nested, { recursive: true, force: true })
  // eslint-disable-next-line no-console
  console.log('[dedupe-tamagui-lucide] removed nested @tamagui under lucide-icons')
}
