import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { AccessToken } from 'npm:livekit-server-sdk@2'

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
    const meetingId = String(body.meetingId ?? '')
    const roomName = String(body.roomName ?? '')
    const displayName = String(body.displayName ?? 'Guest').slice(0, 80)

    if (!meetingId || !roomName) {
      return new Response(JSON.stringify({ error: 'meetingId and roomName are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, room_id, status, host_id, security_settings')
      .eq('id', meetingId)
      .maybeSingle()

    if (meetingError || !meeting) {
      return new Response(JSON.stringify({ error: 'Meeting not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (meeting.status === 'ended') {
      return new Response(JSON.stringify({ error: 'Meeting has ended.' }), {
        status: 400,
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

    if (!isHost) {
      const waitingRoomEnabled = meeting.security_settings?.waiting_room === true

      const { data: participant } = await supabase
        .from('meeting_participants')
        .select('status')
        .eq('meeting_id', meetingId)
        .eq('user_id', userId)
        .maybeSingle()

      if (waitingRoomEnabled) {
        if (!participant || participant.status !== 'admitted') {
          return new Response(JSON.stringify({ error: 'You have not been admitted to this meeting.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      } else if (participant && participant.status === 'rejected') {
        return new Response(JSON.stringify({ error: 'You have been removed from this meeting.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: displayName,
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
