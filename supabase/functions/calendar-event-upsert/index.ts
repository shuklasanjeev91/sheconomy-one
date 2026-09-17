import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {
  authenticatedUser,
  calendarCorsHeaders,
  json,
  parseProvider,
  serviceClient,
  usableAccessToken,
} from '../_shared/calendar-oauth.ts'
import { resolvePublicAppOrigin } from '../_shared/app-url.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: calendarCorsHeaders })
  const user = await authenticatedUser(req)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  try {
    const body = await req.json().catch(() => ({}))
    const provider = parseProvider(body.provider)
    const meetingId = typeof body.meetingId === 'string' ? body.meetingId : ''
    if (!provider || !meetingId) return json({ error: 'provider and meetingId are required' }, 400)
    const service = serviceClient()
    const [{ data: meeting }, { data: connection }] = await Promise.all([
      service.from('meetings')
        .select('id,title,description,meeting_code,host_id,scheduled_at,scheduled_end_at,time_zone,invitees,security_settings')
        .eq('id', meetingId).eq('host_id', user.id).maybeSingle(),
      service.from('calendar_connections').select('*')
        .eq('user_id', user.id).eq('provider', provider).eq('status', 'active').maybeSingle(),
    ])
    if (!meeting) return json({ error: 'Meeting not found or you are not its host' }, 404)
    if (!connection) return json({ error: 'Calendar is not connected' }, 409)
    if (!meeting.scheduled_at || !meeting.scheduled_end_at) {
      return json({ error: 'Meeting requires explicit start and end times' }, 400)
    }
    const accessToken = await usableAccessToken(connection)
    const joinUrl = `${resolvePublicAppOrigin()}/co-work/meeting/${meeting.meeting_code}`
    const invitees = Array.isArray(meeting.invitees) ? meeting.invitees : []
    const attendeeEmails = invitees
      .map((invitee: Record<string, unknown>) => String(invitee.email ?? ''))
      .filter((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    const passcode =
      meeting.security_settings && typeof meeting.security_settings === 'object'
        ? (meeting.security_settings as { passcode?: string }).passcode
        : undefined
    const description = [
      meeting.description,
      `Join: ${joinUrl}`,
      `Meeting code: ${meeting.meeting_code}`,
      passcode ? `Passcode: ${passcode}` : null,
    ].filter(Boolean).join('\n\n')
    const { data: existing } = await service.from('calendar_events')
      .select('*').eq('connection_id', connection.id).eq('meeting_id', meeting.id).maybeSingle()

    // Always publish absolute UTC instants. Provider calendars convert to each
    // user's local timezone — never stamp the host-only zone onto attendees.
    const startUtc = new Date(meeting.scheduled_at).toISOString()
    const endUtc = new Date(meeting.scheduled_end_at).toISOString()

    let endpoint: string
    let payload: Record<string, unknown>
    if (provider === 'google') {
      const base = existing
        ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existing.external_event_id)}`
        : 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
      endpoint = `${base}?sendUpdates=all`
      payload = {
        summary: meeting.title,
        description,
        location: joinUrl,
        start: { dateTime: startUtc, timeZone: 'UTC' },
        end: { dateTime: endUtc, timeZone: 'UTC' },
        attendees: attendeeEmails.map((email: string) => ({ email })),
      }
    } else {
      endpoint = existing
        ? `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(existing.external_event_id)}`
        : 'https://graph.microsoft.com/v1.0/me/events'
      payload = {
        subject: meeting.title,
        body: {
          contentType: 'HTML',
          content: [
            `<p>${description.replace(/\n/g, '<br>')}</p>`,
            `<p><a href="${joinUrl}">Join meeting</a></p>`,
          ].join(''),
        },
        location: { displayName: joinUrl },
        start: { dateTime: startUtc.replace(/\.\d{3}Z$/, ''), timeZone: 'UTC' },
        end: { dateTime: endUtc.replace(/\.\d{3}Z$/, ''), timeZone: 'UTC' },
        attendees: attendeeEmails.map((address: string) => ({
          emailAddress: { address },
          type: 'required',
        })),
        isOnlineMeeting: false,
      }
    }
    const response = await fetch(endpoint, {
      method: existing ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const providerEvent = response.status === 204 ? {} : await response.json()
    if (!response.ok) {
      throw new Error(
        providerEvent.error?.message ||
          providerEvent.error?.errors?.[0]?.message ||
          'Calendar provider rejected the event',
      )
    }
    const externalId = providerEvent.id || existing?.external_event_id
    if (!externalId) throw new Error('Calendar provider did not return an event ID')
    const { data: saved, error } = await service.from('calendar_events').upsert({
      connection_id: connection.id,
      meeting_id: meeting.id,
      provider,
      external_event_id: externalId,
      external_calendar_id: provider === 'google' ? 'primary' : null,
      external_url: providerEvent.htmlLink || providerEvent.webLink || existing?.external_url || null,
      etag: providerEvent.etag || existing?.etag || null,
      sync_status: 'synced',
      last_error: null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'connection_id,meeting_id' }).select('id,provider,external_url,sync_status').single()
    if (error) throw new Error(error.message)
    return json({ ok: true, event: saved })
  } catch (error) {
    console.error('calendar-event-upsert:', error)
    return json({ error: error instanceof Error ? error.message : 'Calendar event sync failed' }, 400)
  }
})
