/**
 * POST /functions/v1/shepay-verify-kyc
 *
 * Realtime PAN / GSTIN check for the shop owner.
 * GST registry credentials (optional):
 *   GST_VERIFY_TOKEN, GST_VERIFY_CLIENT_ID
 *   GST_VERIFY_BASE_URL (default Masters India searchgstin)
 *
 * Body: { shopId, gstin?: string, pan?: string }
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/

function normalize(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

function gstinChecksum(gstin14: string): string {
  let factor = 2
  let sum = 0
  for (let i = gstin14.length - 1; i >= 0; i--) {
    const code = GSTIN_CHARS.indexOf(gstin14[i] ?? '')
    if (code < 0) return ''
    let digit = factor * code
    factor = factor === 2 ? 1 : 2
    digit = Math.floor(digit / 36) + (digit % 36)
    sum += digit
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] ?? ''
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return jsonResponse({ error: 'Service not configured' }, 503)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  let shopId = ''
  let gstin = ''
  let pan = ''
  try {
    const body = (await request.json()) as { shopId?: string; gstin?: string; pan?: string }
    shopId = String(body.shopId ?? '').trim()
    gstin = normalize(String(body.gstin ?? ''))
    pan = normalize(String(body.pan ?? ''))
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }
  if (!shopId) return jsonResponse({ error: 'shopId is required' }, 400)

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: shop } = await admin.from('shops').select('id, user_id').eq('id', shopId).maybeSingle()
  if (!shop) return jsonResponse({ error: 'Shop not found' }, 404)
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (shop.user_id !== user.id && profile?.role !== 'A') {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }

  if (gstin && (!GSTIN_RE.test(gstin) || gstinChecksum(gstin.slice(0, 14)) !== gstin[14])) {
    return jsonResponse({ ok: false, error: 'Enter a valid GSTIN.' }, 400)
  }
  const embeddedPan = gstin ? gstin.slice(2, 12) : ''
  if (pan && !PAN_RE.test(pan)) return jsonResponse({ ok: false, error: 'Enter a valid PAN.' }, 400)
  if (gstin && pan && pan !== embeddedPan) {
    return jsonResponse({ ok: false, error: 'PAN does not match the PAN on this GSTIN.' }, 400)
  }

  const token = Deno.env.get('GST_VERIFY_TOKEN')?.trim() || ''
  const clientId = Deno.env.get('GST_VERIFY_CLIENT_ID')?.trim() || ''
  if (!token || !clientId) {
    return jsonResponse({
      ok: true,
      source: 'checksum',
      configured: false,
      pan: embeddedPan || pan,
      gstin: gstin || null,
    })
  }

  const base =
    Deno.env.get('GST_VERIFY_BASE_URL')?.replace(/\/$/, '').trim() ||
    'https://commonapi.mastersindia.co/commonapis/searchgstin'
  const lookupPan = pan || embeddedPan
  const url = gstin
    ? `${base}${base.includes('?') ? '&' : '?'}gstin=${encodeURIComponent(gstin)}`
    : `https://commonapi.mastersindia.co/commonapis/searchpan?pan=${encodeURIComponent(lookupPan)}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      client_id: clientId,
    },
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok || json.error === true) {
    return jsonResponse(
      { ok: false, error: 'Could not verify this number on the tax registry. Try again.' },
      502,
    )
  }

  const data = Array.isArray(json.data) ? json.data[0] : json.data
  return jsonResponse({ ok: true, source: 'registry', configured: true, data: data ?? null })
})
