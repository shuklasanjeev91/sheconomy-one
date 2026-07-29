/**
 * Shared Zod for web, SSR, Android, and iOS.
 * Prebundled zod/v3 ESM — Zod 4 breaks on Hermes; raw zod/v3 ESM breaks Rolldown.
 */
export { z } from '~/lib/zod.v3.bundle.js'
export { z as default } from '~/lib/zod.v3.bundle.js'
