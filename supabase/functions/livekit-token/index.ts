import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { AccessToken, RoomServiceClient } from 'npm:livekit-server-sdk@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      .select('id, room_id, status, host_id, security_settings, meeting_options')
      .eq('id', meetingId)
      .maybeSingle()

    if (meetingError || !meeting) {
      return new Response(JSON.stringify({ error: 'Meeting not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Only cancelling closes a meeting. An `ended` one can be restarted by the
    // host, so it stays tokenable the same way a `scheduled` one is.
    if (meeting.status === 'cancelled') {
      return new Response(JSON.stringify({ error: 'The host cancelled this meeting.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (meeting.room_id !== roomName) {
      return new Response(JSON.stringify({ error: 'Invalid room.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = authData.user.id
    const isHost = meeting.host_id === userId
    const { data: participant } = await supabase
      .from('meeting_participants')
      .select('status, display_name')
      .eq('meeting_id', meetingId)
      .eq('user_id', userId)
      .maybeSingle()

    if (action === 'remove-participant') {
      if (!isHost || !participantUserId) {
        return new Response(JSON.stringify({ error: 'Only the host can remove a participant.' }), {
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

      if (participant?.status === 'removed') {
        return new Response(JSON.stringify({ error: 'You have been removed from this meeting.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (waitingRoomEnabled) {
        if (!participant || participant.status !== 'admitted') {
          return new Response(JSON.stringify({ error: 'You have not been admitted to this meeting.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
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

    const token = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: String(resolvedName).slice(0, 80),
      metadata: JSON.stringify({ avatarUrl }),
      ttl: '4h',
    })

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isHost,
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
