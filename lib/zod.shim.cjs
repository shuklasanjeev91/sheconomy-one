/**
 * @deprecated Prefer `~/lib/zod` (ESM bundle). Kept for any lingering CJS requires.
 */
'use strict'

const Zod = require('./zod.v3.bundle.cjs')
const z = (Zod && Zod.z) || (Zod && Zod.default && Zod.default.z) || (Zod && Zod.default) || Zod

if (!z || typeof z.object !== 'function' || typeof z.enum !== 'function') {
  throw new Error('[sheconomy] Zod shim could not resolve z.object / z.enum')
}

module.exports = { z }
