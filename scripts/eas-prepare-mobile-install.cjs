/**
 * Strip desktop-only deps / force-skip fragile native builds before EAS yarn install.
 * Requires YARN_ENABLE_IMMUTABLE_INSTALLS=false on the EAS profile.
 */
const fs = require('node:fs')

const path = 'package.json'
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'))

const strip = ['electron', 'electron-builder']
for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  if (!pkg[section]) continue
  for (const name of strip) {
    if (pkg[section][name]) {
      delete pkg[section][name]
      console.log(`[eas-prepare-mobile-install] removed ${section}.${name}`)
    }
  }
}

pkg.dependenciesMeta = {
  ...(pkg.dependenciesMeta || {}),
  sharp: { built: false },
  electron: { built: false },
  'electron-builder': { built: false },
  '@electron/rebuild': { built: false },
  esbuild: { built: false },
  workerd: { built: false },
  'cpu-features': { built: false },
  'dtrace-provider': { built: false },
}

// Replace sharp with a no-op package so install never tries to compile it.
pkg.resolutions = {
  ...(pkg.resolutions || {}),
  sharp: 'npm:empty-npm-package@1.0.0',
}

fs.writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`)
console.log('[eas-prepare-mobile-install] ready')
