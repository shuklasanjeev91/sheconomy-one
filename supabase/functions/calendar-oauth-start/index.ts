import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {
  authenticatedUser,
  calendarCorsHeaders,
  json,
  oauthCallbackUrl,
  parseProvider,
  providerConfig,
  serviceClient,
} from '../_shared/calendar-oauth.ts'
import { encryptCalendarSecret, randomBase64Url, sha256Base64Url } from '../_shared/calendar-crypto.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: calendarCorsHeaders })
  const user = await authenticatedUser(req)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  try {
    const body = await req.json().catch(() => ({}))
    const provider = parseProvider(body.provider)
    if (!provider) return json({ error: 'provider must be google or microsoft' }, 400)
    const config = providerConfig(provider)
    const state = randomBase64Url(32)
    const verifier = randomBase64Url(64)
    const encryptedVerifier = await encryptCalendarSecret(verifier)
    const redirectTo = typeof body.redirectTo === 'string' && body.redirectTo.startsWith('/')
      ? body.redirectTo
      : '/co-work/meetings'
    const { error } = await serviceClient().from('calendar_oauth_states').insert({
      user_id: user.id,
      provider,
      state_hash: await sha256Base64Url(state),
      code_verifier_ciphertext: encryptedVerifier.ciphertext,
      code_verifier_iv: encryptedVerifier.iv,
      code_verifier_tag: encryptedVerifier.tag,
      redirect_to: redirectTo,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    if (error) throw new Error(error.message)
    const authorization = new URL(config.authorizationUrl)
    authorization.searchParams.set('client_id', config.clientId)
    authorization.searchParams.set('redirect_uri', oauthCallbackUrl())
    authorization.searchParams.set('response_type', 'code')
    authorization.searchParams.set('scope', config.scopes.join(' '))
    authorization.searchParams.set('state', state)
    authorization.searchParams.set('code_challenge', await sha256Base64Url(verifier))
    authorization.searchParams.set('code_challenge_method', 'S256')
    if (provider === 'google') {
      authorization.searchParams.set('access_type', 'offline')
      authorization.searchParams.set('prompt', 'consent')
    }
    return json({ authorizationUrl: authorization.toString(), configured: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not start OAuth'
    return json({ error: message, configured: !message.includes('not configured') }, 503)
  }
})
