import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { AccessToken, RoomServiceClient } from 'npm:livekit-server-sdk@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Breakout LiveKit names: `{mainRoomId}__bo__{breakoutUuid}` */
function isBreakoutRoomName(mainRoomId: string, roomName: string): boolean {
  return roomName.startsWith(`${mainRoomId}__bo__`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('LIVEKIT_API_KEY')
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')
    const livekitUrl = Deno.env.get('LIVEKIT_URL')

    if (!apiKey || !apiSecret || !livekitUrl) {
      return new Response(JSON.stringify({ error: 'LiveKit is not configured on the server.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
    const action = String(body.action ?? 'token')
    const meetingId = String(body.meetingId ?? '')
    const roomName = String(body.roomName ?? '')
    const participantUserId = String(body.participantUserId ?? '')
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

    if (!meetingId || !roomName) {
      return new Response(JSON.stringify({ error: 'meetingId and roomName are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, room_id, status, host_id, security_settings, meeting_options, max_participants')
      .eq('id', meetingId)
      .maybeSingle()

    if (meetingError || !meeting) {
      return new Response(JSON.stringify({ error: 'Meeting not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Only cancellation permanently closes a room. Instant / scheduled / ended
    // meetings stay tokenable so hosts can reopen and guests can wait for host.
    if (meeting.status === 'cancelled') {
      return new Response(JSON.stringify({ error: 'The host cancelled this meeting.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const mainRoomId = String(meeting.room_id ?? '')
    const isMainRoom = !!mainRoomId && mainRoomId === roomName
    const maybeBreakout = !!mainRoomId && isBreakoutRoomName(mainRoomId, roomName)

    if (!isMainRoom && !maybeBreakout) {
      return new Response(JSON.stringify({ error: 'Invalid room.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
        return new Response(JSON.stringify({ error: 'Breakout room is not open.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!isModerator) {
        const { data: assignment } = await supabase
          .from('meeting_breakout_assignments')
          .select('id')
          .eq('meeting_id', meetingId)
          .eq('breakout_id', breakout.id)
          .eq('user_id', userId)
          .maybeSingle()
        if (!assignment) {
          return new Response(JSON.stringify({ error: 'You are not assigned to this breakout.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    if (action === 'remove-participant') {
      if (!isModerator || !participantUserId || participantUserId === userId) {
        return new Response(JSON.stringify({ error: 'Not authorized to remove this participant.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const [{ data: target }, { data: targetRole }, { data: removalEvent }] = await Promise.all([
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
        supabase
          .from('meeting_control_events')
          .select('id')
          .eq('meeting_id', meetingId)
          .eq('actor_id', userId)
          .eq('target_user_id', participantUserId)
          .eq('action', 'removed')
          .gt('expires_at', new Date().toISOString())
          .limit(1)
          .maybeSingle(),
      ])
      if (
        target?.status !== 'removed' ||
        !removalEvent ||
        targetRole?.role === 'host' ||
        meeting.host_id === participantUserId ||
        (role === 'co_host' && targetRole?.role === 'co_host')
      ) {
        return new Response(JSON.stringify({ error: 'Removal was not authorized by the server.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      try {
        const serviceUrl = livekitUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:')
        const roomService = new RoomServiceClient(serviceUrl, apiKey, apiSecret)
        await roomService.removeParticipant(roomName, participantUserId)
      } catch (removeError) {
        // The database removal remains authoritative. An already-disconnected
        // participant will not exist in LiveKit and does not need another kick.
        const message = removeError instanceof Error ? removeError.message : String(removeError)
        if (!/not found|does not exist|participant.*missing/i.test(message)) throw removeError
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'end-room') {
      if (!isHost || meeting.status !== 'ended') {
        return new Response(JSON.stringify({ error: 'Room end was not authorized.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const serviceUrl = livekitUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:')
      const roomService = new RoomServiceClient(serviceUrl, apiKey, apiSecret)
      try {
        await roomService.deleteRoom(roomName)
      } catch (endError) {
        const message = endError instanceof Error ? endError.message : String(endError)
        if (!/not found|does not exist|room.*missing/i.test(message)) throw endError
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!participant || participant.status !== 'admitted') {
      return new Response(JSON.stringify({ error: 'You are not admitted to this meeting.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!isHost) {
      const security = (meeting.security_settings ?? {}) as Record<string, unknown>
      const options = (meeting.meeting_options ?? {}) as Record<string, unknown>
      const waitingRoomEnabled = security.waitingRoom === true || security.waiting_room === true
      const allowJoinBeforeHost =
        options.allowJoinBeforeHost === true || options.allow_join_before_host === true

      const hostAway = meeting.status === 'scheduled' || meeting.status === 'ended'
      if (hostAway && !allowJoinBeforeHost) {
        return new Response(JSON.stringify({ error: 'Waiting for the host to start this meeting.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (participant.status === 'removed') {
        return new Response(JSON.stringify({ error: 'You have been removed from this meeting.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (waitingRoomEnabled) {
        if (participant.status !== 'admitted') {
          return new Response(JSON.stringify({ error: 'You have not been admitted to this meeting.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // Soft capacity check for main room tokens (host always allowed).
    if (isMainRoom && !isHost) {
      const cap = typeof meeting.max_participants === 'number' ? meeting.max_participants : 100
      const { count } = await supabase
        .from('meeting_participants')
        .select('id', { count: 'exact', head: true })
        .eq('meeting_id', meetingId)
        .eq('status', 'admitted')
      if (typeof count === 'number' && count > cap) {
        return new Response(JSON.stringify({ error: 'Meeting is full.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, username, avatar_url')
      .eq('id', userId)
      .maybeSingle()

    const resolvedName =
      participant?.display_name ||
      displayName ||
      profile?.full_name ||
      profile?.username ||
      'Guest'
    const avatarUrl = bodyAvatarUrl || profile?.avatar_url || null

    // Unique LiveKit identity per Sheconomy user so 1–N peers share one room
    // without colliding tiles / publications.
    const token = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: String(resolvedName).slice(0, 80),
      metadata: JSON.stringify({ avatarUrl, meetingId }),
      ttl: '4h',
    })

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      // Administrative operations only pass through this function after an
      // authorization check; no client token receives direct room admin.
      roomAdmin: false,
    })

    const jwt = await token.toJwt()

    return new Response(JSON.stringify({ token: jwt, url: livekitUrl, roomName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('livekit-token error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create LiveKit token.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
