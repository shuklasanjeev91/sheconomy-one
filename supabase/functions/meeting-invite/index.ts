import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const BRAND_NAME = 'SHEconomy'
const BRAND_COWORK_LABEL = `${BRAND_NAME} Co-Work`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Invitee = {
  id: string
  type: 'user' | 'email'
  name: string
  email?: string
  avatar?: string | null
  headline?: string | null
}

function inviteeKey(invitee: Invitee) {
  return invitee.type === 'email'
    ? `email:${(invitee.email ?? invitee.id).toLowerCase()}`
    : `user:${invitee.id}`
}

function mergeInvitees(existing: Invitee[], next: Invitee[]) {
  const map = new Map<string, Invitee & { invited_at: string; status: string }>()
  for (const item of existing) {
    map.set(inviteeKey(item), {
      ...item,
      invited_at: (item as { invited_at?: string }).invited_at ?? new Date().toISOString(),
      status: (item as { status?: string }).status ?? 'pending',
    })
  }
  const now = new Date().toISOString()
  for (const item of next) {
    map.set(inviteeKey(item), { ...item, invited_at: now, status: 'sent' })
  }
  return [...map.values()]
}

async function sendResendEmail(apiKey: string, payload: {
  to: string
  subject: string
  html: string
}) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${BRAND_COWORK_LABEL} <cowork@sheconomy.com>`,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Email provider error')
  }
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

    const service = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const meetingId = String(body.meetingId ?? '')
    const invitees = Array.isArray(body.invitees) ? (body.invitees as Invitee[]) : []
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    if (!meetingId || invitees.length === 0) {
      return new Response(JSON.stringify({ error: 'meetingId and invitees are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, title, meeting_code, host_id, scheduled_at, time_zone, invitees')
      .eq('id', meetingId)
      .maybeSingle()

    if (meetingError || !meeting) {
      return new Response(JSON.stringify({ error: 'Meeting not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (meeting.host_id !== authData.user.id) {
      return new Response(JSON.stringify({ error: 'Only the host can send invites.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const existing = Array.isArray(meeting.invitees) ? (meeting.invitees as Invitee[]) : []
    const merged = mergeInvitees(existing, invitees)

    const { error: updateError } = await supabase
      .from('meetings')
      .update({ invitees: merged })
      .eq('id', meetingId)

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: hostProfile } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', authData.user.id)
      .maybeSingle()

    const hostName = hostProfile?.full_name || hostProfile?.username || `A ${BRAND_NAME} host`
    const joinUrl = `${Deno.env.get('PUBLIC_APP_URL') ?? 'https://sheconomy.com'}/co-work/meeting/${meeting.meeting_code}`
    const when = meeting.scheduled_at
      ? new Date(meeting.scheduled_at).toLocaleString('en-IN', {
          timeZone: meeting.time_zone ?? 'Asia/Kolkata',
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : 'Starting soon'

    let notifications = 0
    let emailsSent = 0
    const mailtoLinks: string[] = []
    const resendKey = Deno.env.get('RESEND_API_KEY')

    for (const invitee of invitees) {
      if (invitee.type === 'user' && invitee.id && !invitee.id.startsWith('email:')) {
        const { error: notifyError } = await service.from('notifications').insert({
          recipient_id: invitee.id,
          context_type: 'meeting',
          context_id: meeting.id,
          type: 'meeting_invite',
          category: 'co-work',
          title: `${hostName} invited you to Co-Work`,
          message: message || `${meeting.title} · ${when}`,
          action_url: joinUrl,
          data: {
            meeting_id: meeting.id,
            meeting_code: meeting.meeting_code,
            host_id: authData.user.id,
          },
          channels: ['in_app'],
          priority: 2,
        })

        if (!notifyError) notifications += 1
        continue
      }

      const email = (invitee.email ?? invitee.name).trim().toLowerCase()
      if (!email.includes('@')) continue

      const subject = `Join Co-Work: ${meeting.title}`
      const html = `
        <p>Hi,</p>
        <p><strong>${hostName}</strong> invited you to a ${BRAND_COWORK_LABEL} meeting.</p>
        <p><strong>${meeting.title}</strong><br/>${when}</p>
        <p>Meeting code: <strong>${meeting.meeting_code}</strong></p>
        ${message ? `<p>${message}</p>` : ''}
        <p><a href="${joinUrl}">Join meeting</a></p>
      `

      if (resendKey) {
        try {
          await sendResendEmail(resendKey, { to: email, subject, html })
          emailsSent += 1
        } catch {
          mailtoLinks.push(`mailto:${email}`)
        }
      } else {
        mailtoLinks.push(`mailto:${email}`)
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        invited: invitees.length,
        notifications,
        emailsSent,
        mailtoLinks,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('meeting-invite error:', error)
    return new Response(JSON.stringify({ error: 'Failed to send meeting invites.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
