import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '../../config/supabase-public'
import {
  AUTH_STORAGE_KEY,
  SMOKE_TIERS,
  type SmokeTier,
  authStatePath,
  hasSmokeTier,
  hasSmokeTokens,
} from './auth-env'

const AUTH_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '.auth')

async function writeSessionState(tier: SmokeTier, accessToken: string, refreshToken: string) {
  const url = process.env.SMOKE_SUPABASE_URL?.trim() || PUBLIC_SUPABASE_URL
  const anon = process.env.SMOKE_SUPABASE_ANON_KEY?.trim() || PUBLIC_SUPABASE_ANON_KEY
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  if (error || !data.session) {
    throw new Error(`[smoke:${tier}] setSession failed: ${error?.message ?? 'no session'}`)
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true })
  const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081'
  const storageState = {
    cookies: [] as unknown[],
    origins: [
      {
        origin,
        localStorage: [
          {
            name: AUTH_STORAGE_KEY,
            value: JSON.stringify(data.session),
          },
        ],
      },
    ],
  }
  fs.writeFileSync(authStatePath(tier), JSON.stringify(storageState, null, 2))
}

setup.describe('smoke auth storageState', () => {
  for (const tier of SMOKE_TIERS) {
    setup(`prepare ${tier} session`, async () => {
      if (hasSmokeTokens(tier)) {
        const access = process.env[`SMOKE_${tier.toUpperCase()}_ACCESS_TOKEN`]!.trim()
        const refresh = process.env[`SMOKE_${tier.toUpperCase()}_REFRESH_TOKEN`]!.trim()
        await writeSessionState(tier, access, refresh)
        return
      }

      // Path C — yarn smoke:mint already wrote storageState.
      if (fs.existsSync(authStatePath(tier))) {
        return
      }

      setup.skip(
        true,
        `Missing SMOKE_${tier.toUpperCase()}_* tokens and no minted ${tier}.json — run yarn smoke:mint or set tokens`,
      )
    })
  }

  setup('report available tiers', async () => {
    const available = SMOKE_TIERS.filter(hasSmokeTier)
    // eslint-disable-next-line no-console
    console.log(
      available.length
        ? `[smoke] auth tiers ready: ${available.join(', ')}`
        : '[smoke] no SMOKE_* tokens or minted sessions — guest projects only',
    )
  })
})
