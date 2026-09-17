import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {
  authenticatedUser,
  calendarCorsHeaders,
  json,
  parseProvider,
  serviceClient,
  usableAccessToken,
} from '../_shared/calendar-oauth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: calendarCorsHeaders })
  const user = await authenticatedUser(req)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  try {
    const body = await req.json().catch(() => ({}))
    const provider = parseProvider(body.provider)
    if (!provider) return json({ error: 'provider must be google or microsoft' }, 400)
    const { data: connection } = await serviceClient()
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .eq('status', 'active')
      .maybeSingle()
    if (!connection) return json({ error: 'Calendar is not connected' }, 404)
    await usableAccessToken(connection)
    return json({ ok: true, provider })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Refresh failed' }, 400)
  }
})
