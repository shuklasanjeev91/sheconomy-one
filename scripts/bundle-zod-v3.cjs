#!/usr/bin/env node
/**
 * Prebundle zod/v3 to ESM for web SSR + native (Hermes/Rolldown).
 * Zod 4 breaks on Hermes; package zod/v3 ESM hits Rolldown PARSE_ERROR.
 */
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const entry = path.join(root, 'node_modules/zod/v3/index.js')
const outfile = path.join(root, 'lib/zod.v3.bundle.js')

const result = spawnSync(
  process.execPath,
  [
    path.join(root, 'node_modules/esbuild/bin/esbuild'),
    entry,
    '--bundle',
    '--format=esm',
    '--platform=neutral',
    `--outfile=${outfile}`,
    '--log-level=warning',
  ],
  { cwd: root, stdio: 'inherit' },
)

process.exit(result.status ?? 1)
