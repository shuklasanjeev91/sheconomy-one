/**
 * Strip desktop-only deps before EAS mobile installs.
 * Electron postinstall / sharp (via miniflare) can fail builders and abort yarn.
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
}

fs.writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`)
console.log('[eas-prepare-mobile-install] ready')
