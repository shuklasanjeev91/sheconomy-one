import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { resolvePublicAppOrigin } from '../_shared/app-url.ts'
import {
  exchangeToken,
  oauthCallbackUrl,
  parseProvider,
  providerConfig,
  saveConnection,
  serviceClient,
} from '../_shared/calendar-oauth.ts'
import { decryptCalendarSecret, sha256Base64Url } from '../_shared/calendar-crypto.ts'

function redirect(path: string, params: Record<string, string>) {
  const url = new URL(path, resolvePublicAppOrigin())
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return Response.redirect(url, 303)
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const state = url.searchParams.get('state') ?? ''
  const code = url.searchParams.get('code') ?? ''
  const providerError = url.searchParams.get('error')
  if (!state) return redirect('/co-work/meetings', { calendar: 'error', reason: 'missing_state' })
  const service = serviceClient()
  const { data: oauthState } = await service
    .from('calendar_oauth_states')
    .select('*')
    .eq('state_hash', await sha256Base64Url(state))
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (!oauthState) return redirect('/co-work/meetings', { calendar: 'error', reason: 'invalid_state' })
  const redirectTo = oauthState.redirect_to || '/co-work/meetings'
  if (providerError || !code) {
    await service.from('calendar_oauth_states').update({ consumed_at: new Date().toISOString() }).eq('id', oauthState.id)
    return redirect(redirectTo, { calendar: 'error', reason: providerError || 'missing_code' })
  }
  try {
    const { data: claimed } = await service
      .from('calendar_oauth_states')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', oauthState.id)
      .is('consumed_at', null)
      .select('id')
      .maybeSingle()
    if (!claimed) throw new Error('OAuth state was already consumed')
    const provider = parseProvider(oauthState.provider)
    if (!provider) throw new Error('Invalid calendar provider')
    const verifier = await decryptCalendarSecret({
      ciphertext: oauthState.code_verifier_ciphertext,
      iv: oauthState.code_verifier_iv,
      tag: oauthState.code_verifier_tag,
    })
    const tokens = await exchangeToken(provider, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: oauthCallbackUrl(),
      code_verifier: verifier,
    })
    const profileUrl = provider === 'google'
      ? 'https://openidconnect.googleapis.com/v1/userinfo'
      : 'https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName'
    const profileResponse = await fetch(profileUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = profileResponse.ok ? await profileResponse.json() : {}
    await saveConnection({
      userId: oauthState.user_id,
      provider,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scopes: (tokens.scope || providerConfig(provider).scopes.join(' ')).split(' ').filter(Boolean),
      providerAccountId: profile.sub || profile.id || null,
      providerEmail: profile.email || profile.mail || profile.userPrincipalName || null,
    })
    return redirect(redirectTo, { calendar: 'connected', provider })
  } catch (error) {
    console.error('calendar-oauth-callback:', error)
    return redirect(redirectTo, { calendar: 'error', reason: 'exchange_failed' })
  }
})
