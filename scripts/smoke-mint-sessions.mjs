#!/usr/bin/env node
/**
 * Mint Playwright storageState for smoke auth tiers via Supabase service role.
 *
 * Prefer existing SMOKE_<TIER>_ACCESS_TOKEN + _REFRESH_TOKEN (path A).
 * For any missing tier, resolve a profile and create a session (path C).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... yarn smoke:mint
 *   # or put the key in .env.local (never commit)
 *
 * Optional overrides:
 *   SMOKE_LIMITED_USER_ID / SMOKE_VERIFIED_USER_ID / SMOKE_VENDOR_USER_ID / SMOKE_ADMIN_USER_ID
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

/** Keep in sync with config/supabase-public.ts (anon is public). */
const PUBLIC_SUPABASE_URL = 'https://zsaqrrzwygzwrlzgymxk.supabase.co'
const PUBLIC_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzYXFycnp3eWd6d3Jsemd5bXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyNTYwMzMsImV4cCI6MjA2NjgzMjAzM30.cFeln0b7EtzPaNmuGTCr3sDn_nU_8uNjaIYL9ER1_U0'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const AUTH_DIR = path.join(ROOT, 'tests/smoke/.auth')
const AUTH_STORAGE_KEY = 'sb-zsaqrrzwygzwrlzgymxk-auth-token'
const ORIGIN = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081'

const TIERS = ['limited', 'verified', 'vendor', 'admin']

function loadEnvFiles() {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(ROOT, name)
    if (!fs.existsSync(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] == null || process.env[key] === '') {
        process.env[key] = value
      }
    }
  }
}

function hasTokens(tier) {
  const prefix = `SMOKE_${tier.toUpperCase()}`
  return Boolean(process.env[`${prefix}_ACCESS_TOKEN`]?.trim() && process.env[`${prefix}_REFRESH_TOKEN`]?.trim())
}

function authStatePath(tier) {
  return path.join(AUTH_DIR, `${tier}.json`)
}

function writeStorageState(tier, session) {
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  const storageState = {
    cookies: [],
    origins: [
      {
        origin: ORIGIN,
        localStorage: [{ name: AUTH_STORAGE_KEY, value: JSON.stringify(session) }],
      },
    ],
  }
  fs.writeFileSync(authStatePath(tier), JSON.stringify(storageState, null, 2))
}

async function sessionFromTokens(url, anonKey, access, refresh) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await client.auth.setSession({
    access_token: access,
    refresh_token: refresh,
  })
  if (error || !data.session) {
    throw new Error(error?.message ?? 'setSession returned no session')
  }
  return data.session
}

async function sessionFromUserId(admin, url, anonKey, userId) {
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId)
  if (userError || !userData.user) {
    throw new Error(userError?.message ?? `user ${userId} not found`)
  }
  const email = userData.user.email
  if (!email) {
    throw new Error(`user ${userId} has no email — cannot mint magic-link session`)
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkError || !linkData?.properties?.hashed_token) {
    throw new Error(linkError?.message ?? 'generateLink returned no hashed_token')
  }

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: otpData, error: otpError } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  })
  if (otpError || !otpData.session) {
    throw new Error(otpError?.message ?? 'verifyOtp returned no session')
  }
  return otpData.session
}

async function resolveUserId(admin, tier) {
  const override = process.env[`SMOKE_${tier.toUpperCase()}_USER_ID`]?.trim()
  if (override) return override

  // Service-role client can read profiles via PostgREST.
  let query = admin.from('profiles').select('id, email, role, gender, is_verified')

  if (tier === 'admin') {
    query = query.eq('role', 'A').not('email', 'is', null).limit(1)
  } else if (tier === 'vendor') {
    query = query.eq('role', 'V').eq('gender', true).eq('is_verified', true).not('email', 'is', null).limit(1)
  } else if (tier === 'verified') {
    query = query.eq('role', 'U').eq('gender', true).eq('is_verified', true).not('email', 'is', null).limit(1)
  } else {
    // limited — signed-in but not verified female
    query = query.eq('role', 'U').eq('gender', false).eq('is_verified', false).not('email', 'is', null).limit(1)
  }

  const { data, error } = await query
  if (error) throw new Error(`[${tier}] profile lookup failed: ${error.message}`)
  const row = data?.[0]
  if (!row?.id) throw new Error(`[${tier}] no matching profile with email found`)
  return row.id
}

async function main() {
  loadEnvFiles()

  const url = process.env.SMOKE_SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || PUBLIC_SUPABASE_URL
  const anonKey =
    process.env.SMOKE_SUPABASE_ANON_KEY?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    PUBLIC_SUPABASE_ANON_KEY
  const serviceRole =
    process.env.SMOKE_SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  const results = []

  for (const tier of TIERS) {
    try {
      if (hasTokens(tier)) {
        const access = process.env[`SMOKE_${tier.toUpperCase()}_ACCESS_TOKEN`].trim()
        const refresh = process.env[`SMOKE_${tier.toUpperCase()}_REFRESH_TOKEN`].trim()
        const session = await sessionFromTokens(url, anonKey, access, refresh)
        writeStorageState(tier, session)
        results.push({ tier, ok: true, source: 'tokens' })
        continue
      }

      if (!serviceRole) {
        results.push({
          tier,
          ok: false,
          source: 'none',
          error: 'missing SMOKE_* tokens and SUPABASE_SERVICE_ROLE_KEY',
        })
        continue
      }

      const admin = createClient(url, serviceRole, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
      const userId = await resolveUserId(admin, tier)
      const session = await sessionFromUserId(admin, url, anonKey, userId)
      writeStorageState(tier, session)
      // Also export into process so a follow-up smoke run in the same shell can see them
      // if the caller `eval`s printed exports — we write env.exports for convenience.
      process.env[`SMOKE_${tier.toUpperCase()}_ACCESS_TOKEN`] = session.access_token
      process.env[`SMOKE_${tier.toUpperCase()}_REFRESH_TOKEN`] = session.refresh_token
      results.push({ tier, ok: true, source: 'service_role', userId })
    } catch (err) {
      results.push({
        tier,
        ok: false,
        source: hasTokens(tier) ? 'tokens' : 'service_role',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const exportLines = []
  for (const tier of TIERS) {
    const access = process.env[`SMOKE_${tier.toUpperCase()}_ACCESS_TOKEN`]
    const refresh = process.env[`SMOKE_${tier.toUpperCase()}_REFRESH_TOKEN`]
    if (access && refresh) {
      exportLines.push(`export SMOKE_${tier.toUpperCase()}_ACCESS_TOKEN='${access}'`)
      exportLines.push(`export SMOKE_${tier.toUpperCase()}_REFRESH_TOKEN='${refresh}'`)
    }
  }
  if (exportLines.length) {
    fs.mkdirSync(AUTH_DIR, { recursive: true })
    fs.writeFileSync(path.join(AUTH_DIR, 'env.exports'), `${exportLines.join('\n')}\n`)
  }

  for (const row of results) {
    if (row.ok) {
      console.log(`[smoke:mint] ${row.tier}: ok (${row.source}${row.userId ? ` ${row.userId}` : ''})`)
    } else {
      console.warn(`[smoke:mint] ${row.tier}: SKIP — ${row.error}`)
    }
  }

  const ready = results.filter((r) => r.ok).length
  console.log(`[smoke:mint] ${ready}/${TIERS.length} tiers ready under tests/smoke/.auth/`)
  if (exportLines.length) {
    console.log('[smoke:mint] optional: source tests/smoke/.auth/env.exports before yarn test:smoke')
  }

  if (ready === 0) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('[smoke:mint] fatal:', err)
  process.exit(1)
})
