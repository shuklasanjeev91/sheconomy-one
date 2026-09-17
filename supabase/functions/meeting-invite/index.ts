import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { appBaseUrl, sendResendEmail } from '../_shared/resend.ts'
import { formatInviteWhen } from '../_shared/meeting-invite-time.ts'
import {
  buildMeetingInviteEmailHtml,
  buildMeetingInviteEmailText,
  formatMeetingIdForEmail,
} from '../_shared/meeting-invite-email.ts'

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
  locale?: string
  timeZone?: string
  timezone?: string
}

function escapeIcs(value: unknown) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function icsUtc(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function base64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
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
      .select('id, title, description, meeting_code, host_id, scheduled_at, scheduled_end_at, time_zone, invitees, security_settings')
      .eq('id', meetingId)
      .maybeSingle()

    if (meetingError || !meeting) {
      return new Response(JSON.stringify({ error: 'Meeting not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Direct UPDATE on meetings is revoked for authenticated (secure RPCs only).
    // Prefer the host-gated RPC; fall back to service role after an authz check.
    const isMeetingOwner = meeting.host_id === authData.user.id
    if (!isMeetingOwner) {
      const { data: actorRole } = await supabase.rpc('meeting_actor_role', {
        meeting_id_input: meetingId,
      })
      if (actorRole !== 'host' && actorRole !== 'co_host') {
        return new Response(JSON.stringify({ error: 'Only the host or co-host can send invites.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const existing = Array.isArray(meeting.invitees) ? (meeting.invitees as Invitee[]) : []
    const merged = mergeInvitees(existing, invitees)

    const { error: rpcError } = await supabase.rpc('update_meeting_invitees_secure', {
      meeting_id_input: meetingId,
      invitees_input: merged,
    })

    if (rpcError) {
      // Co-hosts (or missing RPC) update via service role after the role check above.
      const { error: updateError } = await service
        .from('meetings')
        .update({ invitees: merged, updated_at: new Date().toISOString() })
        .eq('id', meetingId)

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message || rpcError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const { data: hostProfile } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', authData.user.id)
      .maybeSingle()

    const hostName = hostProfile?.full_name || hostProfile?.username || `A ${BRAND_NAME} host`
    const joinUrl = `${appBaseUrl()}/co-work/meeting/${meeting.meeting_code}`
    let notifications = 0
    let emailsSent = 0
    const mailtoLinks: string[] = []
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const roomId = meeting.meeting_code

    for (const invitee of invitees) {
      const key = inviteeKey(invitee)
      if (invitee.type === 'user' && invitee.id && !invitee.id.startsWith('email:')) {
        const { error: reserveError } = await service.from('meeting_invite_deliveries').insert({
          meeting_id: meeting.id,
          invitee_key: key,
          channel: 'notification',
        })
        if (reserveError?.code === '23505') continue
        if (reserveError) {
          console.warn('meeting-invite delivery reserve failed', reserveError.message)
          // Still attempt notification — idempotency table is best-effort.
        }
        const { data: notificationId, error: notifyError } = await service.rpc(
          'create_notification_from_template',
          {
            p_template_key: 'meeting_invitation',
            p_recipient_id: invitee.id,
            p_variables: {
              host_name: hostName,
              meeting_title: meeting.title,
              room_id: roomId,
              action_url: joinUrl,
              message: message || undefined,
            },
            p_context_type: 'meeting',
            p_context_id: meeting.id,
            p_override_channels: ['in_app', 'email', 'push'],
            p_override_priority: 2,
          },
        )

        if (notifyError) {
          await service.from('meeting_invite_deliveries').delete()
            .eq('meeting_id', meeting.id).eq('invitee_key', key).eq('channel', 'notification')
        } else if (notificationId) notifications += 1
        continue
      }

      const email = (invitee.email ?? invitee.name).trim().toLowerCase()
      if (!email.includes('@')) continue
      const { error: reserveError } = await service.from('meeting_invite_deliveries').insert({
        meeting_id: meeting.id,
        invitee_key: key,
        channel: 'email',
      })
      if (reserveError?.code === '23505') continue
      if (reserveError) {
        console.warn('meeting-invite email reserve failed', reserveError.message)
      }

      // Soft-lookup: profiles.email may be missing or RLS-shaped; never fail the invite.
      let profileTimeZone: string | null = null
      let profileLocale: string | null = null
      try {
        const { data: emailProfile } = await service
          .from('profiles')
          .select('timezone, preferred_language')
          .eq('email', email)
          .maybeSingle()
        profileTimeZone = emailProfile?.timezone ?? null
        profileLocale = emailProfile?.preferred_language ?? null
      } catch {
        // ignore
      }

      if (resendKey) {
        try {
          const sent = await sendCalendarInviteEmail({
            resendKey,
            to: email,
            inviteeName: invitee.name,
            hostName,
            meeting,
            joinUrl,
            message,
            inviteeTimeZone: invitee.timeZone || invitee.timezone || null,
            profileTimeZone,
            locale: invitee.locale || profileLocale || 'en',
          })
          if (sent) emailsSent += 1
          else throw new Error('send failed')
        } catch {
          await service.from('meeting_invite_deliveries').delete()
            .eq('meeting_id', meeting.id).eq('invitee_key', key).eq('channel', 'email')
          mailtoLinks.push(`mailto:${email}`)
        }
      } else {
        await service.from('meeting_invite_deliveries').delete()
          .eq('meeting_id', meeting.id).eq('invitee_key', key).eq('channel', 'email')
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

async function sendCalendarInviteEmail(input: {
  resendKey: string
  to: string
  inviteeName: string
  hostName: string
  meeting: {
    id: string
    title: string
    description?: string | null
    meeting_code: string
    scheduled_at?: string | null
    scheduled_end_at?: string | null
    time_zone?: string | null
    security_settings?: { passcode?: string } | null
  }
  joinUrl: string
  message: string
  inviteeTimeZone?: string | null
  profileTimeZone?: string | null
  locale?: string
}): Promise<boolean> {
  const subject = `Join Co-Work: ${input.meeting.title}`
  const startAt = input.meeting.scheduled_at || new Date().toISOString()
  const endAt = input.meeting.scheduled_end_at || new Date(Date.parse(startAt) + 3600000).toISOString()
  const display = formatInviteWhen({
    startsAt: startAt,
    endsAt: endAt,
    inviteeTimeZone: input.inviteeTimeZone,
    profileTimeZone: input.profileTimeZone,
    hostTimeZone: input.meeting.time_zone,
    locale: input.locale,
  })
  const passcode = input.meeting.security_settings?.passcode
  const calendarDescription = [
    input.meeting.description,
    `Join: ${input.joinUrl}`,
    `Meeting code: ${input.meeting.meeting_code}`,
    passcode ? `Passcode: ${passcode}` : null,
  ].filter(Boolean).join('\n\n')

  // ICS uses absolute UTC — calendar apps show the recipient's local time.
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SHEconomy//Co-Work//EN', 'CALSCALE:GREGORIAN',
    'METHOD:REQUEST', 'BEGIN:VEVENT', `UID:meeting-${input.meeting.id}@sheconomy.com`,
    `DTSTAMP:${icsUtc(new Date().toISOString())}`, `DTSTART:${icsUtc(startAt)}`,
    `DTEND:${icsUtc(endAt)}`, `SUMMARY:${escapeIcs(input.meeting.title)}`,
    `DESCRIPTION:${escapeIcs(calendarDescription)}`, `LOCATION:${escapeIcs(input.joinUrl)}`,
    `URL:${input.joinUrl}`, `ATTENDEE;RSVP=TRUE:mailto:${input.to}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n') + '\r\n'

  const dates = `${icsUtc(startAt)}/${icsUtc(endAt)}`
  const googleUrl = new URL('https://calendar.google.com/calendar/render')
  googleUrl.searchParams.set('action', 'TEMPLATE')
  googleUrl.searchParams.set('text', input.meeting.title)
  googleUrl.searchParams.set('dates', dates)
  googleUrl.searchParams.set('details', calendarDescription)
  const outlookUrl = new URL('https://outlook.office.com/calendar/0/deeplink/compose')
  outlookUrl.searchParams.set('path', '/calendar/action/compose')
  outlookUrl.searchParams.set('rru', 'addevent')
  outlookUrl.searchParams.set('subject', input.meeting.title)
  outlookUrl.searchParams.set('startdt', startAt)
  outlookUrl.searchParams.set('enddt', endAt)
  outlookUrl.searchParams.set('body', calendarDescription)

  const timezoneNote =
    display.source === 'utc'
      ? 'Times shown in UTC. Your calendar app will convert the attached invite to your local timezone.'
      : `Shown in your timezone (${display.timeZone}).`

  const emailInput = {
    brandLabel: BRAND_COWORK_LABEL,
    meetingTitle: input.meeting.title,
    hostName: input.hostName,
    dateLabel: display.dateLabel,
    timeLabel: display.timeLabel,
    endsLabel: display.endsLabel,
    joinUrl: input.joinUrl,
    meetingIdLabel: formatMeetingIdForEmail(input.meeting.meeting_code),
    passcode: passcode || null,
    personalMessage: input.message || null,
    googleCalendarUrl: googleUrl.toString(),
    outlookCalendarUrl: outlookUrl.toString(),
    timezoneNote,
    hostZoneHint: display.hostZoneHint,
  }

  const html = buildMeetingInviteEmailHtml(emailInput)
  const text = buildMeetingInviteEmailText(emailInput)

  await sendResendEmail(input.resendKey, {
    to: input.to,
    subject,
    html,
    text,
    from: `${BRAND_COWORK_LABEL} <cowork@sheconomy.com>`,
    attachments: [{ filename: `sheconomy-${input.meeting.meeting_code}.ics`, content: base64Utf8(ics) }],
  })
  return true
}
