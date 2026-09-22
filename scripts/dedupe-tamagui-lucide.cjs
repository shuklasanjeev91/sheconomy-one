#!/usr/bin/env node
/**
 * @tamagui/lucide-icons@2.0.0-rc.26 nests old @tamagui/web (rc.26).
 * That duplicates React context and surfaces as production "Missing theme.".
 * Remove nested copies so icons / themed() use the hoisted 2.4.0 packages.
 */
const fs = require('node:fs')
const path = require('node:path')

const roots = [
  'node_modules/@tamagui/lucide-icons/node_modules/@tamagui',
  'node_modules/@tamagui/helpers-icon/node_modules/@tamagui',
  'node_modules/@tamagui/sizable-context/node_modules/@tamagui',
]

for (const rel of roots) {
  const nested = path.join(__dirname, '..', rel)
  if (fs.existsSync(nested)) {
    fs.rmSync(nested, { recursive: true, force: true })
    // eslint-disable-next-line no-console
    console.log(`[dedupe-tamagui-lucide] removed ${rel}`)
  }
}
