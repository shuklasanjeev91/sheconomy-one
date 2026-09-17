import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decryptCalendarSecret, encryptCalendarSecret } from './calendar-crypto.ts'

export type CalendarProvider = 'google' | 'microsoft'

type ProviderConfig = {
  clientId: string
  clientSecret: string
  authorizationUrl: string
  tokenUrl: string
  scopes: string[]
}

export const calendarCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...calendarCorsHeaders, 'Content-Type': 'application/json' },
  })
}

export function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
}

export async function authenticatedUser(req: Request) {
  const authorization = req.headers.get('Authorization')
  if (!authorization) return null
  const client = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  )
  const { data } = await client.auth.getUser()
  return data.user ?? null
}

export function parseProvider(value: unknown): CalendarProvider | null {
  return value === 'google' || value === 'microsoft' ? value : null
}

export function providerConfig(provider: CalendarProvider): ProviderConfig {
  const prefix = provider === 'google' ? 'GOOGLE_CALENDAR' : 'MICROSOFT_CALENDAR'
  const clientId = Deno.env.get(`${prefix}_CLIENT_ID`) ?? ''
  const clientSecret = Deno.env.get(`${prefix}_CLIENT_SECRET`) ?? ''
  if (!clientId || !clientSecret) {
    throw new Error(`${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET are not configured`)
  }
  if (provider === 'google') {
    return {
      clientId,
      clientSecret,
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events'],
    }
  }
  const tenant = Deno.env.get('MICROSOFT_CALENDAR_TENANT_ID') || 'common'
  return {
    clientId,
    clientSecret,
    authorizationUrl: `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    scopes: ['openid', 'email', 'offline_access', 'Calendars.ReadWrite'],
  }
}

export function oauthCallbackUrl() {
  const explicit = Deno.env.get('CALENDAR_OAUTH_CALLBACK_URL')
  if (explicit) return explicit
  const base = Deno.env.get('SUPABASE_URL')
  if (!base) throw new Error('SUPABASE_URL is not configured')
  return `${base}/functions/v1/calendar-oauth-callback`
}

export async function exchangeToken(
  provider: CalendarProvider,
  params: Record<string, string>,
) {
  const config = providerConfig(provider)
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...params,
    }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'OAuth token exchange failed')
  }
  return payload as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    scope?: string
    id_token?: string
  }
}

export async function saveConnection(input: {
  userId: string
  provider: CalendarProvider
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  scopes?: string[]
  providerEmail?: string | null
  providerAccountId?: string | null
}) {
  const access = await encryptCalendarSecret(input.accessToken)
  const refresh = input.refreshToken ? await encryptCalendarSecret(input.refreshToken) : null
  const row = {
    user_id: input.userId,
    provider: input.provider,
    scopes: input.scopes ?? [],
    access_token_ciphertext: access.ciphertext,
    access_token_iv: access.iv,
    access_token_tag: access.tag,
    ...(refresh ? {
      refresh_token_ciphertext: refresh.ciphertext,
      refresh_token_iv: refresh.iv,
      refresh_token_tag: refresh.tag,
    } : {}),
    token_expires_at: new Date(Date.now() + (input.expiresIn ?? 3600) * 1000).toISOString(),
    status: 'active',
    last_error: null,
    updated_at: new Date().toISOString(),
    ...(input.providerEmail !== undefined ? { provider_email: input.providerEmail } : {}),
    ...(input.providerAccountId !== undefined ? { provider_account_id: input.providerAccountId } : {}),
  }
  const { data, error } = await serviceClient()
    .from('calendar_connections')
    .upsert(row, { onConflict: 'user_id,provider' })
    .select('id, provider, provider_email, status, token_expires_at')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function usableAccessToken(connection: Record<string, unknown>) {
  const expiresAt = Date.parse(String(connection.token_expires_at ?? ''))
  if (Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000) {
    return decryptCalendarSecret({
      ciphertext: String(connection.access_token_ciphertext),
      iv: String(connection.access_token_iv),
      tag: String(connection.access_token_tag),
    })
  }
  const provider = parseProvider(connection.provider)
  if (!provider || !connection.refresh_token_ciphertext) throw new Error('Calendar connection requires reauthorization')
  const refreshToken = await decryptCalendarSecret({
    ciphertext: String(connection.refresh_token_ciphertext),
    iv: String(connection.refresh_token_iv),
    tag: String(connection.refresh_token_tag),
  })
  const tokens = await exchangeToken(provider, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: providerConfig(provider).scopes.join(' '),
  })
  await saveConnection({
    userId: String(connection.user_id),
    provider,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || refreshToken,
    expiresIn: tokens.expires_in,
    scopes: (tokens.scope || '').split(' ').filter(Boolean),
  })
  return tokens.access_token
}
