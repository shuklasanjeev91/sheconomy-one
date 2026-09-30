import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { mediasoupAdmin, MEDIASOUP_ROOM_PREFIX, signJwt } from '../_shared/mediasoup-admin.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Covers a full meeting: the client reuses the token for every signalling reconnect. */
const TOKEN_TTL_SECONDS = 12 * 60 * 60

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Breakout room names: `{mainRoomId}__bo__{breakoutUuid}` */
function isBreakoutRoomName(mainRoomId: string, roomName: string): boolean {
  return roomName.startsWith(`${mainRoomId}__bo__`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const mediasoupUrl = Deno.env.get('MEDIASOUP_URL')
    const jwtSecret = Deno.env.get('MEDIASOUP_JWT_SECRET')
    // Unset or switched off: meetings have no media server to join.
    if (!mediasoupUrl || !jwtSecret || Deno.env.get('MEDIASOUP_ENABLED') === 'false') {
      return json({ enabled: false })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json()
    const action = String(body.action ?? 'token')
    const participantUserId = String(body.participantUserId ?? '')
    const meetingId = String(body.meetingId ?? '')
    const roomName = String(body.roomName ?? '')
    const requestedDisplayName = String(body.displayName ?? '').trim().slice(0, 80)
    const displayName =
      /^user_[a-z0-9]+$/i.test(requestedDisplayName) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        requestedDisplayName,
      )
        ? ''
        : requestedDisplayName
    const bodyAvatarUrl =
      typeof body.avatarUrl === 'string' && body.avatarUrl.trim() ? body.avatarUrl.trim() : null
    const requestedSession = String(body.session ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 24)
    const session = requestedSession || crypto.randomUUID().replace(/-/g, '').slice(0, 12)

    if (!meetingId || !roomName) {
      return json({ error: 'meetingId and roomName are required.' }, 400)
    }

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, room_id, status, host_id, security_settings, meeting_options, max_participants')
      .eq('id', meetingId)
      .maybeSingle()

    if (meetingError || !meeting) return json({ error: 'Meeting not found.' }, 404)

    // Only cancellation permanently closes a room. Instant / scheduled / ended
    // meetings stay joinable so hosts can reopen and guests can wait for host.
    if (meeting.status === 'cancelled') {
      return json({ error: 'The host cancelled this meeting.' }, 403)
    }

    const mainRoomId = String(meeting.room_id ?? '')
    const isMainRoom = !!mainRoomId && mainRoomId === roomName
    const maybeBreakout = !!mainRoomId && isBreakoutRoomName(mainRoomId, roomName)
    if (!isMainRoom && !maybeBreakout) return json({ error: 'Invalid room.' }, 403)

    const userId = authData.user.id
    const [{ data: participant }, { data: actorRole }] = await Promise.all([
      supabase
        .from('meeting_participants')
        .select('status, display_name')
        .eq('meeting_id', meetingId)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('meeting_roles')
        .select('role')
        .eq('meeting_id', meetingId)
        .eq('user_id', userId)
        .maybeSingle(),
    ])
    const role = String(actorRole?.role ?? '')
    // Host is authoritative via meetings.host_id — do not require a meeting_roles row.
    const isHost = meeting.host_id === userId
    const isModerator = isHost || role === 'co_host' || role === 'host'

    if (maybeBreakout) {
      const { data: breakout } = await supabase
        .from('meeting_breakout_rooms')
        .select('id, status, livekit_room_name')
        .eq('meeting_id', meetingId)
        .eq('livekit_room_name', roomName)
        .maybeSingle()

      if (!breakout || breakout.status !== 'open') {
        return json({ error: 'Breakout room is not open.' }, 403)
      }

      if (!isModerator) {
        const { data: assignment } = await supabase
          .from('meeting_breakout_assignments')
          .select('id')
          .eq('meeting_id', meetingId)
          .eq('breakout_id', breakout.id)
          .eq('user_id', userId)
          .maybeSingle()
        if (!assignment) return json({ error: 'You are not assigned to this breakout.' }, 403)
      }
    }

    const roomId = `${MEDIASOUP_ROOM_PREFIX}${roomName}`

    if (action === 'remove-participant') {
      if (!isModerator || !participantUserId || participantUserId === userId) {
        return json({ error: 'Not authorized to remove this participant.' }, 403)
      }
      const [{ data: target }, { data: targetRole }] = await Promise.all([
        supabase
          .from('meeting_participants')
          .select('status')
          .eq('meeting_id', meetingId)
          .eq('user_id', participantUserId)
          .maybeSingle(),
        supabase
          .from('meeting_roles')
          .select('role')
          .eq('meeting_id', meetingId)
          .eq('user_id', participantUserId)
          .maybeSingle(),
      ])
      // The database move (removed / back to waiting) happens first and is authoritative.
      if (
        (target?.status !== 'removed' && target?.status !== 'waiting') ||
        targetRole?.role === 'host' ||
        meeting.host_id === participantUserId ||
        (role === 'co_host' && targetRole?.role === 'co_host')
      ) {
        return json({ error: 'Removal was not authorized by the server.' }, 403)
      }
      const kicked = await mediasoupAdmin('kick', { room: roomId, user: participantUserId })
      // 404: room or peer already gone — nothing left to kick.
      if (kicked.status >= 400 && kicked.status !== 404) {
        return json({ error: 'Could not remove participant from the media room.' }, 502)
      }
      return json({ ok: true })
    }

    if (action === 'end-room') {
      if (!isHost || meeting.status !== 'ended') {
        return json({ error: 'Room end was not authorized.' }, 403)
      }
      const closed = await mediasoupAdmin('close', { room: roomId })
      if (closed.status >= 400 && closed.status !== 404) {
        return json({ error: 'Could not end the media room.' }, 502)
      }
      return json({ ok: true })
    }

    if (!participant || participant.status !== 'admitted') {
      return json({ error: 'You are not admitted to this meeting.' }, 403)
    }

    if (!isHost) {
      const options = (meeting.meeting_options ?? {}) as Record<string, unknown>
      const allowJoinBeforeHost =
        options.allowJoinBeforeHost === true || options.allow_join_before_host === true
      const hostAway = meeting.status === 'scheduled' || meeting.status === 'ended'
      if (hostAway && !allowJoinBeforeHost) {
        return json({ error: 'Waiting for the host to start this meeting.' }, 403)
      }
    }

    // Soft capacity check for the main room (host always allowed).
    if (isMainRoom && !isHost) {
      const cap = typeof meeting.max_participants === 'number' ? meeting.max_participants : 100
      const { count } = await supabase
        .from('meeting_participants')
        .select('id', { count: 'exact', head: true })
        .eq('meeting_id', meetingId)
        .eq('status', 'admitted')
      if (typeof count === 'number' && count > cap) return json({ error: 'Meeting is full.' }, 403)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, username, avatar_url')
      .eq('id', userId)
      .maybeSingle()

    // The "Guest" placeholder never outranks a real name from the request or the profile.
    const resolvedName =
      [participant?.display_name, displayName, profile?.full_name, profile?.username]
        .map((value) => String(value ?? '').trim())
        .find((value) => value && !/^guest$/i.test(value))
        ?.slice(0, 80) || 'Guest'
    const avatarUrl = bodyAvatarUrl || profile?.avatar_url || null

    // One peer per device session; the user id prefix keeps tiles keyed per person.
    const peerId = `${userId}~${session}`
    const now = Math.floor(Date.now() / 1000)
    const token = await signJwt(
      {
        sub: userId,
        room: roomId,
        peer: peerId,
        name: resolvedName,
        avatar: avatarUrl,
        meeting: meetingId,
        mod: isModerator,
        iat: now,
        exp: now + TOKEN_TTL_SECONDS,
      },
      jwtSecret,
    )

    return json({ enabled: true, url: mediasoupUrl, token, roomId, peerId })
  } catch (error) {
    console.error('mediasoup-token error:', error)
    return json({ error: 'Failed to create meeting media token.' }, 500)
  }
})
