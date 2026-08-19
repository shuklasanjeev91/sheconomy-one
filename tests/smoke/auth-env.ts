import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SMOKE_DIR = path.dirname(fileURLToPath(import.meta.url))

/** Supabase-js web storage key for project zsaqrrzwygzwrlzgymxk. */
export const AUTH_STORAGE_KEY = 'sb-zsaqrrzwygzwrlzgymxk-auth-token'

export const SMOKE_TIERS = ['limited', 'verified', 'vendor', 'admin'] as const
export type SmokeTier = (typeof SMOKE_TIERS)[number]

export function authStatePath(tier: SmokeTier): string {
  return path.join(SMOKE_DIR, '.auth', `${tier}.json`)
}

/** True when path A tokens are in the environment. */
export function hasSmokeTokens(tier: SmokeTier): boolean {
  const prefix = `SMOKE_${tier.toUpperCase()}`
  return Boolean(
    process.env[`${prefix}_ACCESS_TOKEN`]?.trim() && process.env[`${prefix}_REFRESH_TOKEN`]?.trim(),
  )
}

/**
 * True when this tier can run: path A tokens, or path C minted storageState
 * already on disk under tests/smoke/.auth/.
 */
export function hasSmokeTier(tier: SmokeTier): boolean {
  return hasSmokeTokens(tier) || fs.existsSync(authStatePath(tier))
}

export function smokeAuthAvailable(): boolean {
  return SMOKE_TIERS.some(hasSmokeTier)
}
