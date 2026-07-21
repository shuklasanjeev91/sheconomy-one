#!/usr/bin/env node
/**
 * Runs the React Native / One release bundler, then kills leftover esbuild
 * service processes so Gradle's createBundleReleaseJsAndAssets can finish.
 */
const { spawn, execSync } = require('node:child_process')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const cli = path.join(projectRoot, 'node_modules', 'react-native', 'cli.js')

const child = spawn(process.execPath, [cli, 'bundle', ...process.argv.slice(2)], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env,
})

function cleanup() {
  try {
    execSync('pkill -f "esbuild --service" || true', { stdio: 'ignore' })
  } catch {
    // ignore
  }
}

child.on('exit', (code, signal) => {
  cleanup()
  // Give Gradle a clean exit even if the bundler used "exit to prevent hanging".
  if (signal) {
    process.exit(1)
  }
  process.exit(code ?? 0)
})

process.on('SIGINT', () => {
  child.kill('SIGINT')
  cleanup()
})
process.on('SIGTERM', () => {
  child.kill('SIGTERM')
  cleanup()
})
