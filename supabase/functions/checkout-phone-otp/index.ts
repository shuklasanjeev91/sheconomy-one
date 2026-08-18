import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { resolveTwilioCredentials, sendTwilioMessage } from '../_shared/twilio.ts'

const RESEND_COOLDOWN_MS = 30_000
const CODE_TTL_MS = 5 * 60_000
const MAX_VERIFY_ATTEMPTS = 5
const SEND_WINDOW_MS = 24 * 60 * 60_000
const MAX_SENDS_PER_WINDOW = 10

type SendBody = { action: 'send'; phone: string }
type ConfirmBody = { action: 'confirm'; phone: string; code: string }
type RequestBody = SendBody | ConfirmBody

/** Accept E.164 only: '+' then 8-15 digits (first digit non-zero). */
function normalizeE164(input: string): string | null {
  const trimmed = (input ?? '').trim()
  if (!/^\+[1-9]\d{7,14}$/.test(trimmed)) return null
  return trimmed
}

async function hashCode(userId: string, code: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId}:${code}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Length-stable comparison so a match never short-circuits on the first byte. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

function randomCode(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceRole || !anonKey) {
    return jsonResponse({ error: 'Verification is not configured' }, 503)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const phone = normalizeE164(body?.phone ?? '')
  if (!phone) return jsonResponse({ error: 'Enter a valid mobile number.' }, 400)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const now = Date.now()

  if (body.action === 'send') {
    const { data: existing } = await admin
      .from('checkout_phone_verifications')
      .select('last_sent_at, send_count, send_window_started_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing?.last_sent_at) {
      const elapsed = now - new Date(existing.last_sent_at).getTime()
      if (elapsed < RESEND_COOLDOWN_MS) {
        const retryIn = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
        return jsonResponse(
          { error: `Please wait ${retryIn}s before requesting another code.`, retryIn },
          429,
        )
      }
    }

    // Per-user daily cap to blunt SMS-cost / harassment abuse.
    const windowStartedAt = existing?.send_window_started_at
      ? new Date(existing.send_window_started_at).getTime()
      : 0
    const windowActive = now - windowStartedAt < SEND_WINDOW_MS
    const priorSends = windowActive ? (existing?.send_count ?? 0) : 0
    if (priorSends >= MAX_SENDS_PER_WINDOW) {
      return jsonResponse(
        { error: 'Too many verification codes requested today. Try again later.' },
        429,
      )
    }

    const twilio = resolveTwilioCredentials()
    if (!twilio || !twilio.smsFrom) {
      return jsonResponse({ error: 'SMS sending is not configured.' }, 503)
    }

    const code = randomCode()
    const codeHash = await hashCode(user.id, code)
    const expiresAt = new Date(now + CODE_TTL_MS).toISOString()

    const { error: upsertError } = await admin.from('checkout_phone_verifications').upsert(
      {
        user_id: user.id,
        phone,
        code_hash: codeHash,
        expires_at: expiresAt,
        attempts: 0,
        last_sent_at: new Date(now).toISOString(),
        verified_at: null,
        send_count: priorSends + 1,
        send_window_started_at: new Date(windowActive ? windowStartedAt : now).toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (upsertError) return jsonResponse({ error: 'Could not start verification.' }, 500)

    try {
      await sendTwilioMessage({
        accountSid: twilio.accountSid,
        authToken: twilio.authToken,
        from: twilio.smsFrom,
        to: phone,
        channel: 'sms',
        body: `${code} is your SHEconomy verification code. It expires in 5 minutes.`,
      })
    } catch {
      return jsonResponse({ error: 'Could not send the verification code.' }, 502)
    }

    return jsonResponse({ success: true })
  }

  if (body.action === 'confirm') {
    const code = String(body.code ?? '').replace(/\D/g, '')
    if (code.length !== 6) return jsonResponse({ error: 'Enter the 6-digit code.' }, 400)

    const { data: record } = await admin
      .from('checkout_phone_verifications')
      .select('phone, code_hash, expires_at, attempts, verified_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!record || record.phone !== phone) {
      return jsonResponse({ error: 'Send a verification code first.' }, 400)
    }
    if (new Date(record.expires_at).getTime() < now) {
      return jsonResponse({ error: 'This code has expired. Send a new code to continue.' }, 400)
    }
    if ((record.attempts ?? 0) >= MAX_VERIFY_ATTEMPTS) {
      return jsonResponse(
        { error: 'Too many incorrect attempts. Send a new code to continue.' },
        429,
      )
    }

    const candidate = await hashCode(user.id, code)
    if (!timingSafeEqual(candidate, record.code_hash)) {
      await admin
        .from('checkout_phone_verifications')
        .update({ attempts: (record.attempts ?? 0) + 1 })
        .eq('user_id', user.id)
      return jsonResponse({ error: 'That code is incorrect. Try again.' }, 400)
    }

    const verifiedAt = new Date(now).toISOString()

    // Source of truth for checkout readiness. These columns are exempt from the
    // one-account-per-phone rule, so a number shared with another account still
    // verifies here.
    const { error: profileError } = await admin
      .from('profiles')
      .update({ checkout_phone: phone, checkout_phone_verified_at: verifiedAt })
      .eq('id', user.id)
    if (profileError) return jsonResponse({ error: 'Could not save your verified number.' }, 500)

    // Mirror onto profiles.phone so receipts, vendor views and order
    // notifications pick the number up. check_unique_profile_contact() rejects
    // this when another profile already holds the number, which must not fail a
    // verification that has already succeeded.
    await admin.from('profiles').update({ phone, phone_verified: true }).eq('id', user.id)

    await admin
      .from('checkout_phone_verifications')
      .update({ verified_at: verifiedAt })
      .eq('user_id', user.id)

    return jsonResponse({ success: true })
  }

  return jsonResponse({ error: 'Unknown action' }, 400)
})
