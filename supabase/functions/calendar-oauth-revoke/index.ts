import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {
  authenticatedUser,
  calendarCorsHeaders,
  json,
  parseProvider,
  serviceClient,
} from '../_shared/calendar-oauth.ts'
import { decryptCalendarSecret } from '../_shared/calendar-crypto.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: calendarCorsHeaders })
  const user = await authenticatedUser(req)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  const body = await req.json().catch(() => ({}))
  const provider = parseProvider(body.provider)
  if (!provider) return json({ error: 'provider must be google or microsoft' }, 400)
  const service = serviceClient()
  const { data: connection } = await service
    .from('calendar_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .maybeSingle()
  if (!connection) return json({ ok: true, provider })
  let providerRevoked = false
  if (provider === 'google' && connection.refresh_token_ciphertext) {
    try {
      const refreshToken = await decryptCalendarSecret({
        ciphertext: connection.refresh_token_ciphertext,
        iv: connection.refresh_token_iv,
        tag: connection.refresh_token_tag,
      })
      const response = await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: refreshToken }),
      })
      providerRevoked = response.ok
    } catch {
      // Local deletion still prevents any further use by SHEconomy.
    }
  }
  const { error } = await service.from('calendar_connections').delete().eq('id', connection.id)
  if (error) return json({ error: error.message }, 400)
  return json({
    ok: true,
    provider,
    providerRevoked,
    note: provider === 'microsoft'
      ? 'Microsoft does not provide a per-app token revoke endpoint; the local credentials were permanently deleted.'
      : undefined,
  })
})
