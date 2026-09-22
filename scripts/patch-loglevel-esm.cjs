/**
 * Patches `loglevel` UMD wrapper in node_modules to avoid:
 *   TypeError: Cannot set properties of undefined (setting 'log')
 * when evaluated in strict ESM / Vite SSR environments where `this` is undefined.
 */
const fs = require('fs')
const path = require('path')

const MARKER = 'sheconomy-safe-loglevel-umd'

const targets = [
  path.join(__dirname, '..', 'node_modules', 'loglevel', 'lib', 'loglevel.js'),
  path.join(__dirname, '..', 'node_modules', '@livekit', 'components-core', 'node_modules', 'loglevel', 'lib', 'loglevel.js'),
]

for (const target of targets) {
  if (!fs.existsSync(target)) {
    continue
  }

  const content = fs.readFileSync(target, 'utf8')
  if (content.includes(MARKER)) {
    continue
  }

  const oldPreamble = `    } else {
        root.log = definition();
    }
}(this, function () {`

  const newPreamble = `    } else {
        // ${MARKER}
        var r = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined') ? window : (typeof self !== 'undefined') ? self : (typeof global !== 'undefined') ? global : (root || {});
        r.log = definition();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : this))), function () {`

  if (!content.includes(oldPreamble)) {
    continue
  }

  let patched = content.replace(oldPreamble, newPreamble)
  if (!patched.includes('// sheconomy-esm-loglevel-export')) {
    patched += `\n// sheconomy-esm-loglevel-export\nif (typeof module !== 'undefined' && module && module.exports) {\n    module.exports.default = module.exports;\n}\n`
  }

  fs.writeFileSync(target, patched, 'utf8')
  console.log('[patch-loglevel-esm] patched', path.relative(process.cwd(), target))
}
