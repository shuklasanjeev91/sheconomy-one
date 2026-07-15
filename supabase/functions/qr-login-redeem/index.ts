import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'Server misconfigured' }, 500)
    }

    const body = await req.json()
    const challengeId = String(body.challengeId ?? '').trim()
    if (!challengeId) {
      return json({ error: 'challengeId is required' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: row, error: rowError } = await admin
      .from('auth_qr_login_challenges')
      .select('id, status, user_id, expires_at')
      .eq('id', challengeId)
      .maybeSingle()

    if (rowError || !row) {
      return json({ error: 'Challenge not found' }, 404)
    }

    if (row.status !== 'approved' || !row.user_id) {
      return json({ error: 'Challenge is not approved yet', status: row.status }, 409)
    }

    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      await admin.from('auth_qr_login_challenges').update({ status: 'expired' }).eq('id', challengeId)
      return json({ error: 'Challenge expired' }, 410)
    }

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(row.user_id)
    if (userError || !userData.user) {
      return json({ error: 'User not found' }, 404)
    }

    const email = userData.user.email
    const phone = userData.user.phone

    if (!email && !phone) {
      return json({ error: 'Account has no email or phone to mint a session' }, 400)
    }

    const linkParams = email
      ? { type: 'magiclink' as const, email }
      : { type: 'magiclink' as const, phone: phone! }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink(
      linkParams as never,
    )

    if (linkError || !linkData?.properties?.hashed_token) {
      return json({
        error: linkError?.message || 'Unable to mint login token',
      }, 500)
    }

    await admin.rpc('mark_qr_login_challenge_consumed', { p_id: challengeId })

    return json({
      token_hash: linkData.properties.hashed_token,
      type: email ? 'email' : 'sms',
      email: email ?? null,
      phone: phone ?? null,
    })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500,
    )
  }
})

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
