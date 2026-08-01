import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { appBaseUrl, sendResendEmail } from '../_shared/resend.ts'

const BRAND_NAME = 'SHEconomy'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type InviteRpcResult = {
  status?: string
  message?: string
  invite_id?: string
  invitee_user_id?: string
  connection_id?: string
  error?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('invite_network_by_email', {
      p_email: email,
      p_message: message || null,
    })

    if (rpcError) {
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = (rpcData ?? {}) as InviteRpcResult
    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', authData.user.id)
      .maybeSingle()

    const inviterName =
      inviterProfile?.full_name || inviterProfile?.username || `A ${BRAND_NAME} member`
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const baseUrl = appBaseUrl()
    const normalizedEmail = email.toLowerCase()

    let emailsSent = 0
    let emailError: string | null = null

    const isPendingSignup = result.status === 'pending_signup'
    const actionUrl = isPendingSignup
      ? `${baseUrl}/auth/sign-in?email=${encodeURIComponent(normalizedEmail)}`
      : `${baseUrl}/community/network`
    const subject = isPendingSignup
      ? `${inviterName} invited you to join ${BRAND_NAME}`
      : `${inviterName} wants to connect on ${BRAND_NAME}`

    const html = `
      <p>Hi,</p>
      <p><strong>${inviterName}</strong> invited you to connect on ${BRAND_NAME}.</p>
      ${message ? `<p>${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : ''}
      <p><a href="${actionUrl}">${isPendingSignup ? 'Join and connect' : 'View invitation'}</a></p>
    `

    if (resendKey) {
      try {
        await sendResendEmail(resendKey, {
          to: normalizedEmail,
          subject,
          html,
          from: `${BRAND_NAME} Community <community@sheconomy.com>`,
        })
        emailsSent = 1
      } catch (error) {
        emailError = error instanceof Error ? error.message : 'Email send failed'
      }
    }

    return new Response(
      JSON.stringify({
        ...result,
        emailsSent,
        emailError,
        emailConfigured: !!resendKey,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('network-invite error:', error)
    return new Response(JSON.stringify({ error: 'Failed to send network invite.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
